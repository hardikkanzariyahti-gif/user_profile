"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../config/prisma"));
const galleryRepository = {
    findAll() {
        return prisma_1.default.galleryItem.findMany({
            orderBy: { uploadedAt: 'desc' },
        });
    },
    findById(id) {
        return prisma_1.default.galleryItem.findUnique({
            where: { id },
        });
    },
    findByHashtag(tag) {
        return prisma_1.default.galleryItem.findMany({
            where: {
                hashtags: { has: tag },
            },
            orderBy: { uploadedAt: 'desc' },
        });
    },
    updateById(id, data) {
        return prisma_1.default.galleryItem.update({
            where: { id },
            data,
        });
    },
    createMany(items) {
        return prisma_1.default.galleryItem.createMany({ data: items });
    },
    createOne(data) {
        return prisma_1.default.galleryItem.create({ data });
    },
};
exports.default = galleryRepository;
//# sourceMappingURL=galleryRepository.js.map