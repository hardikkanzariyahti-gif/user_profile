import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const repairs = [
    { id: 440, users: [3] },
    { id: 457, users: [2] },
    { id: 465, users: [3] },
    { id: 453, users: [4] },
    { id: 442, users: [] },
    { id: 441, users: [3] },
    { id: 444, users: [2] },
    { id: 466, users: [2,3] },
    { id: 483, users: [2,5] }
  ];

  for (const repair of repairs) {
     await prisma.galleryItem.update({
       where: { id: repair.id },
       data: { recognizedUserIds: repair.users }
     });
     console.log(`Restored Item ${repair.id} back to ${JSON.stringify(repair.users)}`);
  }
  process.exit(0);
}

main();
