import { Router } from 'express';
import userRoutes from './userRoutes';
import authRoutes from './authRoutes';
import galleryRoutes from './galleryRoutes';
import faceRoutes from './faceRoutes';
import albumRoutes from './albumRoutes';

const router = Router();

router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/gallery', galleryRoutes);
router.use('/identify', faceRoutes);
router.use('/albums', albumRoutes);

export default router;
