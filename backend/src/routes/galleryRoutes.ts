import { Router } from 'express';
import upload from '../config/upload';
import galleryController from '../controllers/galleryController';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(galleryController.list));
router.post('/', upload.array('gallery', 10), asyncHandler(galleryController.upload));
router.get('/suggest/:id', asyncHandler(galleryController.getTagSuggestions));
router.post('/refresh', asyncHandler(galleryController.refreshRecognition));
router.get('/sync-status', asyncHandler(galleryController.syncStatus));
router.get('/processing-status', asyncHandler(galleryController.getProcessingStatus));
router.post('/cancel-processing', asyncHandler(galleryController.cancelProcessing));

// ── Metadata Backfill (new canonical paths) ──────────────────────────────────
router.post('/metadata/backfill', asyncHandler(galleryController.backfillMetadata));
router.get('/metadata/backfill/status', asyncHandler(galleryController.getBackfillStatus));
// Keep old path as alias for backward compat
router.post('/generate-missing-metadata', asyncHandler(galleryController.backfillMetadata));

router.get('/sync-events', asyncHandler(galleryController.syncEvents));
router.post('/tag-face', asyncHandler(galleryController.tagFace));
router.post('/untag-face', asyncHandler(galleryController.untagFace));
router.post('/bulk-tag-and-album', asyncHandler(galleryController.bulkTagAndAlbum));
router.get('/clusters', asyncHandler(galleryController.getClusters));
router.post('/clusters/merge', asyncHandler(galleryController.mergeCluster));
router.post('/profile-picture-from-gallery', asyncHandler(galleryController.setProfilePictureFromGalleryItem));
router.post('/clusters/ignore', asyncHandler(galleryController.ignoreCluster));
router.post('/clusters/reset-ignored', asyncHandler(galleryController.resetIgnored));
router.get('/search', asyncHandler(galleryController.searchByHashtag));
router.post('/:id/hashtags', asyncHandler(galleryController.setHashtags));
router.post('/:id/custom-metadata', asyncHandler(galleryController.setCustomMetadata));
router.get('/hashtags', asyncHandler(galleryController.getAllHashtags));
router.get('/suggestions', asyncHandler(galleryController.getSuggestions));
router.get('/:id', asyncHandler(galleryController.getById));
router.get('/:id/status', asyncHandler(galleryController.getStatus));
router.post('/:id/force-scan', asyncHandler(galleryController.forceScan));
router.post('/:id/metadata/retry', asyncHandler(galleryController.metadataRetry));
router.delete('/:id', asyncHandler(galleryController.remove));

export default router;
