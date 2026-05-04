import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.galleryItem.findUnique({ where: { id: 173 } }).then(item => {
  console.log(JSON.stringify({ id: item?.id, recognizedUserIds: item?.recognizedUserIds }, null, 2));
  prisma.$disconnect();
});
