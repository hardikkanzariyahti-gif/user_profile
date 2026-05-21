"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.albumController = void 0;
const albumService_1 = __importDefault(require("../services/albumService"));
exports.albumController = {
    async create(req, res) {
        const { title, description, eventType, date, location, itemIds, isGlobal } = req.body;
        const userId = Number(req.query.userId || req.body.userId) || 0;
        try {
            const album = await albumService_1.default.createAlbum({ title, description, eventType, date, location, userId, itemIds, isGlobal });
            res.status(201).json(album);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async list(req, res) {
        const userId = Number(req.query.userId) || 0;
        try {
            const albums = await albumService_1.default.getAlbumsByUser(userId);
            res.json(albums);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async getById(req, res) {
        const userId = Number(req.query.userId);
        const id = Number(req.params.id);
        try {
            const album = await albumService_1.default.getAlbumById(id, userId);
            res.json(album);
        }
        catch (error) {
            res.status(404).json({ error: error.message });
        }
    },
    async getShared(req, res) {
        const { shareId } = req.params;
        try {
            const album = await albumService_1.default.getSharedAlbum(shareId);
            res.json(album);
        }
        catch (error) {
            res.status(404).json({ error: error.message });
        }
    },
    async remove(req, res) {
        const userId = Number(req.query.userId);
        const id = Number(req.params.id);
        try {
            await albumService_1.default.deleteAlbum(id, userId);
            res.json({ message: 'Album deleted successfully' });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
    async update(req, res) {
        const userId = Number(req.query.userId);
        const id = Number(req.params.id);
        const { title, description, eventType, date, location, itemIds } = req.body;
        try {
            const album = await albumService_1.default.updateAlbum(id, userId, { title, description, eventType, date, location, itemIds });
            res.json(album);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    },
};
exports.default = exports.albumController;
//# sourceMappingURL=albumController.js.map