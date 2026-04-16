import { Router } from 'express';
import upload from '../config/upload';
import faceController from '../controllers/faceController';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.post('/', upload.single('image'), asyncHandler(faceController.identify));

export default router;
