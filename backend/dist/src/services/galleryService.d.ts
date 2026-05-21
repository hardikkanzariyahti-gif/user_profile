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
    listGallery(userId?: any, search?: string): Promise<{
        id: number;
        url: string | null | undefined;
        thumbnailUrl: string | null | undefined;
        uploadedAt: Date;
        createdAt: any;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        metadata: {
            description: any;
            aiSummary: any;
            scene: any;
            detectedObjects: any;
            hashtags: any;
            ocrText: any;
            peopleCount: any;
            eventName: any;
            location: any;
            dominantColor: any;
            aspectRatio: any;
            customDetails: {
                dominant_color: any;
                aspect_ratio: any;
                orientation: any;
                generatedAt: any;
                metadataVersion: any;
            };
            objects: any;
            scenes: any;
            caption: any;
            person_count: any;
            dominant_color: any;
            aspect_ratio: any;
            orientation: any;
            customLocation: any;
            customEvent: any;
            lastScanError: any;
            lastMetaError: any;
        };
        people: any;
        recognizedUsers: any;
        scanStatus: string;
        metadataStatus: string;
        lastScanError: any;
        lastMetaError: any;
        recognizedUserIds: number[];
        hashtags: any;
        objectTags: any;
        sceneTags: any;
        ocrText: any;
        faces: {
            faceId: string;
            box: any;
            expandedBox: any;
            personId: any;
            personName: any;
            similarity: any;
            status: any;
            confidence: any;
            reason: any;
        }[];
    }[]>;
    getGalleryItem(id: number): Promise<{
        id: number;
        url: string | null | undefined;
        thumbnailUrl: string | null | undefined;
        uploadedAt: Date;
        createdAt: any;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        metadata: {
            description: any;
            aiSummary: any;
            scene: any;
            detectedObjects: any;
            hashtags: any;
            ocrText: any;
            peopleCount: any;
            eventName: any;
            location: any;
            dominantColor: any;
            aspectRatio: any;
            customDetails: {
                dominant_color: any;
                aspect_ratio: any;
                orientation: any;
                generatedAt: any;
                metadataVersion: any;
            };
            objects: any;
            scenes: any;
            caption: any;
            person_count: any;
            dominant_color: any;
            aspect_ratio: any;
            orientation: any;
            customLocation: any;
            customEvent: any;
            lastScanError: any;
            lastMetaError: any;
        };
        people: any;
        recognizedUsers: any;
        scanStatus: string;
        metadataStatus: string;
        lastScanError: any;
        lastMetaError: any;
        recognizedUserIds: number[];
        hashtags: any;
        objectTags: any;
        sceneTags: any;
        ocrText: any;
        faces: {
            faceId: string;
            box: any;
            expandedBox: any;
            personId: any;
            personName: any;
            similarity: any;
            status: any;
            confidence: any;
            reason: any;
        }[];
    }>;
    deleteGalleryItem(id: number): Promise<{
        message: string;
    }>;
    setGalleryItemHashtags(id: number, hashtagsInput: any): Promise<{
        id: number;
        url: string | null | undefined;
        thumbnailUrl: string | null | undefined;
        uploadedAt: Date;
        createdAt: any;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        metadata: {
            description: any;
            aiSummary: any;
            scene: any;
            detectedObjects: any;
            hashtags: any;
            ocrText: any;
            peopleCount: any;
            eventName: any;
            location: any;
            dominantColor: any;
            aspectRatio: any;
            customDetails: {
                dominant_color: any;
                aspect_ratio: any;
                orientation: any;
                generatedAt: any;
                metadataVersion: any;
            };
            objects: any;
            scenes: any;
            caption: any;
            person_count: any;
            dominant_color: any;
            aspect_ratio: any;
            orientation: any;
            customLocation: any;
            customEvent: any;
            lastScanError: any;
            lastMetaError: any;
        };
        people: any;
        recognizedUsers: any;
        scanStatus: string;
        metadataStatus: string;
        lastScanError: any;
        lastMetaError: any;
        recognizedUserIds: number[];
        hashtags: any;
        objectTags: any;
        sceneTags: any;
        ocrText: any;
        faces: {
            faceId: string;
            box: any;
            expandedBox: any;
            personId: any;
            personName: any;
            similarity: any;
            status: any;
            confidence: any;
            reason: any;
        }[];
    }>;
    setGalleryItemCustomMetadata(id: number, customLocation: string, customEvent: string): Promise<{
        id: number;
        url: string | null | undefined;
        thumbnailUrl: string | null | undefined;
        uploadedAt: Date;
        createdAt: any;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        metadata: {
            description: any;
            aiSummary: any;
            scene: any;
            detectedObjects: any;
            hashtags: any;
            ocrText: any;
            peopleCount: any;
            eventName: any;
            location: any;
            dominantColor: any;
            aspectRatio: any;
            customDetails: {
                dominant_color: any;
                aspect_ratio: any;
                orientation: any;
                generatedAt: any;
                metadataVersion: any;
            };
            objects: any;
            scenes: any;
            caption: any;
            person_count: any;
            dominant_color: any;
            aspect_ratio: any;
            orientation: any;
            customLocation: any;
            customEvent: any;
            lastScanError: any;
            lastMetaError: any;
        };
        people: any;
        recognizedUsers: any;
        scanStatus: string;
        metadataStatus: string;
        lastScanError: any;
        lastMetaError: any;
        recognizedUserIds: number[];
        hashtags: any;
        objectTags: any;
        sceneTags: any;
        ocrText: any;
        faces: {
            faceId: string;
            box: any;
            expandedBox: any;
            personId: any;
            personName: any;
            similarity: any;
            status: any;
            confidence: any;
            reason: any;
        }[];
    }>;
    searchGalleryByHashtag(rawTag: string): Promise<{
        id: number;
        url: string | null | undefined;
        thumbnailUrl: string | null | undefined;
        uploadedAt: Date;
        createdAt: any;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        metadata: {
            description: any;
            aiSummary: any;
            scene: any;
            detectedObjects: any;
            hashtags: any;
            ocrText: any;
            peopleCount: any;
            eventName: any;
            location: any;
            dominantColor: any;
            aspectRatio: any;
            customDetails: {
                dominant_color: any;
                aspect_ratio: any;
                orientation: any;
                generatedAt: any;
                metadataVersion: any;
            };
            objects: any;
            scenes: any;
            caption: any;
            person_count: any;
            dominant_color: any;
            aspect_ratio: any;
            orientation: any;
            customLocation: any;
            customEvent: any;
            lastScanError: any;
            lastMetaError: any;
        };
        people: any;
        recognizedUsers: any;
        scanStatus: string;
        metadataStatus: string;
        lastScanError: any;
        lastMetaError: any;
        recognizedUserIds: number[];
        hashtags: any;
        objectTags: any;
        sceneTags: any;
        ocrText: any;
        faces: {
            faceId: string;
            box: any;
            expandedBox: any;
            personId: any;
            personName: any;
            similarity: any;
            status: any;
            confidence: any;
            reason: any;
        }[];
    }[]>;
    uploadGallery(files?: any[], userId?: any, eventInfo?: {
        eventName?: string;
        location?: string;
        date?: string;
        description?: string;
        eventId?: number;
        tags?: string[];
    }): Promise<{
        gallery: {
            id: number;
            url: string | null | undefined;
            thumbnailUrl: string | null | undefined;
            uploadedAt: Date;
            createdAt: any;
            label: string | null | undefined;
            isProfile: boolean;
            userId: number | null | undefined;
            metadata: {
                description: any;
                aiSummary: any;
                scene: any;
                detectedObjects: any;
                hashtags: any;
                ocrText: any;
                peopleCount: any;
                eventName: any;
                location: any;
                dominantColor: any;
                aspectRatio: any;
                customDetails: {
                    dominant_color: any;
                    aspect_ratio: any;
                    orientation: any;
                    generatedAt: any;
                    metadataVersion: any;
                };
                objects: any;
                scenes: any;
                caption: any;
                person_count: any;
                dominant_color: any;
                aspect_ratio: any;
                orientation: any;
                customLocation: any;
                customEvent: any;
                lastScanError: any;
                lastMetaError: any;
            };
            people: any;
            recognizedUsers: any;
            scanStatus: string;
            metadataStatus: string;
            lastScanError: any;
            lastMetaError: any;
            recognizedUserIds: number[];
            hashtags: any;
            objectTags: any;
            sceneTags: any;
            ocrText: any;
            faces: {
                faceId: string;
                box: any;
                expandedBox: any;
                personId: any;
                personName: any;
                similarity: any;
                status: any;
                confidence: any;
                reason: any;
            }[];
        }[];
        albumId: number | null;
        uploadedItemIds: number[];
    }>;
    forceScanItem(galleryItemId: number): Promise<{
        message: string;
        skipped: boolean;
    } | {
        message: string;
        skipped?: undefined;
    }>;
    identifyFacesInDetections(detections: any[], labeledDescriptors: LabeledFaceDescriptors[], faceDescs: any[], baseIds: number[]): Promise<{
        aiIds: number[];
        descriptors: {
            descriptor: number[];
            box: any;
            rejectedUserIds: any;
            manuallyTaggedUserId: any;
            isIgnored: any;
        }[];
    }>;
    tagUnknownFace(galleryItemId: number, userId: number, faceIndex?: number): Promise<{
        message: string;
        profilePictureSet: boolean;
    }>;
    bulkTagAndAlbum(itemIds: number[], targetUserId: number | null | undefined, currentUserId: number, targetTagName?: string | null): Promise<{
        success: boolean;
        message: string;
        albumId: number;
        albumTitle: string;
    }>;
    untagFace(galleryItemId: number, userId: number, faceIndex?: number): Promise<{
        message: string;
    }>;
    getProcessingStatus(): Promise<{
        isProcessing: boolean;
        total: number;
        completed: number;
        stage: "Upload" | "Face" | "Metadata" | "Complete";
    }>;
    syncState: {
        isScanning: boolean;
        total: number;
        current: number;
    };
    refreshGalleryRecognition(forceRescan?: boolean): Promise<{
        message: string;
        forceRescan?: undefined;
        updatedCount?: undefined;
        total?: undefined;
        durationSc?: undefined;
    } | {
        message: string;
        forceRescan: boolean;
        updatedCount?: undefined;
        total?: undefined;
        durationSc?: undefined;
    } | {
        updatedCount: number;
        total: number;
        durationSc: string;
        message?: undefined;
        forceRescan?: undefined;
    }>;
    getUnknownFaceClusters(): Promise<any[]>;
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
    getAllHashtags(): Promise<string[]>;
    getSearchSuggestions(query: string): Promise<any[]>;
    backfillState: {
        isRunning: boolean;
        total: number;
        processed: number;
        failed: number;
        currentImageId: number | null;
        startedAt: Date | null;
        finishedAt: Date | null;
    };
    backfillMissingMetadata(force?: boolean): Promise<{
        isRunning: boolean;
        total: number;
        processed: number;
        failed: number;
        currentImageId: number | null;
        startedAt: Date | null;
        finishedAt: Date | null;
        running: boolean;
        message: string;
    } | {
        running: boolean;
        message: string;
        total: number;
        processed: number;
        failed: number;
    }>;
    getBackfillStatus(): {
        running: boolean;
        total: number;
        processed: number;
        failed: number;
        remaining: number;
        currentImageId: number | null;
        startedAt: Date | null;
        finishedAt: Date | null;
    };
    processGalleryImage(imageId: number, isForceScan?: boolean, isForceMeta?: boolean): Promise<{
        id: number;
        url: string | null | undefined;
        thumbnailUrl: string | null | undefined;
        uploadedAt: Date;
        createdAt: any;
        label: string | null | undefined;
        isProfile: boolean;
        userId: number | null | undefined;
        metadata: {
            description: any;
            aiSummary: any;
            scene: any;
            detectedObjects: any;
            hashtags: any;
            ocrText: any;
            peopleCount: any;
            eventName: any;
            location: any;
            dominantColor: any;
            aspectRatio: any;
            customDetails: {
                dominant_color: any;
                aspect_ratio: any;
                orientation: any;
                generatedAt: any;
                metadataVersion: any;
            };
            objects: any;
            scenes: any;
            caption: any;
            person_count: any;
            dominant_color: any;
            aspect_ratio: any;
            orientation: any;
            customLocation: any;
            customEvent: any;
            lastScanError: any;
            lastMetaError: any;
        };
        people: any;
        recognizedUsers: any;
        scanStatus: string;
        metadataStatus: string;
        lastScanError: any;
        lastMetaError: any;
        recognizedUserIds: number[];
        hashtags: any;
        objectTags: any;
        sceneTags: any;
        ocrText: any;
        faces: {
            faceId: string;
            box: any;
            expandedBox: any;
            personId: any;
            personName: any;
            similarity: any;
            status: any;
            confidence: any;
            reason: any;
        }[];
    }>;
    processGalleryImageDirect(imageId: number, isForceScan?: boolean, isForceMeta?: boolean): Promise<void>;
    generateMetadataForImage(imageId: number, forceRegenerateAI?: boolean): Promise<any>;
    generateMetadata(imageId: number): Promise<any>;
    scanAndRecognizeImage(imageId: number): Promise<void>;
    syncWithFileSystem(): Promise<{
        count: number;
    }>;
    initializeQueue(): Promise<void>;
    cancelProcessing(): Promise<{
        success: boolean;
        message: string;
        activeCancelled: number;
        queuedCancelled: number;
        cleanedCount: number;
        affectedDetails: {
            id: number;
            url: string;
        }[];
    }>;
};
export { galleryService, buildLabeledDescriptors };
export default galleryService;
//# sourceMappingURL=galleryService.d.ts.map