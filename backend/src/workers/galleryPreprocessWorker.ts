import { Worker } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import prisma from '../config/prisma';
import { UPLOADS_DIR } from '../config/constants';
import { getRedis } from '../queues/redis';
import { getGalleryScanQueue } from '../queues/galleryQueues';
import { setSyncState } from '../queues/syncStateStore';
import galleryRepository from '../repositories/galleryRepository';

const OPT_DIR = path.join(UPLOADS_DIR, 'optimized');
const THUMB_DIR = path.join(UPLOADS_DIR, 'thumbs');

function ensureDirs() {
  if (!fs.existsSync(OPT_DIR)) fs.mkdirSync(OPT_DIR, { recursive: true });
  if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });
}

function fileForUrl(url: string): string {
  return path.join(UPLOADS_DIR, url.split('/').pop() || '');
}

function optimizedPathForUrl(url: string): string {
  return path.join(OPT_DIR, url.split('/').pop() || '');
}

function thumbPathForUrl(url: string, size: number): string {
  const name = (url.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
  return path.join(THUMB_DIR, `${name}_${size}.jpg`);
}

async function preprocessOne(url: string) {
  const src = fileForUrl(url);
  if (!fs.existsSync(src)) return;

  ensureDirs();
  const opt = optimizedPathForUrl(url);
  const t256 = thumbPathForUrl(url, 256);
  const t512 = thumbPathForUrl(url, 512);

  // Optimized image for AI (balanced: speed + face detail)
  await sharp(src)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(opt);

  // Thumbnails for UI (future use; doesn't break current UI)
  await sharp(src)
    .rotate()
    .resize({ width: 256, height: 256, fit: 'cover' })
    .jpeg({ quality: 75, mozjpeg: true })
    .toFile(t256);

  await sharp(src)
    .rotate()
    .resize({ width: 512, height: 512, fit: 'cover' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(t512);
}

export function startGalleryPreprocessWorker() {
  const redis = getRedis();
  if (!redis) {
    console.log('[BullMQ] REDIS_URL not set. Preprocess worker disabled.');
    return null;
  }

  const scanQueue = getGalleryScanQueue();
  if (!scanQueue) {
    console.log('[BullMQ] gallery.scan queue unavailable.');
    return null;
  }

  const concurrency = Math.max(1, Number(process.env.GALLERY_PREPROCESS_CONCURRENCY || 4));

  const worker = new Worker('gallery.preprocess', async (job) => {
    const payload = job.data as any;

    if (payload?.type === 'upload') {
      const itemIds: number[] = Array.isArray(payload.itemIds) ? payload.itemIds : [];
      // Keep UI contract: show scan total as number of items (scan worker will advance current).
      await setSyncState(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: itemIds.length } as any);

      const items = await prisma.galleryItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, url: true } });
      let done = 0;
      const CHUNK = 20;
      for (let i = 0; i < items.length; i += CHUNK) {
        const slice = items.slice(i, i + CHUNK);
        await Promise.all(slice.map((it) => preprocessOne(it.url)));
        done += slice.length;
        await setSyncState(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: done, total: itemIds.length } as any);
      }

      await scanQueue.add('scan', { type: 'upload', itemIds }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 1 });
      return { ok: true };
    }

    if (payload?.type === 'refresh') {
      const forceRescan = Boolean(payload.forceRescan);
      const allItems = await galleryRepository.findAll();
      const realItems = allItems.filter((i: any) => !i.isProfile && i.url);
      const itemIds = realItems.map((i: any) => i.id);

      await setSyncState(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: itemIds.length } as any);

      const CHUNK = 20;
      let done = 0;
      for (let i = 0; i < realItems.length; i += CHUNK) {
        const slice = realItems.slice(i, i + CHUNK);
        await Promise.all(slice.map((it: any) => preprocessOne(it.url)));
        done += slice.length;
        await setSyncState(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: done, total: itemIds.length } as any);
      }

      await scanQueue.add('scan', { type: 'refresh', forceRescan }, { jobId: `gallery:scan-refresh:${forceRescan ? 'force' : 'soft'}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 5 });
      return { ok: true, forceRescan };
    }

    return { ok: false };
  }, { connection: redis, concurrency });

  worker.on('failed', async (job, err) => {
    console.error('[BullMQ] gallery.preprocess failed:', err?.message || err);
    try { await setSyncState(redis, { isScanning: false }); } catch {}
  });

  console.log(`[BullMQ] gallery.preprocess worker started (concurrency=${concurrency})`);
  return worker;
}

