import { Request, Response } from 'express';
import authService from '../services/authService';

const authController = {
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body);
    res.json(result);
  },
};

export default authController;
