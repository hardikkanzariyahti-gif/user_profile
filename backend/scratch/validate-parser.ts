import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.galleryItem.findUnique({ where: { id: 483 } });
  const faceDescs = Array.isArray(item?.faceDescriptors) ? item?.faceDescriptors as any[] : [];
  const truthUserIds: number[] = [];
  
  for (const face of faceDescs) {
    let foundId = null;
    
    if (face?.manuallyTaggedUserId != null) {
      foundId = Number(face.manuallyTaggedUserId);
    } else if (face?.personId != null) {
      foundId = Number(face.personId);
    } else if (face?.userId != null) {
      foundId = Number(face.userId);
    }
    
    if (foundId !== null && !isNaN(foundId) && foundId > 0) {
      truthUserIds.push(foundId);
    }
  }
  
  console.log('Target Item 483 Parsing Result:', JSON.stringify([...new Set(truthUserIds)]));
  process.exit(0);
}

main();
