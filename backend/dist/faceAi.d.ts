declare function loadModels(): Promise<void>;
declare function euclideanDistance(d1: Float32Array, d2: Float32Array): number;
declare function serializeDescriptor(descriptor: Float32Array | number[]): number[];
declare function deserializeDescriptor(data: any): Float32Array | null;
declare function parseLabelToUser(label: string): {
    id: number;
    name: string;
} | null;
declare function findBestMatchWithMargin(descriptor: Float32Array, knownUsers: any[]): {
    label: string;
    distance: any;
    secondCandidate?: undefined;
    secondDistance?: undefined;
    margin?: undefined;
    reason?: undefined;
    confidence?: undefined;
} | {
    label: any;
    distance: any;
    secondCandidate: any;
    secondDistance: any;
    margin: number | null;
    reason: string;
    confidence: number;
};
declare function getFaceSuggestions(imagePath: string, labeledDescriptors: any[]): never[];
declare function getFaceSuggestionsBatch(imagePaths: string[], knownUsers: any[]): Promise<any[][]>;
declare function getFaceDescriptor(imagePath: string): Promise<Float32Array | null>;
declare function identifyFace(targetImagePath: string, knownUsers: any[]): Promise<{
    label: string;
    distance: any;
    secondCandidate?: undefined;
    secondDistance?: undefined;
    margin?: undefined;
    reason?: undefined;
    confidence?: undefined;
} | {
    label: any;
    distance: any;
    secondCandidate: any;
    secondDistance: any;
    margin: number | null;
    reason: string;
    confidence: number;
} | null>;
declare function identifyAllFaces(targetImagePath: string, knownUsers: any[]): Promise<{
    label: any;
    distance: number | null;
    box: any;
}[]>;
declare function getAllDescriptors(imagePath: string): Promise<Float32Array[]>;
declare function detectFaces(imagePath: string): Promise<{
    descriptor: Float32Array<ArrayBufferLike>;
    box: any;
}[]>;
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
    serializeDescriptor: typeof serializeDescriptor;
    deserializeDescriptor: typeof deserializeDescriptor;
    findBestMatchWithMargin: typeof findBestMatchWithMargin;
    loadModels: typeof loadModels;
    getFaceSuggestions: typeof getFaceSuggestions;
    getFaceSuggestionsBatch: typeof getFaceSuggestionsBatch;
    MATCH_THRESHOLD: number;
    AUTO_TAG_THRESHOLD: number;
    euclideanDistance: typeof euclideanDistance;
    parseLabelToUser: typeof parseLabelToUser;
};
export default _default;
//# sourceMappingURL=faceAi.d.ts.map