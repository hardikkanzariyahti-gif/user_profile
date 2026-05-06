import prisma from '../config/prisma';

interface GalleryItemData {
  url: string;
  uploadedAt: Date;
  label?: string;
  isProfile?: boolean;
  showInGallery?: boolean;
  userId?: number | null;
  recognizedUserIds: number[];
  faceDescriptors?: any;
}


const galleryRepository = {
  findAll() {
    return prisma.galleryItem.findMany({
      include: {
        hashtags: true,
        metadata: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  },

  findById(id: number) {
    return prisma.galleryItem.findUnique({
      where: { id },
      include: {
        hashtags: true,
        metadata: true,
      },
    });
  },

  findByHashtag(tag: string) {
    return prisma.galleryItem.findMany({
      where: {
        hashtags: {
          some: { name: tag }
        }
      },
      include: {
        hashtags: true,
        metadata: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });
  },

  async updateById(id: number, data: any) {
    const { hashtags, metadata, ...rest } = data;
    const updateData: any = { ...rest };

    if (Array.isArray(hashtags)) {
      updateData.hashtags = {
        set: [], // Disconnect previous
        connectOrCreate: hashtags.map((tag: string) => ({
          where: { name: tag.toLowerCase().trim() },
          create: { name: tag.toLowerCase().trim() },
        })),
      };
    }

    if (metadata) {
      updateData.metadata = {
        upsert: {
          create: {
            personCount: metadata.person_count || 0,
            dominantColor: metadata.dominant_color,
            aspectRatio: metadata.aspect_ratio,
            orientation: metadata.orientation,
            rawJson: metadata,
          },
          update: {
            personCount: metadata.person_count || 0,
            dominantColor: metadata.dominant_color,
            aspectRatio: metadata.aspect_ratio,
            orientation: metadata.orientation,
            rawJson: metadata,
          },
        },
      };
    }

    return prisma.galleryItem.update({
      where: { id },
      data: updateData,
      include: {
        hashtags: true,
        metadata: true,
      },
    });
  },

  createMany(items: any[]) {
    // Note: createMany doesn't support nested relations in Prisma.
    // We should use Promise.all(createOne) or refactor if bulk upload is heavy.
    return Promise.all(items.map(item => this.createOne(item)));
  },

  createOne(data: any) {
    const { hashtags, metadata, ...rest } = data;
    const createData: any = { ...rest };

    if (Array.isArray(hashtags)) {
      createData.hashtags = {
        connectOrCreate: hashtags.map((tag: string) => ({
          where: { name: tag.toLowerCase().trim() },
          create: { name: tag.toLowerCase().trim() },
        })),
      };
    }

    if (metadata) {
      createData.metadata = {
        create: {
          personCount: metadata.person_count || 0,
          dominantColor: metadata.dominant_color,
          aspectRatio: metadata.aspect_ratio,
          orientation: metadata.orientation,
          rawJson: metadata,
        },
      };
    }

    return prisma.galleryItem.create({
      data: createData,
      include: {
        hashtags: true,
        metadata: true,
      },
    });
  },

  deleteById(id: number) {
    return prisma.galleryItem.delete({
      where: { id },
    });
  },

  hideOldProfilePictures(userId: number) {
    // Note: Profile pictures are usually hidden by setting a flag or deleting.
    // Assuming showInGallery was removed or handled differently now.
    // Based on the new schema, I should probably just untag them as profile if needed.
    return prisma.galleryItem.updateMany({
      where: { userId, isProfile: true },
      data: { isProfile: false },
    });
  },

  getAllUniqueHashtags() {
    return prisma.hashtag.findMany({
      orderBy: { name: 'asc' },
    });
  },
};

export default galleryRepository;
