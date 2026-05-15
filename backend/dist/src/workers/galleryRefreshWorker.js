"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGalleryRefreshWorker = startGalleryRefreshWorker;
const bullmq_1 = require("bullmq");
const redis_1 = require("../queues/redis");
const galleryQueues_1 = require("../queues/galleryQueues");
const syncStateStore_1 = require("../queues/syncStateStore");
function startGalleryRefreshWorker() {
    const redis = (0, redis_1.getRedis)();
    if (!redis) {
        console.log('[BullMQ] REDIS_URL not set. Refresh worker disabled.');
        return null;
    }
    const preprocessQueue = (0, galleryQueues_1.getGalleryPreprocessQueue)();
    if (!preprocessQueue) {
        console.log('[BullMQ] gallery.preprocess queue unavailable for refresh worker.');
        return null;
    }
    const concurrency = Math.max(1, Number(process.env.GALLERY_REFRESH_CONCURRENCY || 1));
    const worker = new bullmq_1.Worker('gallery.refresh', async (job) => {
        const payload = job.data;
        const forceRescan = Boolean(payload?.forceRescan);
        await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: 0 });
        await preprocessQueue.add('preprocess', { type: 'refresh', forceRescan }, { jobId: `gallery:refresh-preprocess:${forceRescan ? 'force' : 'soft'}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 5 });
        return { ok: true };
    }, { connection: redis, concurrency });
    worker.on('failed', async (job, err) => {
        console.error('[BullMQ] gallery.refresh failed:', err?.message || err);
        try {
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: false });
        }
        catch { }
    });
    console.log(`[BullMQ] gallery.refresh worker started (concurrency=${concurrency})`);
    return worker;
}
//# sourceMappingURL=galleryRefreshWorker.js.map