"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../config/prisma"));
const galleryRepository = {
    findAllLight() {
        return prisma_1.default.galleryItem.findMany({
            select: {
                id: true,
                url: true,
                uploadedAt: true,
                isProfile: true,
                userId: true,
                recognizedUserIds: true,
                scanStatus: true,
                metadataStatus: true,
                hashtags: {
                    select: { name: true }
                },
                metadata: {
                    select: {
                        personCount: true,
                        dominantColor: true,
                        aspectRatio: true,
                        orientation: true,
                        rawJson: true,
                        objects: true,
                        scenes: true,
                        ocrText: true,
                    }
                }
                // faceDescriptors SKIPPED for list performance
            },
            orderBy: { uploadedAt: 'desc' },
        });
    },
    findAll() {
        return prisma_1.default.galleryItem.findMany({
            include: {
                hashtags: true,
                metadata: true,
            },
            orderBy: { uploadedAt: 'desc' },
        });
    },
    findById(id) {
        return prisma_1.default.galleryItem.findUnique({
            where: { id },
            include: {
                hashtags: true,
                metadata: true,
            },
        });
    },
    async findByHashtag(tag) {
        const normalized = tag.toLowerCase().replace(/_/g, ' ');
        // 1. Fetch items that match the hashtag name
        const items = await prisma_1.default.galleryItem.findMany({
            where: {
                OR: [
                    {
                        hashtags: {
                            some: {
                                name: {
                                    equals: tag,
                                    mode: 'insensitive'
                                }
                            }
                        }
                    },
                    {
                        hashtags: {
                            some: {
                                name: {
                                    equals: normalized,
                                    mode: 'insensitive'
                                }
                            }
                        }
                    }
                ]
            },
            include: {
                hashtags: true,
                metadata: true,
            },
            orderBy: { uploadedAt: 'desc' },
        });
        if (items.length > 0)
            return items;
        // 2. Fallback: search JSON fields (objects, scenes, ocrText) across all items
        const allItems = await prisma_1.default.galleryItem.findMany({
            include: {
                hashtags: true,
                metadata: true,
            },
            orderBy: { uploadedAt: 'desc' },
        });
        return allItems.filter((item) => {
            const meta = item.metadata;
            if (!meta)
                return false;
            // Check OCR
            const ocrMatch = (meta.ocrText || []).some((text) => text.toLowerCase().includes(normalized) || text.toLowerCase().includes(tag));
            if (ocrMatch)
                return true;
            // Check Objects
            const objMatch = (meta.objects || []).some((obj) => obj.name?.toLowerCase() === normalized || obj.name?.toLowerCase() === tag);
            if (objMatch)
                return true;
            // Check Scenes
            const sceneMatch = (meta.scenes || []).some((scene) => scene.label?.toLowerCase() === normalized || scene.label?.toLowerCase() === tag);
            return sceneMatch;
        });
    },
    async updateById(id, data) {
        const { hashtags, metadata, objects, scenes, ocrText, ...rest } = data;
        const updateData = { ...rest };
        if (Array.isArray(hashtags)) {
            updateData.hashtags = {
                set: [], // Disconnect previous
                connectOrCreate: hashtags.map((tag) => ({
                    where: { name: tag.toLowerCase().trim() },
                    create: { name: tag.toLowerCase().trim() },
                })),
            };
        }
        if (metadata) {
            const generatedTime = metadata.metadataGeneratedAt ? new Date(metadata.metadataGeneratedAt) : new Date();
            const metadataFields = {
                personCount: metadata.person_count || 0,
                dominantColor: metadata.dominant_color,
                aspectRatio: metadata.aspect_ratio,
                orientation: metadata.orientation,
                rawJson: metadata,
                objects: objects || [],
                scenes: scenes || [],
                ocrText: ocrText || [],
                // Additive Columns mapping (Requirement 1)
                description: metadata.description || metadata.caption || null,
                aiSummary: metadata.aiSummary || metadata.caption || null,
                scene: scenes || [],
                detectedObjects: objects || [],
                hashtags: hashtags || [],
                ocrTextJson: ocrText || [],
                peopleCount: metadata.person_count || 0,
                eventName: metadata.eventName || metadata.customEvent || null,
                location: metadata.location || metadata.customLocation || null,
                generatedAt: generatedTime,
                metadataVersion: 1,
                lastMetaError: metadata.lastMetaError || null,
            };
            updateData.metadata = {
                upsert: {
                    create: metadataFields,
                    update: metadataFields,
                },
            };
        }
        return prisma_1.default.galleryItem.update({
            where: { id },
            data: updateData,
            include: {
                hashtags: true,
                metadata: true,
            },
        });
    },
    createMany(items) {
        // Note: createMany doesn't support nested relations in Prisma.
        // We should use Promise.all(createOne) or refactor if bulk upload is heavy.
        return Promise.all(items.map(item => this.createOne(item)));
    },
    createOne(data) {
        const { hashtags, metadata, label, showInGallery, objects, scenes, ocrText, ...rest } = data;
        // Schema guard: ignore legacy fields that are no longer in Prisma model.
        void label;
        void showInGallery;
        const createData = { ...rest };
        if (Array.isArray(hashtags)) {
            createData.hashtags = {
                connectOrCreate: hashtags.map((tag) => ({
                    where: { name: tag.toLowerCase().trim() },
                    create: { name: tag.toLowerCase().trim() },
                })),
            };
        }
        if (metadata) {
            const generatedTime = metadata.metadataGeneratedAt ? new Date(metadata.metadataGeneratedAt) : new Date();
            createData.metadata = {
                create: {
                    personCount: metadata.person_count || 0,
                    dominantColor: metadata.dominant_color,
                    aspectRatio: metadata.aspect_ratio,
                    orientation: metadata.orientation,
                    rawJson: metadata,
                    objects: objects || [],
                    scenes: scenes || [],
                    ocrText: ocrText || [],
                    // Additive Columns (Requirement 1)
                    description: metadata.description || metadata.caption || null,
                    aiSummary: metadata.aiSummary || metadata.caption || null,
                    scene: scenes || [],
                    detectedObjects: objects || [],
                    hashtags: hashtags || [],
                    ocrTextJson: ocrText || [],
                    peopleCount: metadata.person_count || 0,
                    eventName: metadata.eventName || metadata.customEvent || null,
                    location: metadata.location || metadata.customLocation || null,
                    generatedAt: generatedTime,
                    metadataVersion: 1,
                    lastMetaError: metadata.lastMetaError || null,
                },
            };
        }
        return prisma_1.default.galleryItem.create({
            data: createData,
            include: {
                hashtags: true,
                metadata: true,
            },
        });
    },
    deleteById(id) {
        return prisma_1.default.galleryItem.delete({
            where: { id },
        });
    },
    hideOldProfilePictures(userId) {
        // Note: Profile pictures are usually hidden by setting a flag or deleting.
        // Assuming showInGallery was removed or handled differently now.
        // Based on the new schema, I should probably just untag them as profile if needed.
        return prisma_1.default.galleryItem.updateMany({
            where: { userId, isProfile: true },
            data: { isProfile: false },
        });
    },
    getAllUniqueHashtags() {
        return prisma_1.default.hashtag.findMany({
            orderBy: { name: 'asc' },
        });
    },
};
exports.default = galleryRepository;
//# sourceMappingURL=galleryRepository.js.map