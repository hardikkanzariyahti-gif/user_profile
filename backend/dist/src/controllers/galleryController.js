"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const galleryService_1 = require("../services/galleryService");
const galleryController = {
    async list(req, res) {
        const gallery = await galleryService_1.galleryService.listGallery(req.query.userId);
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
    async searchByHashtag(req, res) {
        const tag = String(req.query.tag ?? '');
        const results = await galleryService_1.galleryService.searchGalleryByHashtag(tag);
        res.json(results);
    },
    async upload(req, res) {
        const gallery = await galleryService_1.galleryService.uploadGallery(req.files || [], req.query.userId);
        res.json(gallery);
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
        res.json(galleryService_1.galleryService.syncState);
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
};
exports.default = galleryController;
//# sourceMappingURL=galleryController.js.map