import * as faceApiLib from '@vladmandic/face-api';
/**
 * Build a LabeledFaceDescriptors model for each user so face-api can match
 * detected faces to known people.
 *
 * Strategy per user:
 *   1. Profile picture → single best face (ground truth anchor)
 *   2. If no profile picture → bootstrap from all faces found in their tagged photos
 *   3. Enrich with up to 10 additional confirmed photos (improves angle coverage)
 */
declare function buildLabeledDescriptors(users: any[]): Promise<faceApiLib.LabeledFaceDescriptors[]>;
declare const galleryService: {
    listGallery(userId?: any): Promise<{
        id: number;
        url: string | null | undefined;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        recognizedUsers: {
            id: any;
            name: any;
            profilePicture: string | null;
        }[];
    }[]>;
    uploadGallery(files?: any[], userId?: any): Promise<{
        id: number;
        url: string | null | undefined;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        recognizedUsers: {
            id: any;
            name: any;
            profilePicture: string | null;
        }[];
    }[]>;
    /**
     * Manually tag a user in a gallery photo.
     * - Tag is permanent — never removed by AI refresh
     * - If user has no profile picture yet, sets this photo as their first one
     * - Clears item's face cache (forces fresh detection on next sync)
     * - Invalidates in-memory model cache (model must be rebuilt with new training data)
     * - Triggers background refresh to propagate recognition to other photos
     */
    tagUnknownFace(galleryItemId: number, userId: number): Promise<{
        message: string;
        profilePictureSet: boolean;
    }>;
    untagFace(galleryItemId: number, userId: number): Promise<{
        message: string;
    }>;
    /**
     * Re-scan all gallery photos and ADD newly recognized users to each photo.
     *
     * RULE: Existing tags (manual or previous AI) are NEVER removed.
     *       AI can only ADD more users to a photo's tag list.
     *
     * @param forceRescan  Clear all cached face descriptors first so the improved
     *                     detector re-processes every photo from scratch.
     *                     Essential after detection logic changes.
     */
    refreshGalleryRecognition(forceRescan?: boolean): Promise<{
        updatedCount: number;
        total: number;
    }>;
};
export { galleryService, buildLabeledDescriptors };
export default galleryService;
//# sourceMappingURL=galleryService.d.ts.map