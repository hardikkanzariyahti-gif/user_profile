declare function loadModels(): Promise<void>;
declare function euclideanDistance(d1: Float32Array, d2: Float32Array): number;
declare function serializeDescriptor(descriptor: Float32Array | number[]): number[];
declare function deserializeDescriptor(data: any): Float32Array | null;
type MatchDecisionReason = 'matched' | 'threshold' | 'ambiguous' | 'no_candidates';
type MatchResult = {
    label: string;
    distance: number | null;
    candidate?: string;
    secondCandidate?: string;
    secondDistance?: number | null;
    margin?: number | null;
    reason?: MatchDecisionReason;
    confidence?: number;
};
/**
 * Match a 512D face descriptor against all known users.
 * Contains safety check for mixed 128D/512D arrays.
 */
declare function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]): MatchResult;
/**
 * Get the single best/largest face descriptor from an image (for profile pictures).
 */
declare function getFaceDescriptor(imagePath: string): Promise<Float32Array | null>;
declare function identifyFace(targetImagePath: string, knownUsers: any[]): Promise<MatchResult | null>;
/**
 * Detect & identify ALL faces in an image
 */
declare function identifyAllFaces(targetImagePath: string, knownUsers: any[]): Promise<{
    label: string;
    distance: number | null;
    secondDistance: number | null;
    margin: number | null;
    reason: MatchDecisionReason | null;
    confidence: number;
    box: any;
}[]>;
/**
 * Instant recognition for upload - gets top suggestions per face with confidence
 */
declare function getFaceSuggestions(targetImagePath: string, knownUsers: any[]): Promise<any[]>;
/**
 * Just return all descriptor arrays.
 */
declare function getAllDescriptors(imagePath: string): Promise<Float32Array[]>;
/**
 * Core function for bulk gallery scanning — single image.
 */
declare function detectFaces(imagePath: string): Promise<{
    descriptor: Float32Array<ArrayBufferLike>;
    box: any;
}[]>;
/**
 * Core function for bulk gallery scanning — PARALLEL BATCH.
 * Sends multiple images to Python in ONE request and processes them in parallel.
 * Returns results in same order as imagePaths.
 */
declare function detectFacesBatch(imagePaths: string[]): Promise<Array<Array<{
    descriptor: Float32Array;
    box: any;
}>>>;
declare const _default: {
    getFaceDescriptor: typeof getFaceDescriptor;
    identifyFace: typeof identifyFace;
    identifyAllFaces: typeof identifyAllFaces;
    getAllDescriptors: typeof getAllDescriptors;
    detectFaces: typeof detectFaces;
    detectFacesBatch: typeof detectFacesBatch;
    getFaceSuggestions: typeof getFaceSuggestions;
    serializeDescriptor: typeof serializeDescriptor;
    deserializeDescriptor: typeof deserializeDescriptor;
    findBestMatchWithMargin: typeof findBestMatchWithMargin;
    loadModels: typeof loadModels;
    MATCH_THRESHOLD: number;
    euclideanDistance: typeof euclideanDistance;
};
export default _default;
//# sourceMappingURL=faceAi.d.ts.map