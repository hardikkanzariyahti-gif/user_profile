import type IORedis from 'ioredis';

export type SyncState = { isScanning: boolean; total: number; current: number };

const KEY = 'gallery:syncState';

const DEFAULT_STATE: SyncState = { isScanning: false, total: 0, current: 0 };

export async function getSyncState(redis: IORedis | null): Promise<SyncState> {
  if (!redis) return DEFAULT_STATE;
  const raw = await redis.hgetall(KEY);
  if (!raw || Object.keys(raw).length === 0) return DEFAULT_STATE;
  return {
    isScanning: raw.isScanning === 'true',
    total: Number(raw.total || 0),
    current: Number(raw.current || 0),
    // Backward compatible extensions (ignored by old clients)
    ...(raw.stage ? { stage: raw.stage } : {}),
    ...(raw.message ? { message: raw.message } : {}),
  };
}

export async function setSyncState(redis: IORedis | null, patch: Partial<SyncState>): Promise<SyncState> {
  if (!redis) return { ...DEFAULT_STATE, ...patch };
  const current = await getSyncState(redis);
  const next: SyncState = {
    isScanning: patch.isScanning ?? current.isScanning,
    total: patch.total ?? current.total,
    current: patch.current ?? current.current,
    ...(patch as any),
  };
  const toWrite: Record<string, string> = {
    isScanning: String(next.isScanning),
    total: String(next.total),
    current: String(next.current),
  };
  if ((next as any).stage) toWrite.stage = String((next as any).stage);
  if ((next as any).message) toWrite.message = String((next as any).message);
  await redis.hset(KEY, toWrite);
  await redis.expire(KEY, 60 * 10);
  return next;
}

export async function resetSyncState(redis: IORedis | null): Promise<void> {
  if (!redis) return;
  await redis.del(KEY);
}

