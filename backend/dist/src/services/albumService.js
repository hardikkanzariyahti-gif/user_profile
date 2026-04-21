"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const albumRepository_1 = __importDefault(require("../repositories/albumRepository"));
const albumService = {
    async createAlbum(data) {
        if (!data.title)
            throw new Error('Album title is required');
        if (!data.itemIds || data.itemIds.length === 0)
            throw new Error('At least one photo is required to create an album');
        return albumRepository_1.default.create(data);
    },
    async getAlbumsByUser(userId) {
        return albumRepository_1.default.findAllByUserId(userId);
    },
    async getAlbumById(id, userId) {
        const album = await albumRepository_1.default.findById(id);
        if (!album)
            throw new Error('Album not found');
        if (album.userId !== userId && !album.isGlobal)
            throw new Error('Unauthorized access to album');
        return album;
    },
    async getSharedAlbum(shareId) {
        const album = await albumRepository_1.default.findByShareId(shareId);
        if (!album)
            throw new Error('Shared album not found');
        return album;
    },
    async deleteAlbum(id, userId) {
        const album = await albumRepository_1.default.findById(id);
        if (!album)
            throw new Error('Album not found');
        if (album.userId !== userId)
            throw new Error('Unauthorized to delete this album');
        return albumRepository_1.default.delete(id);
    },
    async updateAlbum(id, userId, data) {
        const album = await albumRepository_1.default.findById(id);
        if (!album)
            throw new Error('Album not found');
        if (album.userId !== userId)
            throw new Error('Unauthorized to update this album');
        return albumRepository_1.default.update(id, data);
    },
};
exports.default = albumService;
//# sourceMappingURL=albumService.js.map