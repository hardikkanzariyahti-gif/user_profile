const loadEnv = require('./src/config/loadEnv');
loadEnv();

const app = require('./src/app');
const prisma = require('./src/config/prisma');
const { PORT } = require('./src/config/constants');

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
