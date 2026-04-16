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
};
exports.default = galleryController;
//# sourceMappingURL=galleryController.js.map