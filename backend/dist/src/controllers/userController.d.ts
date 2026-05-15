import { Request, Response } from 'express';
declare const userController: {
    create(req: Request, res: Response): Promise<void>;
    list(req: Request, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<void>;
    update(req: Request, res: Response): Promise<void>;
    remove(req: Request, res: Response): Promise<void>;
    verifyQuality(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    checkFrame(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
};
export default userController;
//# sourceMappingURL=userController.d.ts.map