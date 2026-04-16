import prisma from '../config/prisma';

interface GalleryItemData {
  url: string;
  uploadedAt: Date;
  label?: string;
  isProfile?: boolean;
  userId?: number | null;
  recognizedUserIds: number[];
}

const galleryRepository = {
  findAll() {
    return prisma.galleryItem.findMany({
      orderBy: { uploadedAt: 'desc' },
    });
  },

  updateById(id: number, data: any) {
    return prisma.galleryItem.update({
      where: { id },
      data,
    });
  },

  createMany(items: GalleryItemData[]) {
    return prisma.galleryItem.createMany({ data: items });
  },

  createOne(data: GalleryItemData) {
    return prisma.galleryItem.create({ data });
  },
};

export default galleryRepository;
