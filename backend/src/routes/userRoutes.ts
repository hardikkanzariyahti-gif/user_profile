import { Router } from 'express';
import userController from '../controllers/userController';
import asyncHandler from '../utils/asyncHandler';
import upload from '../config/upload';

const router = Router();

router.post('/', asyncHandler(userController.create));
router.get('/', asyncHandler(userController.list));
router.get('/:id', asyncHandler(userController.getById));
router.put('/:id', upload.single('profilePicture'), asyncHandler(userController.update));
router.delete('/:id', asyncHandler(userController.remove));

export default router;
