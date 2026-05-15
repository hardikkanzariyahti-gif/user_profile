import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.galleryItem.findUnique({ where: { id: 483 } });
  console.log(JSON.stringify(item?.faceDescriptors, null, 2).substring(0, 300));
  console.log('Face descriptor contains manuallyTaggedUserId:', (item?.faceDescriptors as any)[0]?.manuallyTaggedUserId);
  console.log('Face descriptor status:', (item?.faceDescriptors as any)[0]?.status);
  process.exit(0);
}

main();
