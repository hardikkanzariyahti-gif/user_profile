import prisma from '../config/prisma';

interface AlbumData {
  title: string;
  description?: string;
  userId: number;
  itemIds: number[];
}

const albumRepository = {
  async create(data: AlbumData & { isGlobal?: boolean }) {
    return prisma.album.create({
      data: {
        title: data.title,
        description: data.description,
        isGlobal: data.isGlobal ?? true,
        userId: data.userId,
        items: {
          connect: data.itemIds.map(id => ({ id })),
        },
      },
      include: {
        items: true,
      },
    });
  },

  findById(id: number) {
    return prisma.album.findUnique({
      where: { id },
      include: {
        items: true,
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  },

  findByShareId(shareId: string) {
    return prisma.album.findUnique({
      where: { shareId },
      include: {
        items: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    });
  },

  findAllByUserId(userId: number) {
    return prisma.album.findMany({
      where: {
        OR: [
          { userId },
          { isGlobal: true }
        ]
      },
      include: {
        items: {
          take: 1, // To get a cover image
        },
        user: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  delete(id: number) {
    return prisma.album.delete({
      where: { id },
    });
  },
  
  update(id: number, data: { title?: string; description?: string; itemIds?: number[] }) {
    return prisma.album.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        items: data.itemIds ? {
          set: data.itemIds.map(itemId => ({ id: itemId })),
        } : undefined,
      },
      include: {
        items: true,
      },
    });
  },
};

export default albumRepository;
