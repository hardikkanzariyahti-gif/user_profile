import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetIds = [480, 482, 483];
  console.log(`--- 🛡️ CLEANING TARGET SET: ${JSON.stringify(targetIds)} ---`);
  
  for (const id of targetIds) {
    const item = await prisma.galleryItem.findUnique({ where: { id } });
    if (!item) continue;
    
    const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
    const truthUserIds: number[] = [];
    
    for (const face of faceDescs) {
      let foundId = null;
      if (face?.manuallyTaggedUserId != null) foundId = Number(face.manuallyTaggedUserId);
      else if (face?.personId != null) foundId = Number(face.personId);
      else if (face?.userId != null) foundId = Number(face.userId);
      
      if (foundId !== null && !isNaN(foundId) && foundId > 0) {
        truthUserIds.push(foundId);
      }
    }
    
    const finalIds = [...new Set(truthUserIds)];
    console.log(`[CLEAN] Image ${id}: Previous=${JSON.stringify(item.recognizedUserIds)} -> Final=${JSON.stringify(finalIds)}`);
    
    await prisma.galleryItem.update({
      where: { id },
      data: { recognizedUserIds: finalIds }
    });
  }
  
  console.log('--- DONE ---');
  process.exit(0);
}

main();
