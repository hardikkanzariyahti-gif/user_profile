import loadEnv from './config/loadEnv';
loadEnv();

import app from './app';
import prisma from './config/prisma';
import faceAi from '../faceAi';
import { PORT } from './config/constants';

async function startServer(): Promise<void> {
  await faceAi.loadModels();
  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(`${signal} received. Shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
