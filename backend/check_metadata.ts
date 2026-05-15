import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMetadata() {
  try {
    const recentItems = await prisma.galleryItem.findMany({
      take: 5,
      orderBy: { uploadedAt: 'desc' },
      include: {
        metadata: true,
        hashtags: true
      }
    });

    console.log(JSON.stringify(recentItems, null, 2));
  } catch (error) {
    console.error('Error fetching metadata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMetadata();
