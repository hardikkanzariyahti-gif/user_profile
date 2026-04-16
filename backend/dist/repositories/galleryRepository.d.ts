interface GalleryItemData {
    url: string;
    uploadedAt: Date;
    label?: string;
    isProfile?: boolean;
    userId?: number | null;
    recognizedUserIds: number[];
}
declare const galleryRepository: {
    findAll(): import(".prisma/client").Prisma.PrismaPromise<{
        id: number;
        url: string;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
    }[]>;
    updateById(id: number, data: any): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        id: number;
        url: string;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    createMany(items: GalleryItemData[]): import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.BatchPayload>;
    createOne(data: GalleryItemData): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        id: number;
        url: string;
        uploadedAt: Date;
        label: string | null;
        isProfile: boolean;
        userId: number | null;
        recognizedUserIds: number[];
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
export default galleryRepository;
//# sourceMappingURL=galleryRepository.d.ts.map