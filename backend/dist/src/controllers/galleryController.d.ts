import { Request, Response } from 'express';
declare const galleryController: {
    list(req: Request, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<void>;
    remove(req: Request, res: Response): Promise<void>;
    setHashtags(req: Request, res: Response): Promise<void>;
    searchByHashtag(req: Request, res: Response): Promise<void>;
    upload(req: Request, res: Response): Promise<void>;
    refreshRecognition(req: Request, res: Response): Promise<void>;
    syncStatus(req: Request, res: Response): Promise<void>;
    tagFace(req: Request, res: Response): Promise<void>;
    untagFace(req: Request, res: Response): Promise<void>;
    getClusters(req: Request, res: Response): Promise<void>;
    mergeCluster(req: Request, res: Response): Promise<void>;
    setProfilePictureFromGalleryItem(req: Request, res: Response): Promise<void>;
    ignoreCluster(req: Request, res: Response): Promise<void>;
    resetIgnored(req: Request, res: Response): Promise<void>;
    getTagSuggestions(req: Request, res: Response): Promise<void>;
    ignoreReview(req: Request, res: Response): Promise<void>;
};
export default galleryController;
//# sourceMappingURL=galleryController.d.ts.map