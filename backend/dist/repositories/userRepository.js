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
            },
        });
    },
};
exports.default = userRepository;
//# sourceMappingURL=userRepository.js.map