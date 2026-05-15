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
const path = __importStar(require("path"));
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const galleryRepository_1 = __importDefault(require("../repositories/galleryRepository"));
const constants_1 = require("../config/constants");
const userValidators_1 = require("../validators/userValidators");
const serializers_1 = require("../utils/serializers");
const urlUtils_1 = require("../utils/urlUtils");
const httpError_1 = __importDefault(require("../utils/httpError"));
const faceAi_1 = __importDefault(require("../../faceAi"));
function normalizeUserId(id) {
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) {
        throw (0, httpError_1.default)(400, 'Invalid user id');
    }
    return userId;
}
const userService = {
    async createUser(body) {
        const payload = (0, userValidators_1.validateCreateUserInput)(body);
        const existing = await userRepository_1.default.findByEmail(payload.email);
        if (existing) {
            throw (0, httpError_1.default)(400, 'A user with this email already exists.');
        }
        const user = await userRepository_1.default.create(payload);
        return (0, serializers_1.toUserResponse)(user);
    },
    async listUsers() {
        const users = await userRepository_1.default.findAll();
        return users.map(serializers_1.toUserResponse);
    },
    async getUserById(id) {
        const userId = normalizeUserId(id);
        const user = await userRepository_1.default.findById(userId);
        if (!user) {
            throw (0, httpError_1.default)(404, 'User not found');
        }
        return (0, serializers_1.toUserResponse)(user);
    },
    async verifyFaceQuality(file) {
        const filePath = path.join(constants_1.UPLOADS_DIR, file.filename);
        try {
            const descriptor = await faceAi_1.default.getFaceDescriptor(filePath);
            return {
                isValid: !!descriptor,
                message: !!descriptor ? 'Clear face detected!' : 'Face is too blurry or not clear enough. Please ensure good lighting and look straight at the camera.'
            };
        }
        finally {
            // Optional: Delete the temp file after verification if you don't want to keep failed checks
            // For now we keep it simple.
        }
    },
    async updateUser(id, body, files = []) {
        const userId = normalizeUserId(id);
        const updates = (0, userValidators_1.validateUpdateUserInput)(body);
        if (files && files.length > 0) {
            // ── PARALLEL VALIDATION ──────────────────────────────────────────────
            const validationResults = await Promise.all(files.map(async (file) => {
                const filePath = path.join(constants_1.UPLOADS_DIR, file.filename);
                const data = await faceAi_1.default.detectFaces(filePath);
                const faces = data.faces || [];
                return { file, hasFace: faces.length > 0, faces, data };
            }));
            const validFiles = validationResults.filter(r => r.hasFace).map(r => r.file);
            const failedLabels = validationResults
                .filter(r => !r.hasFace)
                .map(r => r.file.originalname.replace('.jpg', ''));
            if (failedLabels.length > 0) {
                console.log(`[userService] Skipping angles with no face: ${failedLabels.join(', ')}`);
            }
            if (validFiles.length === 0) {
                throw (0, httpError_1.default)(400, 'No face detected in any of your photos. Please ensure your face is clearly visible in at least one image.');
            }
            files = validFiles;
            updates.profile_picture = (0, urlUtils_1.buildUploadUrl)(files[0].filename);
            updates.profile_pictures = files.map((f) => (0, urlUtils_1.buildUploadUrl)(f.filename));
            // Build profileDescriptors array containing embedding, crop, and qualityScore
            const profileDescriptors = [];
            validationResults.forEach(vr => {
                if (vr.hasFace) {
                    const mainFace = vr.faces[0];
                    const desc = faceAi_1.default.serializeDescriptor(mainFace.descriptor);
                    if (desc.length !== 512 && desc.length !== 128) {
                        console.warn(`[Profile Enrolment] Embedding length ${desc.length} is invalid for user ${userId}`);
                    }
                    // Profile Enrollment Debug log as requested:
                    console.log(`[Profile Debug] userId: ${userId}, face detected: yes, face count: ${vr.faces.length}, embedding length: ${desc.length}, crop size: ${mainFace.box._width}x${mainFace.box._height}, quality score: ${mainFace.confidence}`);
                    profileDescriptors.push({
                        descriptor: desc,
                        faceCrop: (0, urlUtils_1.buildUploadUrl)(vr.file.filename),
                        box: mainFace.box,
                        qualityScore: mainFace.confidence ?? 1.0,
                        addedAt: new Date().toISOString()
                    });
                }
            });
            updates.profileDescriptor = profileDescriptors;
        }
        if (Object.keys(updates).length === 0) {
            const existing = await userRepository_1.default.findById(userId);
            if (!existing)
                throw (0, httpError_1.default)(404, 'User not found');
            return (0, serializers_1.toUserResponse)(existing);
        }
        if (updates.email) {
            const owner = await userRepository_1.default.findByEmail(updates.email);
            if (owner && owner.id !== userId) {
                throw (0, httpError_1.default)(400, 'A user with this email already exists.');
            }
        }
        let updatedUser;
        try {
            updatedUser = await userRepository_1.default.updateById(userId, updates);
        }
        catch (err) {
            if (err.code === 'P2025')
                throw (0, httpError_1.default)(404, 'User not found');
            throw err;
        }
        if (files && files.length > 0) {
            const urls = files.map((f) => (0, urlUtils_1.buildUploadUrl)(f.filename));
            await Promise.all([
                galleryRepository_1.default.hideOldProfilePictures(userId),
                ...files.map((file) => galleryRepository_1.default.createOne({
                    url: (0, urlUtils_1.buildUploadUrl)(file.filename),
                    uploadedAt: new Date(),
                    isProfile: true,
                    userId: updatedUser.id,
                    recognizedUserIds: [updatedUser.id],
                })),
            ]);
            const { galleryService } = require('./galleryService');
            galleryService.refreshGalleryRecognition().catch((err) => console.log('[Sync] Background refresh failed:', err));
        }
        return (0, serializers_1.toUserResponse)(updatedUser);
    },
    async deleteUser(id) {
        const userId = normalizeUserId(id);
        try {
            await userRepository_1.default.deleteById(userId);
            return { message: 'User deleted successfully' };
        }
        catch (err) {
            if (err.code === 'P2025') {
                throw (0, httpError_1.default)(404, 'User not found');
            }
            throw err;
        }
    },
    buildUploadUrl: urlUtils_1.buildUploadUrl,
    normalizeUserId,
};
exports.default = userService;
//# sourceMappingURL=userService.js.map