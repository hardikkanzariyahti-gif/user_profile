"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Single global instance — avoids connection-pool exhaustion during hot reloads.
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
    // Only log warnings and errors in production to reduce noise.
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map