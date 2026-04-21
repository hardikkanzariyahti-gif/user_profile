import { buildUploadUrl } from '../utils/urlUtils';
declare function normalizeUserId(id: any): number;
declare const userService: {
    createUser(body: any): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        "profile picture": string | null | undefined;
    }>;
    listUsers(): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        "profile picture": string | null | undefined;
    }[]>;
    getUserById(id: any): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        "profile picture": string | null | undefined;
    }>;
    updateUser(id: any, body: any, file: any): Promise<{
        id: number;
        name: string;
        email: string;
        profilePicture: string | null | undefined;
        "profile picture": string | null | undefined;
    }>;
    deleteUser(id: any): Promise<{
        message: string;
    }>;
    buildUploadUrl: typeof buildUploadUrl;
    normalizeUserId: typeof normalizeUserId;
};
export default userService;
//# sourceMappingURL=userService.d.ts.map