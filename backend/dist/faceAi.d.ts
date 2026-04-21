declare function loadModels(): Promise<void>;
declare function euclideanDistance(d1: Float32Array, d2: Float32Array): number;
declare function serializeDescriptor(descriptor: Float32Array | number[]): number[];
declare function deserializeDescriptor(data: any): Float32Array | null;
/**
 * Match a 512D face descriptor against all known users.
 * Contains safety check for mixed 128D/512D arrays.
 */
declare function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]): any;
/**
 * Get the single best/largest face descriptor from an image (for profile pictures).
 */
declare function getFaceDescriptor(imagePath: string): Promise<Float32Array | null>;
declare function identifyFace(targetImagePath: string, knownUsers: any[]): Promise<any>;
/**
 * Detect & identify ALL faces in an image
 */
declare function identifyAllFaces(targetImagePath: string, knownUsers: any[]): Promise<{
    label: any;
    distance: number | null;
    box: any;
}[]>;
/**
 * Just return all descriptor arrays.
 */
declare function getAllDescriptors(imagePath: string): Promise<Float32Array[]>;
/**
 * Core function for bulk gallery scanning
 */
declare function detectFaces(imagePath: string): Promise<{
    descriptor: Float32Array<ArrayBufferLike>;
    box: any;
}[]>;
declare const _default: {
    getFaceDescriptor: typeof getFaceDescriptor;
    identifyFace: typeof identifyFace;
    identifyAllFaces: typeof identifyAllFaces;
    getAllDescriptors: typeof getAllDescriptors;
    detectFaces: typeof detectFaces;
    serializeDescriptor: typeof serializeDescriptor;
    deserializeDescriptor: typeof deserializeDescriptor;
    findBestMatchWithMargin: typeof findBestMatchWithMargin;
    loadModels: typeof loadModels;
    MATCH_THRESHOLD: number;
    euclideanDistance: typeof euclideanDistance;
};
export default _default;
//# sourceMappingURL=faceAi.d.ts.map