import { Router } from 'express';
import userRoutes from './userRoutes';
import authRoutes from './authRoutes';
import galleryRoutes from './galleryRoutes';
import faceRoutes from './faceRoutes';

const router = Router();

router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/gallery', galleryRoutes);
router.use('/identify', faceRoutes);

export default router;
