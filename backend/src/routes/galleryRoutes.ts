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



export default router;

