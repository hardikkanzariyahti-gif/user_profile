interface AlbumData {
    title: string;
    description?: string;
    eventType?: string;
    date?: string;
    location?: string;
    userId: number;
    itemIds?: number[];
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
        location: string | null;
        title: string;
        eventType: string | null;
        date: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
    findById(id: number): Promise<{
        items: ({
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
        })[];
        user: {
            name: string;
            id: number;
        };
        id: number;
        userId: number;
        description: string | null;
        location: string | null;
        title: string;
        eventType: string | null;
        date: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    } | null>;
    findByShareId(shareId: string): Promise<{
        items: ({
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
        })[];
        user: {
            name: string;
        };
        id: number;
        userId: number;
        description: string | null;
        location: string | null;
        title: string;
        eventType: string | null;
        date: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    } | null>;
    findAllByUserId(userId: number): import(".prisma/client").Prisma.PrismaPromise<({
        user: {
            name: string;
        };
        items: ({
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
            people: {
                id: number;
                userId: number | null;
                galleryItemId: number;
                createdAt: Date;
                lastScanError: string | null;
                userName: string | null;
                boundingBox: import("@prisma/client/runtime/library").JsonValue | null;
                confidence: number | null;
                isManualTag: boolean;
            }[];
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
        })[];
    } & {
        id: number;
        userId: number;
        description: string | null;
        location: string | null;
        title: string;
        eventType: string | null;
        date: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    })[]>;
    delete(id: number): import(".prisma/client").Prisma.Prisma__AlbumClient<{
        id: number;
        userId: number;
        description: string | null;
        location: string | null;
        title: string;
        eventType: string | null;
        date: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    update(id: number, data: {
        title?: string;
        description?: string;
        eventType?: string;
        date?: string;
        location?: string;
        itemIds?: number[];
    }): import(".prisma/client").Prisma.Prisma__AlbumClient<{
        items: ({
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
            people: {
                id: number;
                userId: number | null;
                galleryItemId: number;
                createdAt: Date;
                lastScanError: string | null;
                userName: string | null;
                boundingBox: import("@prisma/client/runtime/library").JsonValue | null;
                confidence: number | null;
                isManualTag: boolean;
            }[];
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
        })[];
    } & {
        id: number;
        userId: number;
        description: string | null;
        location: string | null;
        title: string;
        eventType: string | null;
        date: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
};
export default albumRepository;
//# sourceMappingURL=albumRepository.d.ts.map