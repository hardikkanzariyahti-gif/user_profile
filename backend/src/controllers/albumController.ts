import { Request, Response } from 'express';
import albumService from '../services/albumService';

export const albumController = {
  async create(req: Request, res: Response) {
    const { title, description, itemIds, isGlobal } = req.body;
    const userId = Number(req.query.userId);

    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }

    try {
      const album = await albumService.createAlbum({ title, description, userId, itemIds, isGlobal });
      res.status(201).json(album);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async list(req: Request, res: Response) {
    const userId = Number(req.query.userId);
    if (!userId) {
      res.status(401).json({ error: 'User ID is required' });
      return;
    }

    try {
      const albums = await albumService.getAlbumsByUser(userId);
      res.json(albums);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async getById(req: Request, res: Response) {
    const userId = Number(req.query.userId);
    const id = Number(req.params.id);

    try {
      const album = await albumService.getAlbumById(id, userId);
      res.json(album);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  },

  async getShared(req: Request, res: Response) {
    const { shareId } = req.params;

    try {
      const album = await albumService.getSharedAlbum(shareId);
      res.json(album);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  },

  async remove(req: Request, res: Response) {
    const userId = Number(req.query.userId);
    const id = Number(req.params.id);

    try {
      await albumService.deleteAlbum(id, userId);
      res.json({ message: 'Album deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },

  async update(req: Request, res: Response) {
    const userId = Number(req.query.userId);
    const id = Number(req.params.id);
    const { title, description } = req.body;

    try {
      const album = await albumService.updateAlbum(id, userId, { title, description });
      res.json(album);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  },
};

export default albumController;
