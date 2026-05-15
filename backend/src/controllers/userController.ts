import { Request, Response } from 'express';
import userService from '../services/userService';

const userController = {
  async create(req: Request, res: Response) {
    const user = await userService.createUser(req.body);
    res.json(user);
  },

  async list(req: Request, res: Response) {
    const users = await userService.listUsers();
    res.json(users);
  },

  async getById(req: Request, res: Response) {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  },

  async update(req: Request, res: Response) {
    const user = await userService.updateUser(req.params.id, req.body, req.files as any[]);
    res.json(user);
  },

  async remove(req: Request, res: Response) {
    const result = await userService.deleteUser(req.params.id);
    res.json(result);
  },
  
  async verifyQuality(req: Request, res: Response) {
    if (!req.file) {
      return res.status(400).json({ isValid: false, message: 'No image provided' });
    }
    const result = await userService.verifyFaceQuality(req.file);
    res.json(result);
  },

  async checkFrame(req: Request, res: Response) {
    if (!req.file) return res.status(400).json({ message: 'No frame' });
    if (!req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid frame payload',
      });
    }
    
    try {
      // Proxy to Python Lite check
      const formData = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append('file', blob, 'frame.jpg');

      const angle = req.body.angle || req.query.angle || 'front';
      const pythonRes = await fetch(`http://localhost:8000/check_frame?angle=${encodeURIComponent(angle)}`, {
        method: 'POST',
        body: formData
      });

      if (!pythonRes.ok) {
        return res.status(pythonRes.status).json({ 
          status: 'error', 
          message: 'AI Service error' 
        });
      }

      const data = await pythonRes.json();
      res.json(data);
    } catch (err: any) {
      console.error('[checkFrame] Proxy error:', err.message);
      res.status(500).json({ 
        status: 'error', 
        message: 'AI Service is currently unavailable' 
      });
    }
  },
};

export default userController;
