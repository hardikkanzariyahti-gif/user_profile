import { Request, Response } from 'express';
declare const userController: {
    create(req: Request, res: Response): Promise<void>;
    list(req: Request, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<void>;
    update(req: Request, res: Response): Promise<void>;
    remove(req: Request, res: Response): Promise<void>;
};
export default userController;
//# sourceMappingURL=userController.d.ts.map