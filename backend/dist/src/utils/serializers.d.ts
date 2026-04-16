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
    url: string;
    uploadedAt: Date;
    label: string | null | undefined;
    isProfile: boolean;
    userId: number | null | undefined;
    recognizedUserIds: number[];
    recognizedUsers: any[];
};
export { toUserResponse, toGalleryResponse };
//# sourceMappingURL=serializers.d.ts.map