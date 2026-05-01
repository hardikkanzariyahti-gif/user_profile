"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("../config/prisma"));
const userRepository = {
    create(data) {
        return prisma_1.default.user.create({ data });
    },
    findByEmail(email) {
        return prisma_1.default.user.findUnique({ where: { email } });
    },
    findAll() {
        return prisma_1.default.user.findMany({
            orderBy: { id: 'desc' },
        });
    },
    findById(id) {
        return prisma_1.default.user.findUnique({ where: { id } });
    },
    findManyByIds(ids) {
        return prisma_1.default.user.findMany({
            where: {
                id: { in: ids },
            },
            select: {
                id: true,
                name: true,
                profile_picture: true,
            },
        });
    },
    updateById(id, data) {
        return prisma_1.default.user.update({
            where: { id },
            data,
        });
    },
    deleteById(id) {
        return prisma_1.default.user.delete({ where: { id } });
    },
    findUsersWithProfilePicture() {
        return prisma_1.default.user.findMany({
            where: {
                profile_picture: {
                    not: null,
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                profile_picture: true,
                profileDescriptor: true,
            },
        });
    },
    // Returns ALL users — used for building recognition model from tagged photos
    // even users without profile pictures (they get bootstrapped from manual tags)
    findAllForRecognition() {
        return prisma_1.default.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                profile_picture: true,
                profileDescriptor: true,
            },
            orderBy: { id: 'asc' },
        });
    },
};
exports.default = userRepository;
//# sourceMappingURL=userRepository.js.map