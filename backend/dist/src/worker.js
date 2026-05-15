"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./patch");
const loadEnv_1 = __importDefault(require("./config/loadEnv"));
(0, loadEnv_1.default)();
const faceAi_1 = __importDefault(require("../faceAi"));
const prisma_1 = __importDefault(require("./config/prisma"));
const galleryScanWorker_1 = require("./workers/galleryScanWorker");
const galleryPreprocessWorker_1 = require("./workers/galleryPreprocessWorker");
const galleryRefreshWorker_1 = require("./workers/galleryRefreshWorker");
async function start() {
    // Worker runs AI + DB work; keep it separate from API server.
    await faceAi_1.default.loadModels();
    (0, galleryPreprocessWorker_1.startGalleryPreprocessWorker)();
    (0, galleryScanWorker_1.startGalleryScanWorker)();
    (0, galleryRefreshWorker_1.startGalleryRefreshWorker)();
    console.log('Worker started.');
}
start().catch(async (err) => {
    console.error('Failed to start worker:', err);
    try {
        await prisma_1.default.$disconnect();
    }
    catch { }
    process.exit(1);
});
//# sourceMappingURL=worker.js.map