interface User {
    id: number;
    name: string;
    email: string;
    profile_picture?: string | null;
}
interface GalleryItem {
    id: number;
    url: string;
    uploadedAt: Date;
    label?: string | null;
    isProfile: boolean;
    userId?: number | null;
    recognizedUserIds: number[];
    hashtags: string[];
    faceDescriptors?: any | null;
}
declare function toUserResponse(user: User): {
    id: number;
    name: string;
    email: string;
    profilePicture: string | null | undefined;
    "profile picture": string | null | undefined;
};
declare function toGalleryResponse(item: GalleryItem & {
    recognizedUsers?: any[];
}): {
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
};
export { toUserResponse, toGalleryResponse };
//# sourceMappingURL=serializers.d.ts.map