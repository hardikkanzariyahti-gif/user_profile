declare const faceService: {
    identifyImage(filePath: string): Promise<{
        message: string;
        users?: undefined;
        unknownCount?: undefined;
    } | {
        message: string;
        users: {
            id: string;
            originalId: number;
            name: string;
            email: string;
            profilePicture: string | null;
            "profile picture": string | null;
            confidence: number;
            matchDistance: any;
            secondBestDistance: any;
            ambiguityMargin: any;
            matchReason: any;
        }[];
        unknownCount: number;
    }>;
    resolveUploadedPath(url: string): string;
    fileExistsInUploads(url: string): boolean;
};
export default faceService;
//# sourceMappingURL=faceService.d.ts.map