import * as fs from 'fs';
import { Request, Response } from 'express';
import faceService from '../services/faceService';
import httpError from '../utils/httpError';

const faceController = {
  async identify(req: Request, res: Response) {
    if (!req.file) {
      throw httpError(400, 'No image provided');
    }

    try {
      const result = await faceService.identifyImage(req.file.path);
      res.json(result);
    } finally {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    }
  },
};

export default faceController;
