import prisma from '../config/prisma';

interface AlbumData {
  title: string;
  description?: string;
  eventType?: string;
  date?: string;
  location?: string;
  userId: number;
  itemIds?: number[];
}

const albumRepository = {
  async create(data: AlbumData & { isGlobal?: boolean }) {
    const itemIds = data.itemIds || [];
    return prisma.album.create({
      data: {
        title: data.title,
        description: data.description,
        eventType: data.eventType,
        date: data.date,
        location: data.location,
        isGlobal: data.isGlobal ?? true,
        userId: data.userId,
        items: itemIds.length > 0 ? {
          connect: itemIds.map(id => ({ id })),
        } : undefined,
      },
      include: {
        items: true,
      },
    });
  },

  async findById(id: number) {
    const [album, items] = await Promise.all([
      prisma.album.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.galleryItem.findMany({
        where: {
          albums: { some: { id } }
        },
        include: {
          metadata: true,
          hashtags: true,
        },
        orderBy: { uploadedAt: 'desc' }
      })
    ]);

    if (!album) return null;
    return {
      ...album,
      items
    };
  },

  async findByShareId(shareId: string) {
    const album = await prisma.album.findUnique({
      where: { shareId },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!album) return null;

    const items = await prisma.galleryItem.findMany({
      where: {
        albums: { some: { id: album.id } }
      },
      include: {
        metadata: true,
        hashtags: true,
      },
      orderBy: { uploadedAt: 'desc' }
    });

    return {
      ...album,
      items
    };
  },

  findAllByUserId(userId: number) {
    return prisma.album.findMany({
      include: {
        items: {
          include: {
            metadata: true,
            hashtags: true,
            people: true,
          }
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
  
  update(id: number, data: { title?: string; description?: string; eventType?: string; date?: string; location?: string; itemIds?: number[] }) {
    return prisma.album.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description,
        eventType: data.eventType,
        date: data.date,
        location: data.location,
        items: data.itemIds ? {
          set: data.itemIds.map(itemId => ({ id: itemId })),
        } : undefined,
      },
      include: {
        items: {
          include: {
            metadata: true,
            hashtags: true,
            people: true,
          }
        },
      },
    });
  },
};

export default albumRepository;
