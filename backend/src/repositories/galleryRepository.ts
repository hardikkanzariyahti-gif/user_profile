import prisma from '../config/prisma';

interface GalleryItemData {
  url: string;
  uploadedAt: Date;
  label?: string;
  isProfile?: boolean;
  userId?: number | null;
  recognizedUserIds: number[];
  faceDescriptors?: any;
}


const galleryRepository = {
  findAll() {
    return prisma.galleryItem.findMany({
      orderBy: { uploadedAt: 'desc' },
    });
  },

  findById(id: number) {
    return prisma.galleryItem.findUnique({
      where: { id },
    });
  },

  findByHashtag(tag: string) {
    return prisma.galleryItem.findMany({
      where: {
        hashtags: { has: tag },
      },
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

  deleteById(id: number) {
    return prisma.galleryItem.delete({
      where: { id },
    });
  },

  getAllUniqueHashtags() {
    return prisma.galleryItem.findMany({
      select: { hashtags: true },
    });
  },
};

export default galleryRepository;
