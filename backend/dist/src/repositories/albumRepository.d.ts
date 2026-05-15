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
            url: string;
            id: number;
            uploadedAt: Date;
            userId: number | null;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
            scanStatus: string | null;
            metadataStatus: string | null;
        }[];
    } & {
        id: number;
        userId: number;
        description: string | null;
        title: string;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
    findById(id: number): import(".prisma/client").Prisma.Prisma__AlbumClient<({
        user: {
            name: string;
            id: number;
        };
        items: {
            url: string;
            id: number;
            uploadedAt: Date;
            userId: number | null;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
            scanStatus: string | null;
            metadataStatus: string | null;
        }[];
    } & {
        id: number;
        userId: number;
        description: string | null;
        title: string;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByShareId(shareId: string): import(".prisma/client").Prisma.Prisma__AlbumClient<({
        user: {
            name: string;
        };
        items: {
            url: string;
            id: number;
            uploadedAt: Date;
            userId: number | null;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
            scanStatus: string | null;
            metadataStatus: string | null;
        }[];
    } & {
        id: number;
        userId: number;
        description: string | null;
        title: string;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findAllByUserId(userId: number): import(".prisma/client").Prisma.PrismaPromise<({
        user: {
            name: string;
        };
        items: {
            url: string;
            id: number;
            uploadedAt: Date;
            userId: number | null;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
            scanStatus: string | null;
            metadataStatus: string | null;
        }[];
    } & {
        id: number;
        userId: number;
        description: string | null;
        title: string;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    })[]>;
    delete(id: number): import(".prisma/client").Prisma.Prisma__AlbumClient<{
        id: number;
        userId: number;
        description: string | null;
        title: string;
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
            url: string;
            id: number;
            uploadedAt: Date;
            userId: number | null;
            isProfile: boolean;
            recognizedUserIds: number[];
            faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
            scanStatus: string | null;
            metadataStatus: string | null;
        }[];
    } & {
        id: number;
        userId: number;
        description: string | null;
        title: string;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
export default albumRepository;
//# sourceMappingURL=albumRepository.d.ts.map