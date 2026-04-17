"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const galleryService_1 = require("../services/galleryService");
const galleryController = {
    async list(req, res) {
        const gallery = await galleryService_1.galleryService.listGallery(req.query.userId);
        res.json(gallery);
    },
    async upload(req, res) {
        const gallery = await galleryService_1.galleryService.uploadGallery(req.files || [], req.query.userId);
        res.json(gallery);
    },
    async refreshRecognition(req, res) {
        // forceRescan=true clears all cached face descriptors and re-processes
        // every photo with the improved detector. Pass ?forceRescan=true in URL.
        const forceRescan = req.query.forceRescan === 'true' || req.body?.forceRescan === true;
        const result = await galleryService_1.galleryService.refreshGalleryRecognition(forceRescan);
        res.json(result);
    },
    async tagFace(req, res) {
        const galleryItemId = Number(req.body.galleryItemId);
        const userId = Number(req.body.userId);
        if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
            res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
            return;
        }
        const result = await galleryService_1.galleryService.tagUnknownFace(galleryItemId, userId);
        res.json(result);
    },
    async untagFace(req, res) {
        const galleryItemId = Number(req.body.galleryItemId);
        const userId = Number(req.body.userId);
        if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
            res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
            return;
        }
        const result = await galleryService_1.galleryService.untagFace(galleryItemId, userId);
        res.json(result);
    },
};
exports.default = galleryController;
//# sourceMappingURL=galleryController.js.map