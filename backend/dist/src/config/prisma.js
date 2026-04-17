"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
console.log('DEBUG: Prisma is initializing. DATABASE_URL is set:', process.env.DATABASE_URL ? 'YES' : 'NO');
if (process.env.DATABASE_URL) {
    console.log('DEBUG: DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 20) + '...');
}
const prisma = new client_1.PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});
exports.default = prisma;
//# sourceMappingURL=prisma.js.map