import * as fs from 'fs';
import * as path from 'path';
import prisma from '../config/prisma';
import { UPLOADS_DIR } from '../config/constants';

async function cleanupOrphanPhotos() {
  console.log('\n=== Orphan Photo Cleanup ===\n');

  const allItems = await prisma.galleryItem.findMany({
    include: {
      albums: { select: { id: true } },
      people: { select: { id: true } },
      metadata: { select: { id: true } },
    },
  });

  let totalChecked = 0;
  let missingFiles = 0;
  let markedDeleted = 0;

  const orphanIds: number[] = [];

  for (const item of allItems) {
    totalChecked++;

    const filename = item.url?.split('/').pop();
    if (!filename) {
      orphanIds.push(item.id);
      continue;
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      missingFiles++;
      orphanIds.push(item.id);
    }
  }

  if (orphanIds.length > 0) {
    for (const id of orphanIds) {
      await prisma.imagePeople.deleteMany({ where: { galleryItemId: id } });
      await prisma.galleryItem.update({
        where: { id },
        data: {
          albums: { set: [] },
          deletedAt: new Date(),
          status: 'deleted',
          visibleInGallery: false,
        },
      });
      markedDeleted++;
    }
  }

  console.log(`Total checked: ${totalChecked}`);
  console.log(`Missing files:  ${missingFiles}`);
  console.log(`Marked deleted: ${markedDeleted}`);
  console.log('\n=== Cleanup complete ===\n');

  process.exit(0);
}

cleanupOrphanPhotos().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
