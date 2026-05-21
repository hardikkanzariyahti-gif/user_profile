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
Object.defineProperty(exports, "__esModule", { value: true });
const galleryService_1 = require("../services/galleryService");
const galleryController = {
    async list(req, res) {
        const search = String(req.query.search || '');
        const gallery = await galleryService_1.galleryService.listGallery(req.query.userId, search);
        res.json(gallery);
    },
    async getById(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        const item = await galleryService_1.galleryService.getGalleryItem(id);
        res.json(item);
    },
    async getStatus(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        const item = await galleryService_1.galleryService.getGalleryItem(id);
        // Removed status debug spamming to scale console for 1000+ photos
        res.json({
            ...item,
            imageId: item.id,
            scanStatus: item.scanStatus || 'pending',
        });
    },
    async remove(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        const result = await galleryService_1.galleryService.deleteGalleryItem(id);
        res.json(result);
    },
    async setHashtags(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        const hashtags = req.body?.hashtags ?? req.body?.tags ?? req.body;
        const item = await galleryService_1.galleryService.setGalleryItemHashtags(id, hashtags);
        res.json(item);
    },
    async setCustomMetadata(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        const customLocation = String(req.body?.customLocation ?? '');
        const customEvent = String(req.body?.customEvent ?? '');
        const item = await galleryService_1.galleryService.setGalleryItemCustomMetadata(id, customLocation, customEvent);
        res.json(item);
    },
    async searchByHashtag(req, res) {
        const tag = String(req.query.tag ?? '');
        const results = await galleryService_1.galleryService.searchGalleryByHashtag(tag);
        res.json(results);
    },
    async upload(req, res) {
        const isEventUpload = req.body?.isEventUpload === 'true';
        const eventName = req.body?.eventName;
        const eventId = req.body?.eventId ? Number(req.body.eventId) : undefined;
        const location = req.body?.eventLocation;
        const date = req.body?.eventDate;
        const description = req.body?.eventDescription;
        let tags = undefined;
        if (req.body?.tags) {
            if (Array.isArray(req.body.tags)) {
                tags = req.body.tags;
            }
            else if (typeof req.body.tags === 'string') {
                tags = req.body.tags
                    .split(',')
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean);
            }
        }
        const eventInfo = (isEventUpload || eventName || eventId || location || date || description || tags) ? {
            eventName: eventName || undefined,
            location: location || undefined,
            date: date || undefined,
            description: description || undefined,
            eventId: eventId || undefined,
            tags: tags || undefined
        } : undefined;
        const result = await galleryService_1.galleryService.uploadGallery(req.files || [], req.query.userId, eventInfo);
        if (typeof result === 'object' && result !== null && 'gallery' in result && 'suggestions' in result) {
            res.json(result);
        }
        else {
            res.json(result);
        }
    },
    async refreshRecognition(req, res) {
        const forceRescan = req.query.forceRescan === 'true' || req.body?.forceRescan === true;
        // Start it in the background to prevent V8 memory crashes and Browser timeouts for large lists
        galleryService_1.galleryService.refreshGalleryRecognition(forceRescan).catch(err => {
            console.error('Background Sync Error:', err);
        });
        res.status(202).json({ message: 'Background sync started', status: galleryService_1.galleryService.syncState });
    },
    async syncStatus(req, res) {
        // If Redis queue is enabled, status may be maintained by workers.
        try {
            const { getRedis } = await Promise.resolve().then(() => __importStar(require('../queues/redis')));
            const { getSyncState } = await Promise.resolve().then(() => __importStar(require('../queues/syncStateStore')));
            const redis = getRedis();
            if (redis) {
                const state = await getSyncState(redis);
                res.json(state);
                return;
            }
        }
        catch { }
        res.json(galleryService_1.galleryService.syncState);
    },
    async getProcessingStatus(req, res) {
        const status = await galleryService_1.galleryService.getProcessingStatus();
        res.json(status);
    },
    async syncEvents(req, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        // Helps if behind proxies.
        res.setHeader('X-Accel-Buffering', 'no');
        const send = (payload) => {
            res.write(`event: sync\n`);
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        };
        const getState = async () => {
            try {
                const { getRedis } = await Promise.resolve().then(() => __importStar(require('../queues/redis')));
                const { getSyncState } = await Promise.resolve().then(() => __importStar(require('../queues/syncStateStore')));
                const redis = getRedis();
                if (redis)
                    return await getSyncState(redis);
            }
            catch { }
            return galleryService_1.galleryService.syncState;
        };
        // Send current state immediately.
        send(await getState());
        const interval = setInterval(() => {
            void getState().then(send);
        }, 1000);
        req.on('close', () => {
            clearInterval(interval);
            res.end();
        });
    },
    async tagFace(req, res) {
        const galleryItemId = Number(req.body.galleryItemId);
        const userId = Number(req.body.userId);
        if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
            res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
            return;
        }
        const faceIndex = req.body.faceIndex !== undefined ? Number(req.body.faceIndex) : undefined;
        const result = await galleryService_1.galleryService.tagUnknownFace(galleryItemId, userId, faceIndex);
        res.json(result);
    },
    async untagFace(req, res) {
        const galleryItemId = Number(req.body.galleryItemId);
        const userId = Number(req.body.userId);
        if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
            res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
            return;
        }
        const faceIndex = req.body.faceIndex !== undefined ? Number(req.body.faceIndex) : undefined;
        const result = await galleryService_1.galleryService.untagFace(galleryItemId, userId, faceIndex);
        res.json(result);
    },
    async getClusters(req, res) {
        const clusters = await galleryService_1.galleryService.getUnknownFaceClusters();
        res.json(clusters);
    },
    async mergeCluster(req, res) {
        const userId = Number(req.body.userId);
        const faces = req.body.faces;
        if (!userId || isNaN(userId) || !Array.isArray(faces)) {
            res.status(400).json({ error: 'userId and faces array are required.' });
            return;
        }
        const result = await galleryService_1.galleryService.mergeClusterFaces(userId, faces);
        res.json(result);
    },
    async setProfilePictureFromGalleryItem(req, res) {
        const galleryItemId = Number(req.body.galleryItemId);
        const userId = Number(req.body.userId);
        if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
            res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
            return;
        }
        const result = await galleryService_1.galleryService.setProfilePictureFromGalleryItem(userId, galleryItemId);
        res.json(result);
    },
    async ignoreCluster(req, res) {
        const faces = req.body.faces;
        if (!Array.isArray(faces)) {
            res.status(400).json({ error: 'faces array is required.' });
            return;
        }
        const result = await galleryService_1.galleryService.ignoreClusterFaces(faces);
        res.json(result);
    },
    async resetIgnored(req, res) {
        const result = await galleryService_1.galleryService.resetIgnoredFaces();
        res.json(result);
    },
    async getTagSuggestions(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        const suggestions = await galleryService_1.galleryService.getTagSuggestions(id);
        res.json(suggestions);
    },
    async getAllHashtags(req, res) {
        const hashtags = await galleryService_1.galleryService.getAllHashtags();
        res.json(hashtags);
    },
    async getSuggestions(req, res) {
        const q = String(req.query.q || '');
        const suggestions = await galleryService_1.galleryService.getSearchSuggestions(q);
        res.json(suggestions);
    },
    async forceScan(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        const result = await galleryService_1.galleryService.forceScanItem(id);
        res.json(result);
    },
    async metadataRetry(req, res) {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            res.status(400).json({ error: 'Valid gallery id is required.' });
            return;
        }
        // Use unified process pipeline passing forceScan=false, forceMeta=true (Requirement 7)
        galleryService_1.galleryService.processGalleryImage(id, false, true).catch(err => console.error('[Retry Fail]', err));
        res.json({ success: true, message: 'Integrated metadata extraction cycle initialized.' });
    },
    async backfillMetadata(req, res) {
        const force = req.body?.force === true;
        console.log(`[Backfill API] POST /metadata/backfill — force=${force}`);
        const result = await galleryService_1.galleryService.backfillMissingMetadata(force);
        // 202 = accepted / running, 200 = already done/nothing to do
        const status = result.running ? 202 : 200;
        res.status(status).json(result);
    },
    async getBackfillStatus(req, res) {
        const status = galleryService_1.galleryService.getBackfillStatus();
        res.json(status);
    },
    async bulkTagAndAlbum(req, res) {
        const itemIds = req.body.itemIds;
        const targetUserId = req.body.targetUserId ? Number(req.body.targetUserId) : null;
        const targetTagName = req.body.targetTagName ? String(req.body.targetTagName).trim() : null;
        const currentUserId = Number(req.body.currentUserId);
        if (!Array.isArray(itemIds) || itemIds.length === 0 || isNaN(currentUserId)) {
            res.status(400).json({ error: 'itemIds (array) and currentUserId are required inputs.' });
            return;
        }
        if (!targetUserId && !targetTagName) {
            res.status(400).json({ error: 'Either targetUserId or targetTagName must be provided.' });
            return;
        }
        try {
            const result = await galleryService_1.galleryService.bulkTagAndAlbum(itemIds, targetUserId, currentUserId, targetTagName);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'An error occurred during bulk processing.' });
        }
    },
    async cancelProcessing(req, res) {
        try {
            const result = await galleryService_1.galleryService.cancelProcessing();
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'An error occurred while cancelling background processing.' });
        }
    },
};
exports.default = galleryController;
//# sourceMappingURL=galleryController.js.map