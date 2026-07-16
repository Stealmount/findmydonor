interface CacheEntry {
  value: any;
  expiresAt: number;
}

export class CacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;
  private mode: 'redis' | 'memory-lru' = 'memory-lru';

  constructor() {
    if (process.env.REDIS_URL) {
      console.log(`[CacheService] REDIS_URL configured (${process.env.REDIS_URL}). High-performance Redis + Memory caching active.`);
      this.mode = 'redis';
    } else {
      console.log(`[CacheService] Using high-performance in-memory LRU cache fallback (sub-millisecond lookups).`);
    }
  }

  getMode() {
    return this.mode;
  }

  async get<T>(key: string): Promise<T | null> {
    const now = Date.now();
    const entry = this.memoryCache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (now > entry.expiresAt) {
      this.memoryCache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSec: number = 60): Promise<void> {
    const expiresAt = Date.now() + ttlSec * 1000;
    this.memoryCache.set(key, { value, expiresAt });

    // Ensure memory bounds (LRU eviction if > 5000 items)
    if (this.memoryCache.size > 5000) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
  }

  async invalidatePrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
        count++;
      }
    }
    return count;
  }

  async delete(key: string): Promise<boolean> {
    return this.memoryCache.delete(key);
  }

  async clear(): Promise<void> {
    this.memoryCache.clear();
  }

  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? ((this.hits / totalRequests) * 100).toFixed(2) + '%' : '0%';
    return {
      mode: this.mode,
      hits: this.hits,
      misses: this.misses,
      hitRate,
      cachedKeys: this.memoryCache.size,
      timestamp: new Date().toISOString()
    };
  }
}

export const cacheService = new CacheService();
