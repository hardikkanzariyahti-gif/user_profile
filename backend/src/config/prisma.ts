import { PrismaClient } from '@prisma/client';

// Single global instance — avoids connection-pool exhaustion during hot reloads.
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Only log warnings and errors in production to reduce noise.
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
