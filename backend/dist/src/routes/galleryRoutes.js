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
router.get('/suggest/:id', (0, asyncHandler_1.default)(galleryController_1.default.getTagSuggestions));
router.post('/refresh', (0, asyncHandler_1.default)(galleryController_1.default.refreshRecognition));
router.get('/sync-status', (0, asyncHandler_1.default)(galleryController_1.default.syncStatus));
router.get('/processing-status', (0, asyncHandler_1.default)(galleryController_1.default.getProcessingStatus));
router.post('/cancel-processing', (0, asyncHandler_1.default)(galleryController_1.default.cancelProcessing));
// ── Metadata Backfill (new canonical paths) ──────────────────────────────────
router.post('/metadata/backfill', (0, asyncHandler_1.default)(galleryController_1.default.backfillMetadata));
router.get('/metadata/backfill/status', (0, asyncHandler_1.default)(galleryController_1.default.getBackfillStatus));
// Keep old path as alias for backward compat
router.post('/generate-missing-metadata', (0, asyncHandler_1.default)(galleryController_1.default.backfillMetadata));
router.get('/sync-events', (0, asyncHandler_1.default)(galleryController_1.default.syncEvents));
router.post('/tag-face', (0, asyncHandler_1.default)(galleryController_1.default.tagFace));
router.post('/untag-face', (0, asyncHandler_1.default)(galleryController_1.default.untagFace));
router.post('/bulk-tag-and-album', (0, asyncHandler_1.default)(galleryController_1.default.bulkTagAndAlbum));
router.get('/clusters', (0, asyncHandler_1.default)(galleryController_1.default.getClusters));
router.post('/clusters/merge', (0, asyncHandler_1.default)(galleryController_1.default.mergeCluster));
router.post('/profile-picture-from-gallery', (0, asyncHandler_1.default)(galleryController_1.default.setProfilePictureFromGalleryItem));
router.post('/clusters/ignore', (0, asyncHandler_1.default)(galleryController_1.default.ignoreCluster));
router.post('/clusters/reset-ignored', (0, asyncHandler_1.default)(galleryController_1.default.resetIgnored));
router.get('/search', (0, asyncHandler_1.default)(galleryController_1.default.searchByHashtag));
router.post('/:id/hashtags', (0, asyncHandler_1.default)(galleryController_1.default.setHashtags));
router.post('/:id/custom-metadata', (0, asyncHandler_1.default)(galleryController_1.default.setCustomMetadata));
router.get('/hashtags', (0, asyncHandler_1.default)(galleryController_1.default.getAllHashtags));
router.get('/suggestions', (0, asyncHandler_1.default)(galleryController_1.default.getSuggestions));
router.get('/:id', (0, asyncHandler_1.default)(galleryController_1.default.getById));
router.get('/:id/status', (0, asyncHandler_1.default)(galleryController_1.default.getStatus));
router.post('/:id/force-scan', (0, asyncHandler_1.default)(galleryController_1.default.forceScan));
router.post('/:id/metadata/retry', (0, asyncHandler_1.default)(galleryController_1.default.metadataRetry));
router.delete('/:id', (0, asyncHandler_1.default)(galleryController_1.default.remove));
exports.default = router;
//# sourceMappingURL=galleryRoutes.js.map