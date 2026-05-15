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
exports.startGalleryScanWorker = startGalleryScanWorker;
const bullmq_1 = require("bullmq");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const constants_1 = require("../config/constants");
const galleryRepository_1 = __importDefault(require("../repositories/galleryRepository"));
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const redis_1 = require("../queues/redis");
const syncStateStore_1 = require("../queues/syncStateStore");
const OPT_DIR = path.join(constants_1.UPLOADS_DIR, 'optimized');
const MODEL_CACHE_TTL_MS = 3 * 60 * 1000;
let modelCache = null;
let modelCacheTime = 0;
function pickScanPath(url) {
    const name = url.split('/').pop() || '';
    const opt = path.join(OPT_DIR, name);
    if (fs.existsSync(opt))
        return opt;
    return path.join(constants_1.UPLOADS_DIR, name);
}
function parseUserId(label) {
    try {
        return Number(JSON.parse(label).id);
    }
    catch {
        return null;
    }
}
async function buildModel() {
    const now = Date.now();
    if (modelCache && (now - modelCacheTime) < MODEL_CACHE_TTL_MS)
        return modelCache;
    const allUsers = await userRepository_1.default.findAllForRecognition();
    // Lazy import to avoid circular dependency issues.
    const { buildLabeledDescriptors } = await Promise.resolve().then(() => __importStar(require('../services/galleryService')));
    modelCache = await buildLabeledDescriptors(allUsers);
    modelCacheTime = Date.now();
    return modelCache;
}
async function scanItemsByIds(itemIds) {
    const { default: galleryService } = await Promise.resolve().then(() => __importStar(require('../services/galleryService')));
    // Process sequential but concurrently in chunks
    const tasks = itemIds.map((id) => async () => {
        console.log(`[Queue Worker] Processing imageId ${id}...`);
        try {
            // 🚀 [Required Fix 1] - Channel through the absolute unified pipeline logic for strict functional parity
            await galleryService.processGalleryImage(id);
        }
        catch (err) {
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
async function refreshAll(forceRescan) {
    const allItems = await galleryRepository_1.default.findAll();
    const realItems = allItems.filter((i) => !i.isProfile && i.url);
    const itemIds = realItems.map((i) => i.id);
    // If forceRescan we clear cached descriptors to force re-detect.
    if (forceRescan) {
        await Promise.all(itemIds.map((id) => galleryRepository_1.default.updateById(id, { faceDescriptors: null })));
    }
    const CHUNK = 10;
    for (let i = 0; i < itemIds.length; i += CHUNK) {
        const slice = itemIds.slice(i, i + CHUNK);
        await scanItemsByIds(slice);
    }
}
function startGalleryScanWorker() {
    const redis = (0, redis_1.getRedis)();
    if (!redis) {
        console.log('[BullMQ] REDIS_URL not set. Queue worker disabled (fallback to in-process scans).');
        return null;
    }
    const concurrency = Math.max(1, Number(process.env.GALLERY_SCAN_CONCURRENCY || 2));
    const worker = new bullmq_1.Worker('gallery.scan', async (job) => {
        const payload = job.data;
        await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: 0, total: 0 });
        if (payload?.type === 'upload') {
            // New uploads can alter recognition candidates; refresh in-memory model cache.
            modelCache = null;
            modelCacheTime = 0;
            const itemIds = Array.isArray(payload.itemIds) ? payload.itemIds : [];
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: 0, total: itemIds.length });
            let done = 0;
            const CHUNK = 10;
            for (let i = 0; i < itemIds.length; i += CHUNK) {
                const slice = itemIds.slice(i, i + CHUNK);
                await scanItemsByIds(slice);
                done += slice.length;
                await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: done, total: itemIds.length });
            }
        }
        else if (payload?.type === 'refresh') {
            modelCache = null;
            modelCacheTime = 0;
            const forceRescan = Boolean(payload.forceRescan);
            // total is approximate (all real items)
            const allItems = await galleryRepository_1.default.findAll();
            const realItems = allItems.filter((i) => !i.isProfile && i.url);
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: true, stage: 'scan', message: 'Scanning faces…', current: 0, total: realItems.length });
            await refreshAll(forceRescan);
        }
        await (0, syncStateStore_1.setSyncState)(redis, { isScanning: false, stage: 'idle', message: 'Done' });
        return { ok: true };
    }, { connection: redis, concurrency });
    worker.on('failed', async (job, err) => {
        console.error('[BullMQ] gallery.scan failed:', err?.message || err);
        try {
            await (0, syncStateStore_1.setSyncState)(redis, { isScanning: false });
        }
        catch { }
    });
    console.log(`[BullMQ] gallery.scan worker started (concurrency=${concurrency})`);
    return worker;
}
//# sourceMappingURL=galleryScanWorker.js.map