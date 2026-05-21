"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./patch");
const loadEnv_1 = __importDefault(require("./config/loadEnv"));
(0, loadEnv_1.default)();
const app_1 = __importDefault(require("./app"));
const prisma_1 = __importDefault(require("./config/prisma"));
const faceAi_1 = __importDefault(require("../faceAi"));
const constants_1 = require("./config/constants");
const child_process_1 = require("child_process");
const galleryService_1 = require("./services/galleryService");
async function connectWithRetry(maxAttempts = 5, delaySeconds = 3) {
    console.log(`\n--- 🔍 Prisma Connection Status ---`);
    const hasUrl = !!process.env.DATABASE_URL;
    console.log(`DATABASE_URL provided: ${hasUrl ? '✅ YES' : '❌ NO'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    if (!hasUrl) {
        console.error("Prisma initialization cancelled: DATABASE_URL is missing.");
        return false;
    }
    const match = process.env.DATABASE_URL.match(/@([^:]+:[0-9]+)\//);
    const targetHost = match ? match[1] : 'unknown-host';
    console.log(`Prisma connection started. Attempting to reach: ${targetHost}`);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`[DB Connect] Attempt ${attempt}/${maxAttempts}...`);
            await prisma_1.default.$connect();
            // Verify with simple query
            await prisma_1.default.$queryRaw `SELECT 1`;
            console.log(`✅ Prisma connected successfully!`);
            return true;
        }
        catch (error) {
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
function freePort(port) {
    return new Promise((resolve) => {
        // netstat -ano lists pid in last column for TCP connections
        (0, child_process_1.exec)(`netstat -ano | findstr ":${port} "`, (err, stdout) => {
            if (err || !stdout.trim()) {
                resolve();
                return;
            }
            const pids = new Set();
            for (const line of stdout.trim().split('\n')) {
                const parts = line.trim().split(/\s+/);
                const pid = parts[parts.length - 1];
                if (pid && /^\d+$/.test(pid) && pid !== '0')
                    pids.add(pid);
            }
            if (pids.size === 0) {
                resolve();
                return;
            }
            let remaining = pids.size;
            for (const pid of pids) {
                console.log(`[Server] 🔪 Killing stale process PID ${pid} on port ${port}...`);
                (0, child_process_1.exec)(`taskkill /PID ${pid} /F`, () => {
                    remaining--;
                    if (remaining === 0)
                        resolve();
                });
            }
        });
    });
}
async function listenWithRetry(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await new Promise((resolve, reject) => {
                const server = app_1.default.listen(constants_1.PORT, () => resolve());
                server.once('error', reject);
                // Store reference so we can return it on success
                listenWithRetry._server = server;
            });
            return listenWithRetry._server;
        }
        catch (err) {
            if (err.code === 'EADDRINUSE' && attempt < maxRetries) {
                console.warn(`[Server] ⚠️  Port ${constants_1.PORT} busy (attempt ${attempt}/${maxRetries}). Auto-freeing...`);
                await freePort(constants_1.PORT);
                await new Promise(res => setTimeout(res, 1500)); // wait 1.5s for OS to release
            }
            else {
                throw err;
            }
        }
    }
    throw new Error(`Could not bind to port ${constants_1.PORT} after ${maxRetries} attempts.`);
}
async function startServer() {
    await faceAi_1.default.loadModels();
    // Execute connection check but don't prevent app boot
    await connectWithRetry(5, 3);
    try {
        const deletedUsers = await prisma_1.default.user.deleteMany({
            where: {
                email: {
                    endsWith: '@local.tag'
                }
            }
        });
        if (deletedUsers && deletedUsers.count > 0) {
            console.log(`[Cleanup] Deleted ${deletedUsers.count} wrongly created tag user profiles.`);
        }
    }
    catch (err) {
        console.error('[Cleanup] Failed cleaning up tag user profiles:', err.message);
    }
    const server = await listenWithRetry(3);
    console.log(`\n🚀 Server running on http://localhost:${constants_1.PORT}`);
    // Fire off recovery/auto-scanning for any incomplete tasks
    galleryService_1.galleryService.initializeQueue().catch(err => {
        console.error('[System] 🛑 Failed to initialize startup queue:', err.message);
    });
    async function shutdown(signal) {
        console.log(`${signal} received. Shutting down...`);
        server.close(async () => {
            await prisma_1.default.$disconnect();
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
//# sourceMappingURL=index.js.map