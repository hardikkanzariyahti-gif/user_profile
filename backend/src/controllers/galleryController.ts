import { Request, Response } from 'express';
import { galleryService } from '../services/galleryService';

const galleryController = {
  async list(req: Request, res: Response) {
    const search = String(req.query.search || '');
    const gallery = await galleryService.listGallery(req.query.userId, search);
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

  async getStatus(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const item = await galleryService.getGalleryItem(id) as any;
    // Removed status debug spamming to scale console for 1000+ photos
    res.json({
      ...item,
      imageId: item.id,
      scanStatus: item.scanStatus || 'pending',
    });
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

  async setCustomMetadata(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const customLocation = String(req.body?.customLocation ?? '');
    const customEvent = String(req.body?.customEvent ?? '');
    const item = await galleryService.setGalleryItemCustomMetadata(id, customLocation, customEvent);
    res.json(item);
  },

  async searchByHashtag(req: Request, res: Response) {
    const tag = String(req.query.tag ?? '');
    const results = await galleryService.searchGalleryByHashtag(tag);
    res.json(results);
  },

  async upload(req: Request, res: Response) {
    const isEventUpload = req.body?.isEventUpload === 'true';
    const eventName = req.body?.eventName;
    const eventId = req.body?.eventId ? Number(req.body.eventId) : undefined;
    const location = req.body?.eventLocation;
    const date = req.body?.eventDate;
    const description = req.body?.eventDescription;

    let tags: string[] | undefined = undefined;
    if (req.body?.tags) {
      if (Array.isArray(req.body.tags)) {
        tags = req.body.tags;
      } else if (typeof req.body.tags === 'string') {
        tags = req.body.tags
          .split(',')
          .map((t: string) => t.trim().toLowerCase())
          .filter(Boolean);
      }
    }

    const eventInfo = (isEventUpload || eventName || eventId || location || date || description || tags) ? {
      eventName: eventName || undefined,
      location: location || undefined,
      date: date || undefined,
      description: description || undefined,
      eventId: eventId || undefined,
      tags: tags || undefined
    } : undefined;

    const result = await galleryService.uploadGallery(req.files as any || [], req.query.userId, eventInfo);

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

    res.status(202).json({ message: 'Background sync started', status: galleryService.syncState });
  },

  async syncStatus(req: Request, res: Response) {
    // If Redis queue is enabled, status may be maintained by workers.
    try {
      const { getRedis } = await import('../queues/redis');
      const { getSyncState } = await import('../queues/syncStateStore');
      const redis = getRedis();
      if (redis) {
        const state = await getSyncState(redis);
        res.json(state);
        return;
      }
    } catch { }
    res.json(galleryService.syncState);
  },

  async getProcessingStatus(req: Request, res: Response) {
    const status = await galleryService.getProcessingStatus();
    res.json(status);
  },

  async syncEvents(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // Helps if behind proxies.
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (payload: any) => {
      res.write(`event: sync\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const getState = async () => {
      try {
        const { getRedis } = await import('../queues/redis');
        const { getSyncState } = await import('../queues/syncStateStore');
        const redis = getRedis();
        if (redis) return await getSyncState(redis);
      } catch { }
      return galleryService.syncState;
    };

    // Send current state immediately.
    send(await getState());

    const interval = setInterval(() => {
      void getState().then(send);
    }, 1000);

    req.on('close', () => {
      clearInterval(interval);
      res.end();
    });
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

  async getAllHashtags(req: Request, res: Response) {
    const hashtags = await galleryService.getAllHashtags();
    res.json(hashtags);
  },

  async getSuggestions(req: Request, res: Response) {
    const q = String(req.query.q || '');
    const suggestions = await galleryService.getSearchSuggestions(q);
    res.json(suggestions);
  },

  async forceScan(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    const result = await galleryService.forceScanItem(id);
    res.json(result);
  },

  async metadataRetry(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: 'Valid gallery id is required.' });
      return;
    }
    // Use unified process pipeline passing forceScan=false, forceMeta=true (Requirement 7)
    galleryService.processGalleryImage(id, false, true).catch(err => console.error('[Retry Fail]', err));
    res.json({ success: true, message: 'Integrated metadata extraction cycle initialized.' });
  },

  async backfillMetadata(req: Request, res: Response) {
    const force = req.body?.force === true;
    console.log(`[Backfill API] POST /metadata/backfill — force=${force}`);
    const result = await galleryService.backfillMissingMetadata(force);
    // 202 = accepted / running, 200 = already done/nothing to do
    const status = (result as any).running ? 202 : 200;
    res.status(status).json(result);
  },

  async getBackfillStatus(req: Request, res: Response) {
    const status = galleryService.getBackfillStatus();
    res.json(status);
  },

  async bulkTagAndAlbum(req: Request, res: Response) {
    const itemIds = req.body.itemIds;
    const targetUserId = req.body.targetUserId ? Number(req.body.targetUserId) : null;
    const targetTagName = req.body.targetTagName ? String(req.body.targetTagName).trim() : null;
    const currentUserId = Number(req.body.currentUserId);

    if (!Array.isArray(itemIds) || itemIds.length === 0 || isNaN(currentUserId)) {
      res.status(400).json({ error: 'itemIds (array) and currentUserId are required inputs.' });
      return;
    }

    if (!targetUserId && !targetTagName) {
      res.status(400).json({ error: 'Either targetUserId or targetTagName must be provided.' });
      return;
    }

    try {
      const result = await galleryService.bulkTagAndAlbum(itemIds, targetUserId, currentUserId, targetTagName);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'An error occurred during bulk processing.' });
    }
  },

  async cancelProcessing(req: Request, res: Response) {
    try {
      const result = await galleryService.cancelProcessing();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'An error occurred while cancelling background processing.' });
    }
  },

};




export default galleryController;
