import * as faceapi from '@vladmandic/face-api';
declare function loadModels(): Promise<void>;
declare function euclideanDistance(d1: Float32Array, d2: Float32Array): number;
declare function serializeDescriptor(descriptor: Float32Array): number[];
declare function deserializeDescriptor(data: any): Float32Array | null;
/**
 * Match a single face descriptor against all known users.
 *
 * KEY FIX: The old ambiguity margin of 0.01 was killing recognition.
 * Example: Rahul distance=0.42, Hardik distance=0.44 → margin=0.02 → BOTH dropped.
 * New rule: Only return unknown if margin < 0.02 AND the best distance is borderline (> 0.50).
 * If the best match is very confident (< 0.45), we always trust it regardless of margin.
 */
declare function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]): any;
/**
 * Get the single best face descriptor from an image (used for profile pictures).
 * Picks the largest/most prominent face.
 */
declare function getFaceDescriptor(imagePath: string): Promise<Float32Array | null>;
declare function identifyFace(targetImagePath: string, knownUsers: any[]): Promise<any>;
/**
 * Detect & identify ALL faces in an image (used for Identity Check feature).
 */
declare function identifyAllFaces(targetImagePath: string, knownUsers: any[]): Promise<{
    label: any;
    distance: number | null;
    box: any;
}[]>;
declare function getAllDescriptors(imagePath: string): Promise<Float32Array[]>;
/**
 * Detect ALL faces in an image and return their descriptors + bounding boxes.
 * Core function for gallery scanning.
 *
 * Strategy:
 *  Pass 1 — SSD at minConfidence 0.20 (catches clear, prominent faces fast)
 *  Pass 2 — TinyFace inputSize 416 (catches medium/side faces SSD may miss)
 *  Pass 3 — TinyFace inputSize 608 ONLY if pass 1+2 together found < 2 faces
 *            (expensive, only worth it for group photos where we expect more)
 *
 * All results are merged with IoU deduplication.
 */
declare function detectFaces(imagePath: string): Promise<{
    descriptor: Float32Array<ArrayBufferLike>;
    box: faceapi.Box<any>;
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