declare function loadModels(): Promise<void>;
declare function euclideanDistance(d1: Float32Array, d2: Float32Array): number;
declare function cosineDistance(d1: Float32Array, d2: Float32Array): number;
declare function serializeDescriptor(descriptor: Float32Array | number[]): number[];
declare function deserializeDescriptor(data: any): Float32Array | null;
type MatchResult = {
    label: string;
    distance: number | null;
    secondCandidate?: string;
    secondDistance?: number | null;
    margin?: number | null;
    reason?: 'matched' | 'threshold' | 'ambiguous' | 'no_candidates';
    confidence?: number;
};
declare function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[], isForcedRescan?: boolean): MatchResult;
declare function getFaceDescriptor(imagePath: string, options?: any): Promise<Float32Array | null>;
declare function identifyFace(targetImagePath: string, knownUsers: any[]): Promise<MatchResult | null>;
declare function identifyAllFaces(targetImagePath: string, knownUsers: any[]): Promise<any>;
declare function getFaceSuggestions(targetImagePath: string, knownUsers: any[]): Promise<any[]>;
declare function getAllDescriptors(imagePath: string): Promise<Float32Array[]>;
declare function detectFaces(imagePath: string, options?: any): Promise<{
    faces: any;
    metadata: any;
}>;
declare function detectFacesBatch(imagePaths: string[]): Promise<Array<{
    faces: Array<{
        descriptor: Float32Array;
        box: any;
    }>;
    metadata: any;
}>>;
declare function extractMetadata(imagePath: string): Promise<any>;
declare const _default: {
    getFaceDescriptor: typeof getFaceDescriptor;
    identifyFace: typeof identifyFace;
    identifyAllFaces: typeof identifyAllFaces;
    getAllDescriptors: typeof getAllDescriptors;
    detectFaces: typeof detectFaces;
    detectFacesBatch: typeof detectFacesBatch;
    extractMetadata: typeof extractMetadata;
    getFaceSuggestions: typeof getFaceSuggestions;
    serializeDescriptor: typeof serializeDescriptor;
    deserializeDescriptor: typeof deserializeDescriptor;
    findBestMatchWithMargin: typeof findBestMatchWithMargin;
    loadModels: typeof loadModels;
    MATCH_THRESHOLD: number;
    euclideanDistance: typeof euclideanDistance;
    cosineDistance: typeof cosineDistance;
};
export default _default;
//# sourceMappingURL=faceAi.d.ts.map