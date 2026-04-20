import { Router } from 'express';
import albumController from '../controllers/albumController';
import asyncHandler from '../utils/asyncHandler';

const router = Router();

router.post('/', asyncHandler(albumController.create));
router.get('/', asyncHandler(albumController.list));
router.get('/:id', asyncHandler(albumController.getById));
router.get('/shared/:shareId', asyncHandler(albumController.getShared));
router.delete('/:id', asyncHandler(albumController.remove));
router.put('/:id', asyncHandler(albumController.update));

export default router;
