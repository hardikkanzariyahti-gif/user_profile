"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startGalleryPreprocessWorker = startGalleryPreprocessWorker;
const bullmq_1 = require("bullmq");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
const prisma_1 = __importDefault(require("../config/prisma"));
const constants_1 = require("../config/constants");
const redis_1 = require("../queues/redis");
const galleryQueues_1 = require("../queues/galleryQueues");
const syncStateStore_1 = require("../queues/syncStateStore");
const galleryRepository_1 = __importDefault(require("../repositories/galleryRepository"));
const OPT_DIR = path.join(constants_1.UPLOADS_DIR, 'optimized');
const THUMB_DIR = path.join(constants_1.UPLOADS_DIR, 'thumbs');
function ensureDirs() {
    if (!fs.existsSync(OPT_DIR))
        fs.mkdirSync(OPT_DIR, { recursive: true });
    if (!fs.existsSync(THUMB_DIR))
        fs.mkdirSync(THUMB_DIR, { recursive: true });
}
function fileForUrl(url) {
    return path.join(constants_1.UPLOADS_DIR, url.split('/').pop() || '');
}
function optimizedPathForUrl(url) {
    return path.join(OPT_DIR, url.split('/').pop() || '');
}
function thumbPathForUrl(url, size) {
    const name = (url.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
    return path.join(THUMB_DIR, `${name}_${size}.jpg`);
}
async function preprocessOne(url) {
    const src = fileForUrl(url);
    if (!fs.existsSync(src))
        return;
    ensureDirs();
    const opt = optimizedPathForUrl(url);
    const t256 = thumbPathForUrl(url, 256);
    const t512 = thumbPathForUrl(url, 512);
    // Optimized image for AI (balanced: speed + face detail)
    await (0, sharp_1.default)(src)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(opt);
    // Thumbnails for UI (future use; doesn't break current UI)
    await (0, sharp_1.default)(src)
        .rotate()
        .resize({ width: 256, height: 256, fit: 'cover' })
        .jpeg({ quality: 75, mozjpeg: true })
        .toFile(t256);
    await (0, sharp_1.default)(src)
        .rotate()
        .resize({ width: 512, height: 512, fit: 'cover' })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(t512);
}
function startGalleryPreprocessWorker() {
    const redis = (0, redis_1.getRedis)();
    if (!redis) {
        console.log('[BullMQ] REDIS_URL not set. Preprocess worker disabled.');
        return null;
    }
    const scanQueue = (0, galleryQueues_1.getGalleryScanQueue)();
    if (!scanQueue) {
        console.log('[BullMQ] gallery.scan queue unavailable.');
        return null;
    }
    const concurrency = Math.max(1, Number(process.env.GALLERY_PREPROCESS_CONCURRENCY || 4));
    const worker = new bullmq_1.Worker('gallery.preprocess', async (job) => {
        const payload = job.data;
        if (payload?.type === 'upload') {
            const itemIds = Array.isArray(payload.itemIds) ? payload.itemIds : [];
            // Keep UI contract: show scan total as number of items (scan worker will advance current).
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: itemIds.length });
            const items = await prisma_1.default.galleryItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, url: true } });
            let done = 0;
            const CHUNK = 20;
            for (let i = 0; i < items.length; i += CHUNK) {
                const slice = items.slice(i, i + CHUNK);
                await Promise.all(slice.map((it) => preprocessOne(it.url)));
                done += slice.length;
                await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: done, total: itemIds.length });
            }
            await scanQueue.add('scan', { type: 'upload', itemIds }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 1 });
            return { ok: true };
        }
        if (payload?.type === 'refresh') {
            const forceRescan = Boolean(payload.forceRescan);
            const allItems = await galleryRepository_1.default.findAll();
            const realItems = allItems.filter((i) => !i.isProfile && i.url);
            const itemIds = realItems.map((i) => i.id);
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: 0, total: itemIds.length });
            const CHUNK = 20;
            let done = 0;
            for (let i = 0; i < realItems.length; i += CHUNK) {
                const slice = realItems.slice(i, i + CHUNK);
                await Promise.all(slice.map((it) => preprocessOne(it.url)));
                done += slice.length;
                await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'preprocess', message: 'Preparing images…', current: done, total: itemIds.length });
            }
            await scanQueue.add('scan', { type: 'refresh', forceRescan }, { jobId: `gallery:scan-refresh:${forceRescan ? 'force' : 'soft'}`, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, removeOnFail: 50, priority: 5 });
            return { ok: true, forceRescan };
        }
        return { ok: false };
    }, { connection: redis, concurrency });
    worker.on('failed', async (job, err) => {
        console.error('[BullMQ] gallery.preprocess failed:', err?.message || err);
        try {
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: false });
        }
        catch { }
    });
    console.log(`[BullMQ] gallery.preprocess worker started (concurrency=${concurrency})`);
    return worker;
}
//# sourceMappingURL=galleryPreprocessWorker.js.map