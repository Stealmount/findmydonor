/**
 * Redis Cache Service — replaces the in-memory LRU fallback.
 * Uses ioredis. Falls back to the same in-memory LRU if Redis is unavailable.
 *
 * Required env var:
 *   REDIS_URL — e.g. redis://localhost:6379  or  redis://:password@host:6379
 *   If not set, falls back to localhost:6379 automatically.
 */

import Redis from 'ioredis';

// ─── In-memory LRU fallback (same as original cacheService.ts) ────────────────
const MAX_MEMORY_ENTRIES = 500;
const memoryCache = new Map<string, { value: unknown; expiresAt: number }>();

function memGet<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { memoryCache.delete(key); return null; }
  return entry.value as T;
}

function memSet(key: string, value: unknown, ttlSeconds: number): void {
  if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // Evict oldest entry
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memInvalidatePrefix(prefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) memoryCache.delete(key);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

let redis: Redis | null = null;
let useRedis = false;
let lastRedisWarningAt = 0;

function warnRedis(message: string): void {
  const now = Date.now();
  if (now - lastRedisWarningAt < 300_000) return; // warn at most every 5 min
  lastRedisWarningAt = now;
  console.warn(`[Redis] ⚠️  ${message}; using in-memory LRU.`);
}

function getRedis(): Redis | null {
  if (redis) return redis;
  try {
    const retryStrategy = (times: number) => Math.min(times * 2_000, 30_000);
    const client = process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { lazyConnect: true, enableReadyCheck: false, maxRetriesPerRequest: 1, retryStrategy })
      : new Redis({ host: '127.0.0.1', port: 6379, lazyConnect: true, enableReadyCheck: false, maxRetriesPerRequest: 1, retryStrategy });

    client.on('connect',  () => { useRedis = true;  console.log('[Redis] ✅ Connected — high-speed cache active.'); });
    client.on('error',    (e) => { useRedis = false; warnRedis(`Unavailable: ${e.message}`); });
    client.on('end',      () => { useRedis = false; });

    client.connect().catch(() => { /* handled by error event */ });
    redis = client;
    return client;
  } catch (e) {
    console.warn('[Redis] Init error, falling back to in-memory cache.');
    return null;
  }
}

// Initialise on module load
getRedis();

/**
 * Get a cached value. Returns null on miss or error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (client && useRedis) {
    try {
      const raw = await client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch { /* fall through */ }
  }
  return memGet<T>(key);
}

/**
 * Set a cached value with TTL in seconds.
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  const client = getRedis();
  if (client && useRedis) {
    try {
      await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch { /* fall through */ }
  }
  memSet(key, value, ttlSeconds);
}

/**
 * Delete all keys that begin with `prefix`.
 */
export async function cacheInvalidatePrefix(prefix: string): Promise<void> {
  const client = getRedis();
  if (client && useRedis) {
    try {
      // SCAN is O(N) but non-blocking — safe for production
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
        cursor = next;
        if (keys.length > 0) await client.del(...keys);
      } while (cursor !== '0');
      return;
    } catch { /* fall through */ }
  }
  memInvalidatePrefix(prefix);
}

/**
 * Delete a single key.
 */
export async function cacheDel(key: string): Promise<void> {
  const client = getRedis();
  if (client && useRedis) {
    try { await client.del(key); return; } catch { /* fall through */ }
  }
  memoryCache.delete(key);
}

/**
 * Cache stats (compatible with legacy /api/cache/stats endpoint).
 */
export function getCacheStats() {
  return {
    backend: useRedis ? 'redis' : 'memory-lru',
    memoryEntries: memoryCache.size,
    redisConnected: useRedis,
  };
}
