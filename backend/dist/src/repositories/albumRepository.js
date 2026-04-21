"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../config/prisma"));
const albumRepository = {
    async create(data) {
        return prisma_1.default.album.create({
            data: {
                title: data.title,
                description: data.description,
                isGlobal: data.isGlobal ?? true,
                userId: data.userId,
                items: {
                    connect: data.itemIds.map(id => ({ id })),
                },
            },
            include: {
                items: true,
            },
        });
    },
    findById(id) {
        return prisma_1.default.album.findUnique({
            where: { id },
            include: {
                items: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
    },
    findByShareId(shareId) {
        return prisma_1.default.album.findUnique({
            where: { shareId },
            include: {
                items: true,
                user: {
                    select: {
                        name: true,
                    },
                },
            },
        });
    },
    findAllByUserId(userId) {
        return prisma_1.default.album.findMany({
            where: {
                OR: [
                    { userId },
                    { isGlobal: true }
                ]
            },
            include: {
                items: {
                    take: 1, // To get a cover image
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
            },
        });
    },
};
exports.default = albumRepository;
//# sourceMappingURL=albumRepository.js.map