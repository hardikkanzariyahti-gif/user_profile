"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userRoutes_1 = __importDefault(require("./userRoutes"));
const authRoutes_1 = __importDefault(require("./authRoutes"));
const galleryRoutes_1 = __importDefault(require("./galleryRoutes"));
const faceRoutes_1 = __importDefault(require("./faceRoutes"));
const router = (0, express_1.Router)();
router.use('/users', userRoutes_1.default);
router.use('/auth', authRoutes_1.default);
router.use('/gallery', galleryRoutes_1.default);
router.use('/identify', faceRoutes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map