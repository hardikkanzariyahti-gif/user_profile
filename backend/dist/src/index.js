"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const loadEnv_1 = __importDefault(require("./config/loadEnv"));
(0, loadEnv_1.default)();
const app_1 = __importDefault(require("./app"));
const prisma_1 = __importDefault(require("./config/prisma"));
const faceAi_1 = __importDefault(require("../faceAi"));
const constants_1 = require("./config/constants");
async function startServer() {
    await faceAi_1.default.loadModels();
    const server = app_1.default.listen(constants_1.PORT, () => {
        console.log(`Server running on http://localhost:${constants_1.PORT}`);
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
}
startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map