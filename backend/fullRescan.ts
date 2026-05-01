import loadEnv from './src/config/loadEnv';
loadEnv();

import prisma from './src/config/prisma';
import { galleryService } from './src/services/galleryService';
import faceAi from './faceAi';

async function fullRescan(): Promise<void> {
  console.log('🧹 Step 1: Clearing ALL cached face descriptors to force fresh AI detection...');
  
  const allItems = await prisma.galleryItem.findMany();
  const nonProfile = allItems.filter(i => !i.isProfile);
  
  let cleared = 0;
  for (const item of nonProfile) {
    // Preserve manual tags but wipe cached AI descriptors so the new 
    // detection engine re-processes every photo at higher resolution
    const faceDescs = Array.isArray(item.faceDescriptors) ? item.faceDescriptors as any[] : [];
    const hasManualTags = faceDescs.some((f: any) => f?.manuallyTaggedUserId);
    
    if (hasManualTags) {
      // Keep manual tags intact, only clear non-manual descriptors
      const cleaned = faceDescs.map((f: any) => {
        if (f?.manuallyTaggedUserId) return f; // preserve manual
        return null;
      }).filter(Boolean);
      await prisma.galleryItem.update({
        where: { id: item.id },
        data: { faceDescriptors: cleaned }
      });
    } else {
      // No manual tags — wipe everything for a clean slate
      await prisma.galleryItem.update({
        where: { id: item.id },
        data: { faceDescriptors: [], recognizedUserIds: [] }
      });
    }
    cleared++;
  }
  
  console.log(`✅ Cleared ${cleared} photo(s). Manual tags preserved.\n`);
  
  console.log('🔄 Step 2: Running full AI rescan with improved detection...');
  await faceAi.loadModels();
  const result = await galleryService.refreshGalleryRecognition(true);
  console.log('\n🎉 Full rescan complete:', result);
}

fullRescan()
  .catch((err) => {
    console.error('Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
