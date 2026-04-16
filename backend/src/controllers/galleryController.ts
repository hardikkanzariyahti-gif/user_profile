import { Request, Response } from 'express';
import { galleryService } from '../services/galleryService';

const galleryController = {
  async list(req: Request, res: Response) {
    const gallery = await galleryService.listGallery(req.query.userId);
    res.json(gallery);
  },

  async upload(req: Request, res: Response) {
    const gallery = await galleryService.uploadGallery(req.files as any || [], req.query.userId);
    res.json(gallery);
  },
};

export default galleryController;
