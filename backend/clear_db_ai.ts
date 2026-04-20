import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n🗑️  Starting Cleanup of Old 128D AI Data...');
  
  // 1. Wipe old face maps from User profiles
  await prisma.user.updateMany({
    data: {
      profileDescriptor: Prisma.DbNull
    }
  });
  console.log('✅ Wiped old AI templates from all Users');

  // 2. Wipe old tags from Gallery Photos
  await prisma.galleryItem.updateMany({
    data: {
      recognizedUserIds: [], // Clear all assigned names
      faceDescriptors: Prisma.DbNull, // Clear old face bounding boxes
      label: null            // Clear any text label
    }
  });
  console.log('✅ Wiped all false recognized tags from Gallery Photos');

  console.log('🚀 SUCCESS: Database is perfectly clean and ready for the DeepFace Apple/Google engine!\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
