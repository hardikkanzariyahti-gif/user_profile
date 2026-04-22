import { Router } from 'express';
import upload from '../config/upload';
import galleryController from '../controllers/galleryController';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.get('/', asyncHandler(galleryController.list));
router.post('/', upload.array('gallery', 10), asyncHandler(galleryController.upload));
router.post('/refresh', asyncHandler(galleryController.refreshRecognition));
router.get('/sync-status', asyncHandler(galleryController.syncStatus));
router.post('/tag-face', asyncHandler(galleryController.tagFace));
router.post('/untag-face', asyncHandler(galleryController.untagFace));
router.get('/clusters', asyncHandler(galleryController.getClusters));
router.post('/clusters/merge', asyncHandler(galleryController.mergeCluster));
router.post('/profile-picture-from-gallery', asyncHandler(galleryController.setProfilePictureFromGalleryItem));
router.post('/clusters/ignore', asyncHandler(galleryController.ignoreCluster));
router.post('/clusters/reset-ignored', asyncHandler(galleryController.resetIgnored));
router.get('/search', asyncHandler(galleryController.searchByHashtag));
router.post('/:id/hashtags', asyncHandler(galleryController.setHashtags));
router.get('/:id', asyncHandler(galleryController.getById));
router.delete('/:id', asyncHandler(galleryController.remove));


export default router;

