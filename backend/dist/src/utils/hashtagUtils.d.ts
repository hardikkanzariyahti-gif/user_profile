declare function normalizeTag(raw: string): string | null;
declare function normalizeHashtags(input: any): string[];
declare function cleanupAIPayload(rawMetadata: any, objects?: any[], scenes?: any[], ocr?: string[]): {
    cleanObjects: any[];
    cleanScenes: any[];
    cleanOcr: string[];
    cleanActivities: string[];
    cleanEnvironment: string[];
    caption: string;
    autoHashtags: string[];
};
declare function enrichMetadataWithHashtagFallbacks(hashtags: string[], existingObjects?: any[], existingScenes?: any[], existingPeopleCount?: number, existingCaption?: string): {
    objects: any[];
    scenes: any[];
    peopleCount: number;
    caption: string;
};
export { normalizeTag, normalizeHashtags, cleanupAIPayload, enrichMetadataWithHashtagFallbacks };
//# sourceMappingURL=hashtagUtils.d.ts.map