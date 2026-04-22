interface GalleryItemData {
    url: string;
    uploadedAt: Date;
    label?: string;
    isProfile?: boolean;
    userId?: number | null;
    recognizedUserIds: number[];
    faceDescriptors?: any;
}
declare const galleryRepository: {
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        url: string;
        id: number;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
        hashtags: string[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    findById(id: number): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        url: string;
        id: number;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
        hashtags: string[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
    } | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByHashtag(tag: string): import(".prisma/client").Prisma.PrismaPromise<{
        url: string;
        id: number;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
        hashtags: string[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
    }[]>;
    updateById(id: number, data: any): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        url: string;
        id: number;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
        hashtags: string[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    createMany(items: GalleryItemData[]): import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.BatchPayload>;
    createOne(data: GalleryItemData): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        url: string;
        id: number;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
        hashtags: string[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    deleteById(id: number): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        url: string;
        id: number;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
        hashtags: string[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
export default galleryRepository;
//# sourceMappingURL=galleryRepository.d.ts.map