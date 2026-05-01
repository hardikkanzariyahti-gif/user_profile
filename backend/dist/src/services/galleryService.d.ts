export declare class LabeledFaceDescriptors {
    label: string;
    descriptors: Float32Array[];
    constructor(label: string, descriptors: Float32Array[]);
}
/**
 * Build a LabeledFaceDescriptors model for each user so face-api can match
 * detected faces to known people.
 *
 * Strategy per user:
 *   1. Profile picture → single best face (ground truth anchor)
 *   2. If no profile picture → bootstrap from all faces found in their tagged photos
 *   3. Enrich with up to 10 additional confirmed photos (improves angle coverage)
 */
declare function buildLabeledDescriptors(users: any[]): Promise<LabeledFaceDescriptors[]>;
declare const galleryService: {
    listGallery(userId?: any): Promise<{
        id: number;
        url: string | null | undefined;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        hashtags: string[];
        faces: {
            index: number;
            box: any;
            manuallyTaggedUserId: any;
        }[];
        recognizedUsers: {
            id: any;
            name: any;
            profilePicture: string | null;
        }[];
    }[]>;
    getGalleryItem(id: number): Promise<{
        id: number;
        url: string | null | undefined;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        hashtags: string[];
        faces: {
            index: number;
            box: any;
            manuallyTaggedUserId: any;
        }[];
        recognizedUsers: {
            id: any;
            name: any;
            profilePicture: string | null;
        }[];
    }>;
    deleteGalleryItem(id: number): Promise<{
        message: string;
    }>;
    setGalleryItemHashtags(id: number, hashtagsInput: any): Promise<{
        id: number;
        url: string | null | undefined;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        hashtags: string[];
        faces: {
            index: number;
            box: any;
            manuallyTaggedUserId: any;
        }[];
        recognizedUsers: {
            id: any;
            name: any;
            profilePicture: string | null;
        }[];
    }>;
    searchGalleryByHashtag(rawTag: string): Promise<{
        id: number;
        url: string | null | undefined;
        uploadedAt: Date;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        recognizedUserIds: number[];
        hashtags: string[];
        faces: {
            index: number;
            box: any;
            manuallyTaggedUserId: any;
        }[];
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
        hashtags: string[];
        faces: {
            index: number;
            box: any;
            manuallyTaggedUserId: any;
        }[];
        recognizedUsers: {
            id: any;
            name: any;
            profilePicture: string | null;
        }[];
    }[] | {
        gallery: {
            id: number;
            url: string | null | undefined;
            uploadedAt: Date;
            label: string | null | undefined;
            isProfile: boolean;
            userId: number | null | undefined;
            recognizedUserIds: number[];
            hashtags: string[];
            faces: {
                index: number;
                box: any;
                manuallyTaggedUserId: any;
            }[];
            recognizedUsers: {
                id: any;
                name: any;
                profilePicture: string | null;
            }[];
        }[];
        suggestions: {
            faces: Array<{
                box: any;
                confidence: number;
                isConfident: boolean;
                topSuggestion: {
                    id: number;
                    name: string;
                    confidence: number;
                    distance: number;
                } | null;
                allSuggestions: Array<{
                    id: number;
                    name: string;
                    confidence: number;
                    distance: number;
                }>;
                label: string;
                reason: string | null;
            }>;
            highConfidenceCount: number;
            lowConfidenceCount: number;
            itemId: number;
            url: string;
        };
    }>;
    /**
     * Manually tag a user in a gallery photo.
     * - Tag is permanent — never removed by AI refresh
     * - If user has no profile picture yet, sets this photo as their first one
     * - Clears item's face cache (forces fresh detection on next sync)
     * - Invalidates in-memory model cache (model must be rebuilt with new training data)
     * - Triggers background refresh to propagate recognition to other photos
     */
    tagUnknownFace(galleryItemId: number, userId: number, faceIndex?: number): Promise<{
        message: string;
        profilePictureSet: boolean;
    }>;
    untagFace(galleryItemId: number, userId: number, faceIndex?: number): Promise<{
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
    syncState: {
        isScanning: boolean;
        total: number;
        current: number;
    };
    refreshGalleryRecognition(forceRescan?: boolean): Promise<{
        message: string;
        updatedCount?: undefined;
        total?: undefined;
        durationSc?: undefined;
    } | {
        updatedCount: number;
        total: number;
        durationSc: string;
        message?: undefined;
    }>;
    getUnknownFaceClusters(): Promise<{
        clusterId: string;
        faceCount: number;
        anchorImage: string;
        anchorBox: any;
        relatedPhotos: {
            itemId: any;
            faceIndex: any;
            url: string;
            box: any;
        }[];
    }[]>;
    getTagSuggestions(galleryItemId: number): Promise<{
        needsScanning: boolean;
        faces: Array<{
            box: any;
            confidence: number;
            isConfident: boolean;
            topSuggestion: {
                id: number;
                name: string;
                confidence: number;
                distance: number;
            } | null;
            allSuggestions: Array<{
                id: number;
                name: string;
                confidence: number;
                distance: number;
            }>;
            label: string;
            reason: string | null;
        }>;
        highConfidenceCount: number;
        lowConfidenceCount: number;
        url: string;
    }>;
    getSuggestionForUpload(filePath: string): Promise<{
        faces: Array<{
            box: any;
            confidence: number;
            isConfident: boolean;
            topSuggestion: {
                id: number;
                name: string;
                confidence: number;
                distance: number;
            } | null;
            allSuggestions: Array<{
                id: number;
                name: string;
                confidence: number;
                distance: number;
            }>;
            label: string;
            reason: string | null;
        }>;
        highConfidenceCount: number;
        lowConfidenceCount: number;
    }>;
    mergeClusterFaces(userId: number, faces: {
        itemId: number;
        faceIndex: number;
    }[]): Promise<{
        message: string;
        updatedCount: number;
    }>;
    setProfilePictureFromGalleryItem(userId: number, galleryItemId: number): Promise<{
        updated: boolean;
        message: string;
    }>;
    ignoreClusterFaces(faces: {
        itemId: number;
        faceIndex: number;
    }[]): Promise<{
        message: string;
        updatedCount: number;
    }>;
    resetIgnoredFaces(): Promise<{
        message: string;
        resetCount: number;
    }>;
};
export { galleryService, buildLabeledDescriptors };
export default galleryService;
//# sourceMappingURL=galleryService.d.ts.map