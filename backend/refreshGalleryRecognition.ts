import loadEnv from './src/config/loadEnv';
loadEnv();

import prisma from './src/config/prisma';
import { galleryService } from './src/services/galleryService';
import faceAi from './faceAi';

async function refreshRecognition(): Promise<void> {
  await faceAi.loadModels();
  const result = await galleryService.refreshGalleryRecognition();
  console.log('Gallery recognition refresh complete:', result);
}

refreshRecognition()
  .catch((err) => {
    console.error('Failed to refresh gallery recognition:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
