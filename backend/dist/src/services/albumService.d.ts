declare const albumService: {
    createAlbum(data: {
        title: string;
        description?: string;
        userId: number;
        itemIds: number[];
        isGlobal?: boolean;
    }): Promise<{
        items: {
            id: number;
            uploadedAt: Date;
            hashtags: string[];
            label: string | null;
            userId: number | null;
            url: string;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: number;
        userId: number;
        title: string;
        description: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
    getAlbumsByUser(userId: number): Promise<({
        items: {
            id: number;
            uploadedAt: Date;
            hashtags: string[];
            label: string | null;
            userId: number | null;
            url: string;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        user: {
            name: string;
        };
    } & {
        id: number;
        userId: number;
        title: string;
        description: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    })[]>;
    getAlbumById(id: number, userId: number): Promise<{
        items: {
            id: number;
            uploadedAt: Date;
            hashtags: string[];
            label: string | null;
            userId: number | null;
            url: string;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        user: {
            id: number;
            name: string;
        };
    } & {
        id: number;
        userId: number;
        title: string;
        description: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
    getSharedAlbum(shareId: string): Promise<{
        items: {
            id: number;
            uploadedAt: Date;
            hashtags: string[];
            label: string | null;
            userId: number | null;
            url: string;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
        user: {
            name: string;
        };
    } & {
        id: number;
        userId: number;
        title: string;
        description: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
    deleteAlbum(id: number, userId: number): Promise<{
        id: number;
        userId: number;
        title: string;
        description: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
    updateAlbum(id: number, userId: number, data: {
        title?: string;
        description?: string;
        itemIds?: number[];
    }): Promise<{
        items: {
            id: number;
            uploadedAt: Date;
            hashtags: string[];
            label: string | null;
            userId: number | null;
            url: string;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        }[];
    } & {
        id: number;
        userId: number;
        title: string;
        description: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
};
export default albumService;
//# sourceMappingURL=albumService.d.ts.map