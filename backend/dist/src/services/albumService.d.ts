declare const albumService: {
    enrichAlbum(album: any): Promise<any>;
    createAlbum(data: {
        title: string;
        description?: string;
        eventType?: string;
        date?: string;
        location?: string;
        userId?: number;
        itemIds?: number[];
        isGlobal?: boolean;
    }): Promise<any>;
    getAlbumsByUser(userId: number): Promise<any[]>;
    getAlbumById(id: number, userId?: number): Promise<any>;
    getSharedAlbum(shareId: string): Promise<any>;
    deleteAlbum(id: number, userId?: number): Promise<{
        id: number;
        userId: number;
        description: string | null;
        location: string | null;
        title: string;
        eventType: string | null;
        date: string | null;
        isGlobal: boolean;
        shareId: string;
        createdAt: Date;
    }>;
    updateAlbum(id: number, userId: number, data: {
        title?: string;
        description?: string;
        eventType?: string;
        date?: string;
        location?: string;
        itemIds?: number[];
    }): Promise<any>;
};
export default albumService;
//# sourceMappingURL=albumService.d.ts.map