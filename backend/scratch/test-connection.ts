import { PrismaClient } from '@prisma/client';

const host = 'aws-1-ap-northeast-2.pooler.supabase.com';
const ref = "virfeveeuervxkuayzdq";
const password = "Hashtech%40123";

async function testConfig(user: string, port: number) {
    const url = `postgresql://${user}:${password}@${host}:${port}/postgres`;
    console.log(`\n--- Testing Host: ${host}, User: ${user}, Port: ${port} ---`);
    const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
    try {
        await prisma.$connect();
        const result = await prisma.$queryRaw`SELECT 1+1 as res`;
        console.log(`[SUCCESS] Connected and queried!`, result);
        await prisma.$disconnect(); return true;
    } catch (err: any) {
        console.log(`[FAIL] Error:`, (err.message || String(err)).substring(0, 150).replace(/\n/g, ' '));
        await prisma.$disconnect(); return false;
    }
}
async function run() {
    await testConfig(`postgres.${ref}`, 5432);
    await testConfig(`postgres.${ref}`, 6543);
}
run();
