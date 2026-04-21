"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const upload_1 = __importDefault(require("../config/upload"));
const galleryController_1 = __importDefault(require("../controllers/galleryController"));
const asyncHandler_1 = __importDefault(require("../utils/asyncHandler"));
const router = (0, express_1.Router)();
router.get('/', (0, asyncHandler_1.default)(galleryController_1.default.list));
router.post('/', upload_1.default.array('gallery', 10), (0, asyncHandler_1.default)(galleryController_1.default.upload));
router.post('/refresh', (0, asyncHandler_1.default)(galleryController_1.default.refreshRecognition));
router.get('/sync-status', (0, asyncHandler_1.default)(galleryController_1.default.syncStatus));
router.post('/tag-face', (0, asyncHandler_1.default)(galleryController_1.default.tagFace));
router.post('/untag-face', (0, asyncHandler_1.default)(galleryController_1.default.untagFace));
router.get('/clusters', (0, asyncHandler_1.default)(galleryController_1.default.getClusters));
router.post('/clusters/merge', (0, asyncHandler_1.default)(galleryController_1.default.mergeCluster));
router.get('/search', (0, asyncHandler_1.default)(galleryController_1.default.searchByHashtag));
router.post('/:id/hashtags', (0, asyncHandler_1.default)(galleryController_1.default.setHashtags));
router.get('/:id', (0, asyncHandler_1.default)(galleryController_1.default.getById));
exports.default = router;
//# sourceMappingURL=galleryRoutes.js.map