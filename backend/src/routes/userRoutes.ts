import { Router } from 'express';
import userController from '../controllers/userController';
import asyncHandler from '../utils/asyncHandler';
import upload, { uploadMemory } from '../config/upload';

const router = Router();

router.post('/', asyncHandler(userController.create));
router.get('/', asyncHandler(userController.list));
router.get('/:id', asyncHandler(userController.getById));
router.put('/:id', upload.array('profile_pictures', 5), asyncHandler(userController.update));
router.delete('/:id', asyncHandler(userController.remove));
router.post('/verify-quality', upload.single('image'), asyncHandler(userController.verifyQuality));
router.post('/check-frame', uploadMemory.single('image'), asyncHandler(userController.checkFrame));

export default router;
