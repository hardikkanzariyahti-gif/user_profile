import { PrismaClient } from '@prisma/client';

async function main() {
  // Using confirmed region from AWS range data
  const testUrl = "postgresql://postgres.virfeveeuervxkuayzdq:Hashtech%40123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1";
  
  console.log("Testing final confirmed connection to:", testUrl);
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: testUrl,
      },
    },
  });

  try {
    console.log("Attempting query...");
    const userCount = await prisma.user.count();
    console.log("🎉 BINGO! CONNECTION SUCCESSFUL! User count:", userCount);
  } catch (err: any) {
    console.error("❌ STILL FAILED:", err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
