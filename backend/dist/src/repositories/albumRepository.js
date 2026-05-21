"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../config/prisma"));
const albumRepository = {
    async create(data) {
        const itemIds = data.itemIds || [];
        return prisma_1.default.album.create({
            data: {
                title: data.title,
                description: data.description,
                eventType: data.eventType,
                date: data.date,
                location: data.location,
                isGlobal: data.isGlobal ?? true,
                userId: data.userId,
                items: itemIds.length > 0 ? {
                    connect: itemIds.map(id => ({ id })),
                } : undefined,
            },
            include: {
                items: true,
            },
        });
    },
    async findById(id) {
        const [album, items] = await Promise.all([
            prisma_1.default.album.findUnique({
                where: { id },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma_1.default.galleryItem.findMany({
                where: {
                    albums: { some: { id } }
                },
                include: {
                    metadata: true,
                    hashtags: true,
                },
                orderBy: { uploadedAt: 'desc' }
            })
        ]);
        if (!album)
            return null;
        return {
            ...album,
            items
        };
    },
    async findByShareId(shareId) {
        const album = await prisma_1.default.album.findUnique({
            where: { shareId },
            include: {
                user: {
                    select: {
                        name: true,
                    },
                },
            },
        });
        if (!album)
            return null;
        const items = await prisma_1.default.galleryItem.findMany({
            where: {
                albums: { some: { id: album.id } }
            },
            include: {
                metadata: true,
                hashtags: true,
            },
            orderBy: { uploadedAt: 'desc' }
        });
        return {
            ...album,
            items
        };
    },
    findAllByUserId(userId) {
        return prisma_1.default.album.findMany({
            include: {
                items: {
                    include: {
                        metadata: true,
                        hashtags: true,
                        people: true,
                    }
                },
                user: {
                    select: { name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
    },
    delete(id) {
        return prisma_1.default.album.delete({
            where: { id },
        });
    },
    update(id, data) {
        return prisma_1.default.album.update({
            where: { id },
            data: {
                title: data.title,
                description: data.description,
                eventType: data.eventType,
                date: data.date,
                location: data.location,
                items: data.itemIds ? {
                    set: data.itemIds.map(itemId => ({ id: itemId })),
                } : undefined,
            },
            include: {
                items: {
                    include: {
                        metadata: true,
                        hashtags: true,
                        people: true,
                    }
                },
            },
        });
    },
};
exports.default = albumRepository;
//# sourceMappingURL=albumRepository.js.map