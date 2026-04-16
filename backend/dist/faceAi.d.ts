declare function loadModels(): Promise<void>;
declare function getFaceDescriptor(imagePath: string): Promise<Float32Array | null>;
declare function identifyFace(targetImagePath: string, knownUsers: any[]): Promise<{
    label: string;
    distance: any;
} | null>;
declare function identifyAllFaces(targetImagePath: string, knownUsers: any[]): Promise<any>;
declare const _default: {
    getFaceDescriptor: typeof getFaceDescriptor;
    identifyFace: typeof identifyFace;
    identifyAllFaces: typeof identifyAllFaces;
    loadModels: typeof loadModels;
    MATCH_THRESHOLD: number;
};
export default _default;
//# sourceMappingURL=faceAi.d.ts.map