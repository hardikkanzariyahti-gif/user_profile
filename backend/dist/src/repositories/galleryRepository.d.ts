interface GalleryItemData {
    url: string;
    uploadedAt: Date;
    label?: string;
    isProfile?: boolean;
    userId?: number | null;
    recognizedUserIds: number[];
    faceDescriptors?: any;
}
declare const galleryRepository: {
    findAll(): Promise<any[]>;
    findById(id: number): Promise<any>;
    findByHashtag(tag: string): Promise<any[]>;
    updateById(id: number, data: any): Promise<any>;
    createMany(items: GalleryItemData[]): Promise<any[]>;
    createOne(data: GalleryItemData): Promise<any>;
    deleteById(id: number): Promise<void>;
};
export default galleryRepository;
//# sourceMappingURL=galleryRepository.d.ts.map