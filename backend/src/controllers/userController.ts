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
    const user = await userService.updateUser(req.params.id, req.body, req.file);
    res.json(user);
  },

  async remove(req: Request, res: Response) {
    const result = await userService.deleteUser(req.params.id);
    res.json(result);
  },
};

export default userController;
