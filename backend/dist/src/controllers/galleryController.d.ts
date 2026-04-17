import { Request, Response } from 'express';
declare const galleryController: {
    list(req: Request, res: Response): Promise<void>;
    upload(req: Request, res: Response): Promise<void>;
    refreshRecognition(req: Request, res: Response): Promise<void>;
    tagFace(req: Request, res: Response): Promise<void>;
    untagFace(req: Request, res: Response): Promise<void>;
};
export default galleryController;
//# sourceMappingURL=galleryController.d.ts.map