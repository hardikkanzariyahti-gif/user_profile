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
    findById(id: number): import(".prisma/client").Prisma.Prisma__AlbumClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByShareId(shareId: string): import(".prisma/client").Prisma.Prisma__AlbumClient<({
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
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findAllByUserId(userId: number): import(".prisma/client").Prisma.PrismaPromise<({
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
    }): import(".prisma/client").Prisma.Prisma__AlbumClient<{
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