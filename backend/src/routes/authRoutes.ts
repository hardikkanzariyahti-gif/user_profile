import { Router } from 'express';
import authController from '../controllers/authController';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.post('/login', asyncHandler(authController.login));

export default router;
