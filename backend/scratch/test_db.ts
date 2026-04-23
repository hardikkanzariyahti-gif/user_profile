import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Testing database connection to Supabase...');
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Success! Database is reachable.');
  } catch (err: any) {
    console.error('❌ Database Connection Failed!');
    console.error('Error Code:', err.code);
    console.error('Message:', err.message);
    console.log('\n--- ACTION REQUIRED ---');
    console.log('1. Go to: https://app.supabase.com/');
    console.log('2. Check if your project "virfeveeuervxkuayzdq" is PAUSED.');
    console.log('3. If paused, click "Restore Project".');
  } finally {
    await prisma.$disconnect();
  }
}

main();
