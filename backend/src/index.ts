import './patch';
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

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is busy. Please wait a moment for the old process to die or kill it manually.`);
    }
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
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Nodemon restart signal
  process.on('SIGHUP', () => shutdown('SIGHUP'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

