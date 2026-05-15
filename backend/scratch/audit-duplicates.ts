import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- ANALYZING DUPLICATE RECOGNITIONS ---');
  const items = await prisma.galleryItem.findMany();
  let count = 0;

  for (const item of items) {
    const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
    const userIds = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map(Number) : [];
    
    if (faceDescs.length === 1 && userIds.length > 1) {
       console.log(`[DUPLICATION] Item ID ${item.id} has 1 face but users: ${JSON.stringify(userIds)}`);
       count++;
    }
  }
  
  console.log(`Total inconsistent items found: ${count}`);
  process.exit(0);
}

main();
