declare const galleryRepository: {
    findAllLight(): import(".prisma/client").Prisma.PrismaPromise<{
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        scanStatus: string | null;
        metadataStatus: string | null;
        metadata: {
            personCount: number;
            dominantColor: string | null;
            aspectRatio: number | null;
            orientation: string | null;
            rawJson: import("@prisma/client/runtime/library").JsonValue;
            objects: import("@prisma/client/runtime/library").JsonValue;
            ocrText: string[];
            scenes: import("@prisma/client/runtime/library").JsonValue;
        } | null;
        hashtags: {
            name: string;
        }[];
    }[]>;
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        metadata: {
            id: number;
            hashtags: import("@prisma/client/runtime/library").JsonValue | null;
            galleryItemId: number;
            personCount: number;
            dominantColor: string | null;
            aspectRatio: number | null;
            orientation: string | null;
            rawJson: import("@prisma/client/runtime/library").JsonValue | null;
            objects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrText: string[];
            scenes: import("@prisma/client/runtime/library").JsonValue | null;
            description: string | null;
            aiSummary: string | null;
            scene: import("@prisma/client/runtime/library").JsonValue | null;
            detectedObjects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrTextJson: import("@prisma/client/runtime/library").JsonValue | null;
            peopleCount: number | null;
            eventName: string | null;
            location: string | null;
            generatedAt: Date | null;
            metadataVersion: number | null;
            lastMetaError: string | null;
            metadataEditedByUser: boolean | null;
        } | null;
        hashtags: {
            name: string;
            id: number;
        }[];
    } & {
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        scanStatus: string | null;
        metadataStatus: string | null;
    })[]>;
    findById(id: number): import(".prisma/client").Prisma.Prisma__GalleryItemClient<({
        metadata: {
            id: number;
            hashtags: import("@prisma/client/runtime/library").JsonValue | null;
            galleryItemId: number;
            personCount: number;
            dominantColor: string | null;
            aspectRatio: number | null;
            orientation: string | null;
            rawJson: import("@prisma/client/runtime/library").JsonValue | null;
            objects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrText: string[];
            scenes: import("@prisma/client/runtime/library").JsonValue | null;
            description: string | null;
            aiSummary: string | null;
            scene: import("@prisma/client/runtime/library").JsonValue | null;
            detectedObjects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrTextJson: import("@prisma/client/runtime/library").JsonValue | null;
            peopleCount: number | null;
            eventName: string | null;
            location: string | null;
            generatedAt: Date | null;
            metadataVersion: number | null;
            lastMetaError: string | null;
            metadataEditedByUser: boolean | null;
        } | null;
        hashtags: {
            name: string;
            id: number;
        }[];
    } & {
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        scanStatus: string | null;
        metadataStatus: string | null;
    }) | null, null, import("@prisma/client/runtime/library").DefaultArgs>;
    findByHashtag(tag: string): Promise<({
        metadata: {
            id: number;
            hashtags: import("@prisma/client/runtime/library").JsonValue | null;
            galleryItemId: number;
            personCount: number;
            dominantColor: string | null;
            aspectRatio: number | null;
            orientation: string | null;
            rawJson: import("@prisma/client/runtime/library").JsonValue | null;
            objects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrText: string[];
            scenes: import("@prisma/client/runtime/library").JsonValue | null;
            description: string | null;
            aiSummary: string | null;
            scene: import("@prisma/client/runtime/library").JsonValue | null;
            detectedObjects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrTextJson: import("@prisma/client/runtime/library").JsonValue | null;
            peopleCount: number | null;
            eventName: string | null;
            location: string | null;
            generatedAt: Date | null;
            metadataVersion: number | null;
            lastMetaError: string | null;
            metadataEditedByUser: boolean | null;
        } | null;
        hashtags: {
            name: string;
            id: number;
        }[];
    } & {
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        scanStatus: string | null;
        metadataStatus: string | null;
    })[]>;
    updateById(id: number, data: any): Promise<{
        metadata: {
            id: number;
            hashtags: import("@prisma/client/runtime/library").JsonValue | null;
            galleryItemId: number;
            personCount: number;
            dominantColor: string | null;
            aspectRatio: number | null;
            orientation: string | null;
            rawJson: import("@prisma/client/runtime/library").JsonValue | null;
            objects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrText: string[];
            scenes: import("@prisma/client/runtime/library").JsonValue | null;
            description: string | null;
            aiSummary: string | null;
            scene: import("@prisma/client/runtime/library").JsonValue | null;
            detectedObjects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrTextJson: import("@prisma/client/runtime/library").JsonValue | null;
            peopleCount: number | null;
            eventName: string | null;
            location: string | null;
            generatedAt: Date | null;
            metadataVersion: number | null;
            lastMetaError: string | null;
            metadataEditedByUser: boolean | null;
        } | null;
        hashtags: {
            name: string;
            id: number;
        }[];
    } & {
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        scanStatus: string | null;
        metadataStatus: string | null;
    }>;
    createMany(items: any[]): Promise<({
        metadata: {
            id: number;
            hashtags: import("@prisma/client/runtime/library").JsonValue | null;
            galleryItemId: number;
            personCount: number;
            dominantColor: string | null;
            aspectRatio: number | null;
            orientation: string | null;
            rawJson: import("@prisma/client/runtime/library").JsonValue | null;
            objects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrText: string[];
            scenes: import("@prisma/client/runtime/library").JsonValue | null;
            description: string | null;
            aiSummary: string | null;
            scene: import("@prisma/client/runtime/library").JsonValue | null;
            detectedObjects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrTextJson: import("@prisma/client/runtime/library").JsonValue | null;
            peopleCount: number | null;
            eventName: string | null;
            location: string | null;
            generatedAt: Date | null;
            metadataVersion: number | null;
            lastMetaError: string | null;
            metadataEditedByUser: boolean | null;
        } | null;
        hashtags: {
            name: string;
            id: number;
        }[];
    } & {
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        scanStatus: string | null;
        metadataStatus: string | null;
    })[]>;
    createOne(data: any): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        metadata: {
            id: number;
            hashtags: import("@prisma/client/runtime/library").JsonValue | null;
            galleryItemId: number;
            personCount: number;
            dominantColor: string | null;
            aspectRatio: number | null;
            orientation: string | null;
            rawJson: import("@prisma/client/runtime/library").JsonValue | null;
            objects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrText: string[];
            scenes: import("@prisma/client/runtime/library").JsonValue | null;
            description: string | null;
            aiSummary: string | null;
            scene: import("@prisma/client/runtime/library").JsonValue | null;
            detectedObjects: import("@prisma/client/runtime/library").JsonValue | null;
            ocrTextJson: import("@prisma/client/runtime/library").JsonValue | null;
            peopleCount: number | null;
            eventName: string | null;
            location: string | null;
            generatedAt: Date | null;
            metadataVersion: number | null;
            lastMetaError: string | null;
            metadataEditedByUser: boolean | null;
        } | null;
        hashtags: {
            name: string;
            id: number;
        }[];
    } & {
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        scanStatus: string | null;
        metadataStatus: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    deleteById(id: number): import(".prisma/client").Prisma.Prisma__GalleryItemClient<{
        url: string;
        id: number;
        uploadedAt: Date;
        userId: number | null;
        isProfile: boolean;
        recognizedUserIds: number[];
        faceDescriptors: import("@prisma/client/runtime/library").JsonValue | null;
        scanStatus: string | null;
        metadataStatus: string | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    hideOldProfilePictures(userId: number): import(".prisma/client").Prisma.PrismaPromise<import(".prisma/client").Prisma.BatchPayload>;
    getAllUniqueHashtags(): import(".prisma/client").Prisma.PrismaPromise<{
        name: string;
        id: number;
    }[]>;
};
export default galleryRepository;
//# sourceMappingURL=galleryRepository.d.ts.map