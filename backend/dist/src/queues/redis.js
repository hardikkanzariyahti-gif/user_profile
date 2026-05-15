"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedis = getRedis;
const ioredis_1 = __importDefault(require("ioredis"));
let _redis = null;
function getRedis() {
    // For now (per current project requirement), Redis is disabled by default.
    // Enable later by setting ENABLE_REDIS=true and providing REDIS_URL.
    if (process.env.ENABLE_REDIS !== 'true')
        return null;
    const url = process.env.REDIS_URL;
    if (!url)
        return null;
    if (_redis)
        return _redis;
    _redis = new ioredis_1.default(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
    });
    _redis.on('error', (err) => {
        console.warn('[Redis] error:', err?.message || err);
    });
    return _redis;
}
//# sourceMappingURL=redis.js.map