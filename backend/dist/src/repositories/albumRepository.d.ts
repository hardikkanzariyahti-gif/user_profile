interface AlbumData {
    title: string;
    description?: string;
    userId: number;
    itemIds: number[];
}
declare const albumRepository: {
    create(data: AlbumData & {
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
    findById(id: number): import(".prisma/client").Prisma.Prisma__AlbumClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByShareId(shareId: string): import(".prisma/client").Prisma.Prisma__AlbumClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findAllByUserId(userId: number): import(".prisma/client").Prisma.PrismaPromise<({
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
    delete(id: number): import(".prisma/client").Prisma.Prisma__AlbumClient<{
        id: number;
        userId: number;
        title: string;
        description: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: number, data: {
        title?: string;
        description?: string;
        itemIds?: number[];
    }): import(".prisma/client").Prisma.Prisma__AlbumClient<{
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
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
export default albumRepository;
//# sourceMappingURL=albumRepository.d.ts.map