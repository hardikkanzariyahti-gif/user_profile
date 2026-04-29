import { Request, Response } from 'express';
import { galleryService, syncState } from '../services/galleryService';

const galleryController = {
  async list(req: Request, res: Response) {
    const gallery = await galleryService.listGallery(req.query.userId);
    res.json(gallery);
  },

  async getById(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const item = await galleryService.getGalleryItem(id);
    res.json(item);
  },

  async remove(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const result = await galleryService.deleteGalleryItem(id);
    res.json(result);
  },

  async setHashtags(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const hashtags = req.body?.hashtags ?? req.body?.tags ?? req.body;
    const item = await galleryService.setGalleryItemHashtags(id, hashtags);
    res.json(item);
  },

  async searchByHashtag(req: Request, res: Response) {
    const tag = String(req.query.tag ?? '');
    const results = await galleryService.searchGalleryByHashtag(tag);
    res.json(results);
  },

  async upload(req: Request, res: Response) {
    const result = await galleryService.uploadGallery(req.files as any || [], req.query.userId);

    if (typeof result === 'object' && result !== null && 'gallery' in result && 'suggestions' in result) {
      res.json(result);
    } else {
      res.json(result);
    }
  },

  async refreshRecognition(req: Request, res: Response) {
    const forceRescan = req.query.forceRescan === 'true' || req.body?.forceRescan === true;

    // Start it in the background to prevent V8 memory crashes and Browser timeouts for large lists
    galleryService.refreshGalleryRecognition(forceRescan).catch(err => {
      console.error('Background Sync Error:', err);
    });

    res.status(202).json({ message: 'Background sync started', status: syncState });
  },

  async syncStatus(req: Request, res: Response) {
    res.json(syncState);
  },

  async tagFace(req: Request, res: Response) {
    const galleryItemId = Number(req.body.galleryItemId);
    const userId = Number(req.body.userId);
    if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
      res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
      return;
    }
    const faceIndex = req.body.faceIndex !== undefined ? Number(req.body.faceIndex) : undefined;
    const result = await galleryService.tagUnknownFace(galleryItemId, userId, faceIndex);
    res.json(result);
  },

  async untagFace(req: Request, res: Response) {
    const galleryItemId = Number(req.body.galleryItemId);
    const userId = Number(req.body.userId);
    if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
      res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
      return;
    }
    const faceIndex = req.body.faceIndex !== undefined ? Number(req.body.faceIndex) : undefined;
    const result = await galleryService.untagFace(galleryItemId, userId, faceIndex);
    res.json(result);
  },

  async getClusters(req: Request, res: Response) {
    const clusters = await galleryService.getUnknownFaceClusters();
    res.json(clusters);
  },

  async mergeCluster(req: Request, res: Response) {
    const userId = Number(req.body.userId);
    const faces = req.body.faces;
    if (!userId || isNaN(userId) || !Array.isArray(faces)) {
      res.status(400).json({ error: 'userId and faces array are required.' });
      return;
    }
    const result = await galleryService.mergeClusterFaces(userId, faces);
    res.json(result);
  },

  async setProfilePictureFromGalleryItem(req: Request, res: Response) {
    const galleryItemId = Number(req.body.galleryItemId);
    const userId = Number(req.body.userId);
    if (!galleryItemId || !userId || isNaN(galleryItemId) || isNaN(userId)) {
      res.status(400).json({ error: 'galleryItemId and userId are required and must be valid numbers.' });
      return;
    }
    const result = await galleryService.setProfilePictureFromGalleryItem(userId, galleryItemId);
    res.json(result);
  },

  async ignoreCluster(req: Request, res: Response) {
    const faces = req.body.faces;
    if (!Array.isArray(faces)) {
      res.status(400).json({ error: 'faces array is required.' });
      return;
    }
    const result = await galleryService.ignoreClusterFaces(faces);
    res.json(result);
  },

  async resetIgnored(req: Request, res: Response) {
    const result = await galleryService.resetIgnoredFaces();
    res.json(result);
  },

  async getTagSuggestions(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const suggestions = await galleryService.getTagSuggestions(id);
    res.json(suggestions);
  },

  async ignoreReview(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const result = await galleryService.ignoreGalleryReview(id);
    res.json(result);
  },

};



export default galleryController;
