"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSyncState = getSyncState;
exports.setSyncState = setSyncState;
exports.resetSyncState = resetSyncState;
const KEY = 'gallery:syncState';
const DEFAULT_STATE = { isScanning: false, total: 0, current: 0 };
async function getSyncState(redis) {
    if (!redis)
        return DEFAULT_STATE;
    const raw = await redis.hgetall(KEY);
    if (!raw || Object.keys(raw).length === 0)
        return DEFAULT_STATE;
    return {
        isScanning: raw.isScanning === 'true',
        total: Number(raw.total || 0),
        current: Number(raw.current || 0),
        // Backward compatible extensions (ignored by old clients)
        ...(raw.stage ? { stage: raw.stage } : {}),
        ...(raw.message ? { message: raw.message } : {}),
    };
}
async function setSyncState(redis, patch) {
    if (!redis)
        return { ...DEFAULT_STATE, ...patch };
    const current = await getSyncState(redis);
    const next = {
        isScanning: patch.isScanning ?? current.isScanning,
        total: patch.total ?? current.total,
        current: patch.current ?? current.current,
        ...patch,
    };
    const toWrite = {
        isScanning: String(next.isScanning),
        total: String(next.total),
        current: String(next.current),
    };
    if (next.stage)
        toWrite.stage = String(next.stage);
    if (next.message)
        toWrite.message = String(next.message);
    await redis.hset(KEY, toWrite);
    await redis.expire(KEY, 60 * 10);
    return next;
}
async function resetSyncState(redis) {
    if (!redis)
        return;
    await redis.del(KEY);
}
//# sourceMappingURL=syncStateStore.js.map