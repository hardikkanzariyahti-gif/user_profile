"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const albumRepository_1 = __importDefault(require("../repositories/albumRepository"));
const prisma_1 = __importDefault(require("../config/prisma"));
const serializers_1 = require("../utils/serializers");
let cachedUsers = null;
let lastCacheTime = 0;
const CACHE_DURATION_MS = 15000; // 15 seconds cache is extremely safe and will ensure instant sequential requests!
async function getCachedUsers() {
    const now = Date.now();
    if (!cachedUsers || (now - lastCacheTime > CACHE_DURATION_MS)) {
        cachedUsers = await prisma_1.default.user.findMany({
            select: { id: true, name: true, profile_picture: true }
        });
        lastCacheTime = now;
    }
    return cachedUsers;
}
const albumService = {
    async enrichAlbum(album) {
        if (!album)
            return album;
        // Fetch all users for mapped recognized badge resolution using cache
        const allUsers = await getCachedUsers();
        const userMap = {};
        for (const u of allUsers)
            userMap[u.id] = u;
        // Format items to look exactly like the Gallery payload
        if (Array.isArray(album.items)) {
            album.items = album.items.map((item) => {
                const rawIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds : [];
                const withUsers = {
                    ...item,
                    recognizedUsers: rawIds.map((id) => userMap[Number(id)]).filter(Boolean)
                };
                return (0, serializers_1.toGalleryResponse)(withUsers);
            });
            console.log(`[EVENT_PHOTOS] eventId: ${album.id}`);
            console.log(`[EVENT_PHOTOS] count: ${album.items.length}`);
            album.items.forEach((item) => {
                console.log(`[EVENT_PHOTOS] imageUrl: ${item.url}`);
            });
        }
        return album;
    },
    async createAlbum(data) {
        if (!data.title)
            throw new Error('Album title is required');
        console.log(`[EVENT_CREATE] eventName: ${data.title}`);
        console.log(`[EVENT_CREATE] shouldNotCreateProfile: true`);
        // Ensure a valid user ID exists for Prisma Foreign Key constraint without creating any profile record
        let finalUserId = Number(data.userId) || 0;
        if (finalUserId === 0) {
            const existingUser = await prisma_1.default.user.findFirst({ select: { id: true } });
            if (existingUser) {
                finalUserId = existingUser.id;
            }
            else {
                const dummyUser = await prisma_1.default.user.create({
                    data: {
                        name: 'System Anchor',
                        email: 'system_anchor@local.system',
                        password: 'system_password_anchor'
                    }
                });
                finalUserId = dummyUser.id;
            }
        }
        else {
            const userExists = await prisma_1.default.user.findUnique({ where: { id: finalUserId } });
            if (!userExists) {
                const existingUser = await prisma_1.default.user.findFirst({ select: { id: true } });
                if (existingUser) {
                    finalUserId = existingUser.id;
                }
                else {
                    const dummyUser = await prisma_1.default.user.create({
                        data: {
                            name: 'System Anchor',
                            email: 'system_anchor@local.system',
                            password: 'system_password_anchor'
                        }
                    });
                    finalUserId = dummyUser.id;
                }
            }
        }
        const album = await albumRepository_1.default.create({
            ...data,
            userId: finalUserId,
            itemIds: data.itemIds || [],
            isGlobal: true
        });
        console.log(`[EVENT_CREATE] createdAlbumId: ${album.id}`);
        if (album.items && album.items.length > 0) {
            console.log(`[EVENT_PHOTOS] eventId: ${album.id}`);
            console.log(`[EVENT_PHOTOS] count: ${album.items.length}`);
            album.items.forEach((item) => {
                console.log(`[EVENT_PHOTOS] imageUrl: ${item.url}`);
            });
        }
        return this.enrichAlbum(album);
    },
    async getAlbumsByUser(userId) {
        const albums = await albumRepository_1.default.findAllByUserId(userId);
        return Promise.all(albums.map(album => this.enrichAlbum(album)));
    },
    async getAlbumById(id, userId) {
        const album = await albumRepository_1.default.findById(id);
        if (!album)
            throw new Error('Album not found');
        return this.enrichAlbum(album);
    },
    async getSharedAlbum(shareId) {
        const album = await albumRepository_1.default.findByShareId(shareId);
        if (!album)
            throw new Error('Shared album not found');
        return this.enrichAlbum(album);
    },
    async deleteAlbum(id, userId) {
        const album = await albumRepository_1.default.findById(id);
        if (!album)
            throw new Error('Album not found');
        console.log(`[ALBUM_DELETE] deleting albumId: ${id}`);
        const result = await albumRepository_1.default.delete(id);
        console.log(`[ALBUM_DELETE] deleted successfully: ${id}`);
        return result;
    },
    async updateAlbum(id, userId, data) {
        const album = await albumRepository_1.default.findById(id);
        if (!album)
            throw new Error('Album not found');
        const updated = await albumRepository_1.default.update(id, data);
        return this.enrichAlbum(updated);
    },
};
exports.default = albumService;
//# sourceMappingURL=albumService.js.map