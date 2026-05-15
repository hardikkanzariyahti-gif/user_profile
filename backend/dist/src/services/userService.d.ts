import { buildUploadUrl } from '../utils/urlUtils';
declare function normalizeUserId(id: any): number;
declare const userService: {
    createUser(body: any): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        profilePictures: (string | null | undefined)[];
        "profile picture": string | null | undefined;
        "profile pictures": (string | null | undefined)[];
    }>;
    listUsers(): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        profilePictures: (string | null | undefined)[];
        "profile picture": string | null | undefined;
        "profile pictures": (string | null | undefined)[];
    }[]>;
    getUserById(id: any): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        profilePictures: (string | null | undefined)[];
        "profile picture": string | null | undefined;
        "profile pictures": (string | null | undefined)[];
    }>;
    verifyFaceQuality(file: any): Promise<{
        isValid: boolean;
        message: string;
    }>;
    updateUser(id: any, body: any, files?: any[]): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        profilePictures: (string | null | undefined)[];
        "profile picture": string | null | undefined;
        "profile pictures": (string | null | undefined)[];
    }>;
    deleteUser(id: any): Promise<{
        message: string;
    }>;
    buildUploadUrl: typeof buildUploadUrl;
    normalizeUserId: typeof normalizeUserId;
};
export default userService;
//# sourceMappingURL=userService.d.ts.map