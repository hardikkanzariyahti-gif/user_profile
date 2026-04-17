import { PrismaClient } from '@prisma/client';

console.log('DEBUG: Prisma is initializing. DATABASE_URL is set:', process.env.DATABASE_URL ? 'YES' : 'NO');
if (process.env.DATABASE_URL) {
  console.log('DEBUG: DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 20) + '...');
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

export default prisma;
