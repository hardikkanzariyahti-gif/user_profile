import IORedis from 'ioredis';

let _redis: IORedis | null = null;

export function getRedis(): IORedis | null {
  // For now (per current project requirement), Redis is disabled by default.
  // Enable later by setting ENABLE_REDIS=true and providing REDIS_URL.
  if (process.env.ENABLE_REDIS !== 'true') return null;

  const url = process.env.REDIS_URL;
  if (!url) return null;
  if (_redis) return _redis;
  _redis = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  _redis.on('error', (err) => {
    console.warn('[Redis] error:', err?.message || err);
  });
  return _redis;
}

