"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const userRepository_1 = __importDefault(require("../repositories/userRepository"));
const galleryRepository_1 = __importDefault(require("../repositories/galleryRepository"));
const constants_1 = require("../config/constants");
const userValidators_1 = require("../validators/userValidators");
const serializers_1 = require("../utils/serializers");
const httpError_1 = __importDefault(require("../utils/httpError"));
function buildUploadUrl(filename) {
    return `${constants_1.APP_BASE_URL}/uploads/${filename}`;
}
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
    async updateUser(id, body, file) {
        const userId = normalizeUserId(id);
        const updates = (0, userValidators_1.validateUpdateUserInput)(body);
        if (file) {
            updates.profile_picture = buildUploadUrl(file.filename);
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
            if (err.code === 'P2025') {
                throw (0, httpError_1.default)(404, 'User not found');
            }
            throw err;
        }
        if (file) {
            await galleryRepository_1.default.createOne({
                url: buildUploadUrl(file.filename),
                uploadedAt: new Date(),
                label: `${updatedUser.name}'s New Profile Picture`,
                isProfile: true,
                userId: updatedUser.id,
                recognizedUserIds: [updatedUser.id],
            });
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
    buildUploadUrl,
    normalizeUserId,
};
exports.default = userService;
//# sourceMappingURL=userService.js.map