import './patch';
import loadEnv from './config/loadEnv';
loadEnv();

import faceAi from '../faceAi';
import prisma from './config/prisma';
import { startGalleryScanWorker } from './workers/galleryScanWorker';
import { startGalleryPreprocessWorker } from './workers/galleryPreprocessWorker';
import { startGalleryRefreshWorker } from './workers/galleryRefreshWorker';

async function start(): Promise<void> {
  // Worker runs AI + DB work; keep it separate from API server.
  await faceAi.loadModels();
  startGalleryPreprocessWorker();
  startGalleryScanWorker();
  startGalleryRefreshWorker();
  console.log('Worker started.');
}

start().catch(async (err) => {
  console.error('Failed to start worker:', err);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});

