import './patch';
import loadEnv from './config/loadEnv';
loadEnv();

import app from './app';
import prisma from './config/prisma';
import faceAi from '../faceAi';
import { PORT } from './config/constants';
import { exec } from 'child_process';
import { galleryService } from './services/galleryService';

async function connectWithRetry(maxAttempts = 5, delaySeconds = 3): Promise<boolean> {
  console.log(`\n--- 🔍 Prisma Connection Status ---`);
  const hasUrl = !!process.env.DATABASE_URL;
  console.log(`DATABASE_URL provided: ${hasUrl ? '✅ YES' : '❌ NO'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  
  if (!hasUrl) {
    console.error("Prisma initialization cancelled: DATABASE_URL is missing.");
    return false;
  }

  const match = process.env.DATABASE_URL!.match(/@([^:]+:[0-9]+)\//);
  const targetHost = match ? match[1] : 'unknown-host';
  
  console.log(`Prisma connection started. Attempting to reach: ${targetHost}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[DB Connect] Attempt ${attempt}/${maxAttempts}...`);
      await prisma.$connect();
      // Verify with simple query
      await prisma.$queryRaw`SELECT 1`;
      console.log(`✅ Prisma connected successfully!`);
      return true;
    } catch (error: any) {
      console.error(`❌ Prisma connection attempt ${attempt} failed.`);
      const msg = error.message || String(error);
      console.error(`   Error summary: ${msg.substring(0, 120).replace(/\n/g, ' ')}...`);
      
      if (attempt < maxAttempts) {
        console.log(`   Waiting ${delaySeconds}s before next retry...`);
        await new Promise(res => setTimeout(res, delaySeconds * 1000));
      }
    }
  }
  console.error(`❌ Failed to connect to DB after ${maxAttempts} attempts. Service starting in degraded mode.`);
  return false;
}

/** Kill whatever process is occupying `port` on Windows, then wait briefly. */
function freePort(port: number): Promise<void> {
  return new Promise((resolve) => {
    // netstat -ano lists pid in last column for TCP connections
    exec(`netstat -ano | findstr ":${port} "`, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve();
        return;
      }
      const pids = new Set<string>();
      for (const line of stdout.trim().split('\n')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      if (pids.size === 0) { resolve(); return; }

      let remaining = pids.size;
      for (const pid of pids) {
        console.log(`[Server] 🔪 Killing stale process PID ${pid} on port ${port}...`);
        exec(`taskkill /PID ${pid} /F`, () => {
          remaining--;
          if (remaining === 0) resolve();
        });
      }
    });
  });
}

async function listenWithRetry(maxRetries = 3): Promise<ReturnType<typeof app.listen>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const server = app.listen(PORT, () => resolve());
        server.once('error', reject);
        // Store reference so we can return it on success
        (listenWithRetry as any)._server = server;
      });
      return (listenWithRetry as any)._server;
    } catch (err: any) {
      if (err.code === 'EADDRINUSE' && attempt < maxRetries) {
        console.warn(`[Server] ⚠️  Port ${PORT} busy (attempt ${attempt}/${maxRetries}). Auto-freeing...`);
        await freePort(PORT);
        await new Promise(res => setTimeout(res, 1500)); // wait 1.5s for OS to release
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Could not bind to port ${PORT} after ${maxRetries} attempts.`);
}

async function startServer(): Promise<void> {
  await faceAi.loadModels();
  
  // Execute connection check but don't prevent app boot
  await connectWithRetry(5, 3);

  const server = await listenWithRetry(3);
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);

  // Fire off recovery/auto-scanning for any incomplete tasks
  galleryService.initializeQueue().catch(err => {
    console.error('[System] 🛑 Failed to initialize startup queue:', err.message);
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
// Trigger restart nudge for env reload
