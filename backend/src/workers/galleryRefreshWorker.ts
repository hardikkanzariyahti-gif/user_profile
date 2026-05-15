import { Worker } from 'bullmq';
import { getRedis } from '../queues/redis';
import { getGalleryPreprocessQueue } from '../queues/galleryQueues';
import { setSyncState } from '../queues/syncStateStore';

export function startGalleryRefreshWorker() {
  const redis = getRedis();
  if (!redis) {
    console.log('[BullMQ] REDIS_URL not set. Refresh worker disabled.');
    return null;
  }

  const preprocessQueue = getGalleryPreprocessQueue();
  if (!preprocessQueue) {
    console.log('[BullMQ] gallery.preprocess queue unavailable for refresh worker.');
    return null;
  }

  const concurrency = Math.max(1, Number(process.env.GALLERY_REFRESH_CONCURRENCY || 1));

  const worker = new Worker('gallery.refresh', async (job) => {
    const payload = job.data as any;
    const forceRescan = Boolean(payload?.forceRescan);

    await setSyncState(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: 0 } as any);
    await preprocessQueue.add(
      'preprocess',
      { type: 'refresh', forceRescan },
      { jobId: `gallery:refresh-preprocess:${forceRescan ? 'force' : 'soft'}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 5 }
    );

    return { ok: true };
  }, { connection: redis, concurrency });

  worker.on('failed', async (job, err) => {
    console.error('[BullMQ] gallery.refresh failed:', err?.message || err);
    try { await setSyncState(redis, { isScanning: false }); } catch {}
  });

  console.log(`[BullMQ] gallery.refresh worker started (concurrency=${concurrency})`);
  return worker;
}

