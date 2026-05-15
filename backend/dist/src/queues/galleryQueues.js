"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGalleryScanQueue = getGalleryScanQueue;
exports.getGalleryPreprocessQueue = getGalleryPreprocessQueue;
exports.getGalleryRefreshQueue = getGalleryRefreshQueue;
const bullmq_1 = require("bullmq");
const redis_1 = require("./redis");
function getGalleryScanQueue() {
    const redis = (0, redis_1.getRedis)();
    if (!redis)
        return null;
    return new bullmq_1.Queue('gallery.scan', { connection: redis });
}
function getGalleryPreprocessQueue() {
    const redis = (0, redis_1.getRedis)();
    if (!redis)
        return null;
    return new bullmq_1.Queue('gallery.preprocess', { connection: redis });
}
function getGalleryRefreshQueue() {
    const redis = (0, redis_1.getRedis)();
    if (!redis)
        return null;
    return new bullmq_1.Queue('gallery.refresh', { connection: redis });
}
//# sourceMappingURL=galleryQueues.js.map