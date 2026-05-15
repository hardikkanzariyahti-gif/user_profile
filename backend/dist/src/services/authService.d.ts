declare const authService: {
    login(body: any): Promise<{
        message: string;
        user: {
            id: number;
            name: string;
            email: string;
            profilePicture: string | null | undefined;
            profilePictures: (string | null | undefined)[];
            "profile picture": string | null | undefined;
            "profile pictures": (string | null | undefined)[];
        };
    }>;
};
export default authService;
//# sourceMappingURL=authService.d.ts.map