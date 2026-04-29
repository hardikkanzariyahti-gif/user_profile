declare const faceService: {
    identifyImage(filePath: string): Promise<{
        message: string;
        users?: undefined;
        unknownCount?: undefined;
    } | {
        message: string;
        users: {
            id: string;
            originalId: any;
            name: any;
            email: any;
            profilePicture: any;
            "profile picture": any;
            confidence: number;
            matchDistance: number;
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