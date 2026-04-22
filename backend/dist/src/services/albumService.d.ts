declare const albumService: {
    createAlbum(data: {
        title: string;
        description?: string;
        userId: number;
        itemIds: number[];
        isGlobal?: boolean;
    }): Promise<{
        items: {
            url: string;
            id: number;
            uploadedAt: Date;
            label: string | null;
            isProfile: boolean;
            userId: number | null;
            recognizedUserIds: number[];
            hashtags: string[];
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
        user: {
            name: string;
        };
        items: {
            url: string;
            id: number;
            uploadedAt: Date;
            label: string | null;
            isProfile: boolean;
            userId: number | null;
            recognizedUserIds: number[];
            hashtags: string[];
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
    })[]>;
    getAlbumById(id: number, userId: number): Promise<{
        user: {
            name: string;
            id: number;
        };
        items: {
            url: string;
            id: number;
            uploadedAt: Date;
            label: string | null;
            isProfile: boolean;
            userId: number | null;
            recognizedUserIds: number[];
            hashtags: string[];
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
    getSharedAlbum(shareId: string): Promise<{
        user: {
            name: string;
        };
        items: {
            url: string;
            id: number;
            uploadedAt: Date;
            label: string | null;
            isProfile: boolean;
            userId: number | null;
            recognizedUserIds: number[];
            hashtags: string[];
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
            url: string;
            id: number;
            uploadedAt: Date;
            label: string | null;
            isProfile: boolean;
            userId: number | null;
            recognizedUserIds: number[];
            hashtags: string[];
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