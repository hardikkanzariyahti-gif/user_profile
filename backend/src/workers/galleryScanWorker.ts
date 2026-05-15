import { Worker } from 'bullmq';
import * as path from 'path';
import * as fs from 'fs';
import prisma from '../config/prisma';
import faceAi from '../../faceAi';
import { UPLOADS_DIR } from '../config/constants';
import galleryRepository from '../repositories/galleryRepository';
import userRepository from '../repositories/userRepository';
import { getRedis } from '../queues/redis';
import { setSyncState } from '../queues/syncStateStore';
import { cleanupAIPayload } from '../utils/hashtagUtils';

const OPT_DIR = path.join(UPLOADS_DIR, 'optimized');
const MODEL_CACHE_TTL_MS = 3 * 60 * 1000;
let modelCache: any[] | null = null;
let modelCacheTime = 0;

function pickScanPath(url: string): string {
  const name = url.split('/').pop() || '';
  const opt = path.join(OPT_DIR, name);
  if (fs.existsSync(opt)) return opt;
  return path.join(UPLOADS_DIR, name);
}

function parseUserId(label: string): number | null {
  try { return Number(JSON.parse(label).id); } catch { return null; }
}

async function buildModel() {
  const now = Date.now();
  if (modelCache && (now - modelCacheTime) < MODEL_CACHE_TTL_MS) return modelCache;
  const allUsers = await userRepository.findAllForRecognition();
  // Lazy import to avoid circular dependency issues.
  const { buildLabeledDescriptors } = await import('../services/galleryService');
  modelCache = await buildLabeledDescriptors(allUsers);
  modelCacheTime = Date.now();
  return modelCache;
}

async function scanItemsByIds(itemIds: number[]) {
  const { default: galleryService } = await import('../services/galleryService');
  
  // Process sequential but concurrently in chunks
  const tasks = itemIds.map((id) => async () => {
    console.log(`[Queue Worker] Processing imageId ${id}...`);
    try {
      // 🚀 [Required Fix 1] - Channel through the absolute unified pipeline logic for strict functional parity
      await galleryService.processGalleryImage(id);
    } catch (err) {
      console.error(`[Queue Worker] Failed for ID ${id}:`, err);
    }
  });

  const updateConcurrency = Math.max(1, Number(process.env.GALLERY_DB_UPDATE_CONCURRENCY || 4));
  let cursor = 0;
  const runners = new Array(Math.min(updateConcurrency, tasks.length)).fill(0).map(async () => {
    while (cursor < tasks.length) {
      const myIdx = cursor++;
      await tasks[myIdx]();
    }
  });
  await Promise.all(runners);
}

async function refreshAll(forceRescan: boolean) {
  const allItems = await galleryRepository.findAll();
  const realItems = allItems.filter((i: any) => !i.isProfile && i.url);
  const itemIds = realItems.map((i: any) => i.id);

  // If forceRescan we clear cached descriptors to force re-detect.
  if (forceRescan) {
    await Promise.all(itemIds.map((id: number) => galleryRepository.updateById(id, { faceDescriptors: null })));
  }

  const CHUNK = 10;
  for (let i = 0; i < itemIds.length; i += CHUNK) {
    const slice = itemIds.slice(i, i + CHUNK);
    await scanItemsByIds(slice);
  }
}

export function startGalleryScanWorker() {
  const redis = getRedis();
  if (!redis) {
    console.log('[BullMQ] REDIS_URL not set. Queue worker disabled (fallback to in-process scans).');
    return null;
  }

  const concurrency = Math.max(1, Number(process.env.GALLERY_SCAN_CONCURRENCY || 2));
  const worker = new Worker('gallery.scan', async (job) => {
    const payload = job.data as any;
    await setSyncState(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: 0, total: 0 } as any);

    if (payload?.type === 'upload') {
      // New uploads can alter recognition candidates; refresh in-memory model cache.
      modelCache = null;
      modelCacheTime = 0;
      const itemIds: number[] = Array.isArray(payload.itemIds) ? payload.itemIds : [];
      await setSyncState(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: 0, total: itemIds.length } as any);
      let done = 0;
      const CHUNK = 10;
      for (let i = 0; i < itemIds.length; i += CHUNK) {
        const slice = itemIds.slice(i, i + CHUNK);
        await scanItemsByIds(slice);
        done += slice.length;
        await setSyncState(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: done, total: itemIds.length } as any);
      }
    } else if (payload?.type === 'refresh') {
      modelCache = null;
      modelCacheTime = 0;
      const forceRescan = Boolean(payload.forceRescan);
      // total is approximate (all real items)
      const allItems = await galleryRepository.findAll();
      const realItems = allItems.filter((i: any) => !i.isProfile && i.url);
      await setSyncState(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: 0, total: realItems.length } as any);
      await refreshAll(forceRescan);
    }

    await setSyncState(redis, { isScanning: false, stage: 'idle', message: 'Done' } as any);
    return { ok: true };
  }, { connection: redis, concurrency });

  worker.on('failed', async (job, err) => {
    console.error('[BullMQ] gallery.scan failed:', err?.message || err);
    try { await setSyncState(redis, { isScanning: false }); } catch { }
  });

  console.log(`[BullMQ] gallery.scan worker started (concurrency=${concurrency})`);
  return worker;
}

