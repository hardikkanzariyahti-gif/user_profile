import * as faceApiLib from '@vladmandic/face-api';
declare function buildLabeledDescriptors(users: any[]): Promise<faceApiLib.LabeledFaceDescriptors[]>;
declare const galleryService: {
    listGallery(userId?: any): Promise<{
        id: number;
        url: string;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        recognizedUsers: any[];
    }[]>;
    uploadGallery(files?: any[], userId?: any): Promise<{
        id: number;
        url: string;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        recognizedUsers: any[];
    }[]>;
    refreshGalleryRecognition(): Promise<{
        updatedCount: number;
        total: number;
    }>;
};
export { galleryService, buildLabeledDescriptors };
export default galleryService;
//# sourceMappingURL=galleryService.d.ts.map