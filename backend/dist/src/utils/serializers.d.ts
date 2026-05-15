interface User {
    id: number;
    name: string;
    email: string;
    profile_picture?: string | null;
    profile_pictures?: string[] | null;
}
interface GalleryItem {
    id: number;
    url: string;
    uploadedAt: Date;
    label?: string | null;
    isProfile: boolean;
    userId?: number | null;
    recognizedUserIds: number[];
    hashtags?: any[];
    metadata?: any;
    faceDescriptors?: any | null;
    scanStatus?: string | null;
    metadataStatus?: string | null;
}
declare function toUserResponse(user: User): {
    id: number;
    name: string;
    email: string;
    profilePicture: string | null | undefined;
    profilePictures: (string | null | undefined)[];
    "profile picture": string | null | undefined;
    "profile pictures": (string | null | undefined)[];
};
declare function toGalleryResponse(item: GalleryItem & {
    recognizedUsers?: any[];
}): {
    id: number;
    url: string | null | undefined;
    thumbnailUrl: string | null | undefined;
    uploadedAt: Date;
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
    people: {
        id: any;
        name: any;
        profilePicture: string | null;
    }[];
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
    recognizedUsers: {
        id: any;
        name: any;
        profilePicture: string | null;
    }[];
};
export { toUserResponse, toGalleryResponse };
//# sourceMappingURL=serializers.d.ts.map