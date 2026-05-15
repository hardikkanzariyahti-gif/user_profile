import { Queue } from 'bullmq';
export declare function getGalleryScanQueue(): Queue | null;
export declare function getGalleryPreprocessQueue(): Queue | null;
export declare function getGalleryRefreshQueue(): Queue | null;
export type GalleryScanJob = {
    type: 'upload';
    itemIds: number[];
} | {
    type: 'refresh';
    forceRescan: boolean;
};
export type GalleryPreprocessJob = {
    type: 'upload';
    itemIds: number[];
} | {
    type: 'refresh';
    forceRescan: boolean;
};
//# sourceMappingURL=galleryQueues.d.ts.map