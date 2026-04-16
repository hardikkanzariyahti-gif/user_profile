"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.galleryService = void 0;
exports.buildLabeledDescriptors = buildLabeledDescriptors;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const faceApiLib = __importStar(require("@vladmandic/face-api"));
const faceAi_1 = __importDefault(require("../../faceAi"));
const constants_1 = require("../config/constants");
const galleryRepository_1 = __importDefault(require("../repositories/galleryRepository"));
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const serializers_1 = require("../utils/serializers");
const httpError_1 = __importDefault(require("../utils/httpError"));
const userService_1 = __importDefault(require("./userService"));
async function buildLabeledDescriptors(users) {
    const labeledDescriptors = [];
    for (const user of users) {
        if (!user.profile_picture)
            continue;
        const filename = user.profile_picture.split('/').pop();
        const filePath = path.join(constants_1.UPLOADS_DIR, filename);
        if (!fs.existsSync(filePath))
            continue;
        const descriptor = await faceAi_1.default.getFaceDescriptor(filePath);
        if (!descriptor)
            continue;
        const labelData = JSON.stringify({ id: user.id, name: user.name });
        labeledDescriptors.push(new faceApiLib.LabeledFaceDescriptors(labelData, [descriptor]));
    }
    return labeledDescriptors;
}
function arraysEqual(a = [], b = []) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i])
            return false;
    }
    return true;
}
const galleryService = {
    async listGallery(userId = null) {
        const [galleryItems, usersWithProfilePicture] = await Promise.all([
            galleryRepository_1.default.findAll(),
            userRepository_1.default.findUsersWithProfilePicture(),
        ]);
        const dynamicProfileItems = usersWithProfilePicture.map((u) => ({
            id: `profile-${u.id}`,
            url: u.profile_picture,
            uploadedAt: new Date(0),
            label: `${u.name}'s Profile`,
            isProfile: true,
            userId: u.id,
            recognizedUserIds: [u.id],
        }));
        const merged = [...galleryItems, ...dynamicProfileItems];
        const seenUrls = new Set();
        const uniqueItems = [];
        for (const item of merged) {
            if (!item.url || seenUrls.has(item.url))
                continue;
            const filename = item.url.split('/').pop();
            const filePath = path.join(constants_1.UPLOADS_DIR, filename);
            if (!fs.existsSync(filePath))
                continue;
            seenUrls.add(item.url);
            uniqueItems.push(item);
        }
        uniqueItems.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        let visibleItems = uniqueItems;
        if (userId !== null && userId !== undefined) {
            const normalizedUserId = userService_1.default.normalizeUserId(userId);
            visibleItems = uniqueItems.filter((item) => {
                const ownerId = item.userId != null ? Number(item.userId) : null;
                const recognizedIds = Array.isArray(item.recognizedUserIds)
                    ? item.recognizedUserIds.map((id) => Number(id))
                    : [];
                return ownerId === normalizedUserId || recognizedIds.includes(normalizedUserId);
            });
        }
        const allRecognizedIds = new Set();
        visibleItems.forEach((item) => {
            if (Array.isArray(item.recognizedUserIds)) {
                item.recognizedUserIds.forEach((id) => allRecognizedIds.add(Number(id)));
            }
        });
        const recognizedUsers = allRecognizedIds.size > 0
            ? await userRepository_1.default.findManyByIds(Array.from(allRecognizedIds))
            : [];
        const userMap = recognizedUsers.reduce((acc, user) => {
            acc[user.id] = { id: user.id, name: user.name };
            return acc;
        }, {});
        const enrichedItems = visibleItems.map((item) => {
            const itemRecognizedUsers = Array.isArray(item.recognizedUserIds)
                ? item.recognizedUserIds.map((id) => userMap[Number(id)]).filter(Boolean)
                : [];
            return {
                ...item,
                recognizedUsers: itemRecognizedUsers,
            };
        });
        return enrichedItems.map(serializers_1.toGalleryResponse);
    },
    async uploadGallery(files = [], userId = null) {
        if (!files || files.length === 0) {
            throw (0, httpError_1.default)(400, 'No files uploaded');
        }
        const knownUsers = await userRepository_1.default.findUsersWithProfilePicture();
        const labeledDescriptors = await buildLabeledDescriptors(knownUsers);
        const uploaderId = userId ? Number(userId) : null;
        const items = [];
        for (const file of files) {
            let recognizedUserIds = [];
            if (labeledDescriptors.length > 0) {
                const matches = await faceAi_1.default.identifyAllFaces(file.path, labeledDescriptors);
                recognizedUserIds = matches
                    .filter((m) => m.label !== 'unknown')
                    .map((m) => JSON.parse(m.label).id);
            }
            const uniqueUserIds = [...new Set(recognizedUserIds.map((id) => Number(id)))];
            items.push({
                url: userService_1.default.buildUploadUrl(file.filename),
                uploadedAt: new Date(),
                recognizedUserIds: uniqueUserIds,
                userId: uploaderId,
            });
        }
        await galleryRepository_1.default.createMany(items);
        return this.listGallery(userId);
    },
    async refreshGalleryRecognition() {
        const knownUsers = await userRepository_1.default.findUsersWithProfilePicture();
        const labeledDescriptors = await buildLabeledDescriptors(knownUsers);
        const allItems = await galleryRepository_1.default.findAll();
        let updatedCount = 0;
        for (const item of allItems) {
            if (item.isProfile)
                continue;
            if (!item.url)
                continue;
            const filename = item.url.split('/').pop();
            const filePath = path.join(constants_1.UPLOADS_DIR, filename);
            if (!fs.existsSync(filePath))
                continue;
            const matches = labeledDescriptors.length > 0
                ? await faceAi_1.default.identifyAllFaces(filePath, labeledDescriptors)
                : [];
            const recognizedUserIds = [...new Set(matches
                    .filter((m) => m.label !== 'unknown')
                    .map((m) => {
                    try {
                        return Number(JSON.parse(m.label).id);
                    }
                    catch (err) {
                        return null;
                    }
                })
                    .filter((id) => Number.isInteger(id) && id > 0))];
            const normalizedIds = recognizedUserIds.sort((a, b) => a - b);
            const existingIds = Array.isArray(item.recognizedUserIds)
                ? item.recognizedUserIds.map((id) => Number(id)).sort((a, b) => a - b)
                : [];
            if (!arraysEqual(normalizedIds, existingIds)) {
                await galleryRepository_1.default.updateById(item.id, { recognizedUserIds: normalizedIds });
                updatedCount += 1;
            }
        }
        return { updatedCount, total: allItems.length };
    },
};
exports.galleryService = galleryService;
exports.default = galleryService;
//# sourceMappingURL=galleryService.js.map