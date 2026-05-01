import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.galleryItem.findMany().then(items => {
  console.log(JSON.stringify(items.map(i => ({id: i.id, recognizedUserIds: i.recognizedUserIds})).filter(i => i.recognizedUserIds && i.recognizedUserIds.length > 0), null, 2));
  prisma.$disconnect();
});
