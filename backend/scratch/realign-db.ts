import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- 🚀 INITIATING DATABASE RE-ALIGNMENT PROTOCOL ---');
  const items = await prisma.galleryItem.findMany();
  let updatedCount = 0;

  for (const item of items) {
    const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
    const originalUsers = Array.isArray(item.recognizedUserIds) ? item.recognizedUserIds.map(Number) : [];
    
    // Derive absolute source of truth from within the face array itself
    const truthUserIds: number[] = [];
    for (const face of faceDescs) {
       const manualId = Number(face?.manuallyTaggedUserId);
       const autoId = Number(face?.personId || face?.userId || face?.recognizedUserId);
       
       if (!isNaN(manualId)) {
         truthUserIds.push(manualId);
       } else if (!isNaN(autoId)) {
         truthUserIds.push(autoId);
       }
    }
    
    const uniqueTruthIds = [...new Set(truthUserIds)];
    
    // Detect misalignment or ghost values in top-level array
    const originalString = JSON.stringify(originalUsers.sort());
    const truthString = JSON.stringify(uniqueTruthIds.sort());
    
    if (originalString !== truthString) {
       console.log(`[REALIGN] Correcting Item ID ${item.id}: ${originalString} -> ${truthString}`);
       
       await prisma.galleryItem.update({
         where: { id: item.id },
         data: {
           recognizedUserIds: uniqueTruthIds
         }
       });
       updatedCount++;
    }
  }
  
  console.log(`\n--- ALIGNMENT COMPLETE ---`);
  console.log(`Successfully reconciled ${updatedCount} records.`);
  process.exit(0);
}

main();
