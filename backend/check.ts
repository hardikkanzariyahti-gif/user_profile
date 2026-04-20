import { buildLabeledDescriptors } from './src/services/galleryService';
import galleryRepository from './src/repositories/galleryRepository';
import userRepository from './src/repositories/userRepository';
import faceAi from './faceAi';
import { PrismaClient } from '@prisma/client';

async function test() {
   console.log("Loading users...");
   const users = await userRepository.findAllForRecognition();
   console.log(`Found ${users.length} users.`);
   
   console.log("Loading gallery...");
   const gallery = await galleryRepository.findAll();
   console.log(`Found ${gallery.length} items`);
   
   console.log("Testing face Ai model loading...");
   await faceAi.loadModels();
   
   console.log("Building model...");
   const res = await buildLabeledDescriptors(users);
   console.log("Done building model!");
   
   console.log("Clusters test...");
   const { galleryService } = require('./src/services/galleryService');
   const clusters = await galleryService.getUnknownFaceClusters();
   console.log(`Found ${clusters.length} clusters.`);
   process.exit(0);
}

test().catch(e => { console.error(e); process.exit(1); });
