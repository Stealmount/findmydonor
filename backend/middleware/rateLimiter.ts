// Rate limiter middleware — Phase 6 (6.2): Redis-backed, in-memory fallback.
// Uses atomic INCR/EXPIRE when Redis is connected; falls back to the original
// in-memory Map so local dev and tests work without Redis.
import express from "express";
import { getRedisClient } from "../src/lib/redisCache";

// ─── In-memory fallback (original implementation, kept for no-Redis envs) ────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function memRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

/**
 * Redis-backed rate limit check. Atomic INCR + EXPIRE via ioredis.
 * Returns true if the request is allowed.
 */
async function checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const client = getRedisClient();
  if (client && client.status === "ready") {
    try {
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, Math.ceil(windowMs / 1000));
      }
      return count <= max;
    } catch {
      // Redis transient failure — fall through to memory
    }
  }
  return memRateLimit(key, max, windowMs);
}

function rateLimitMiddleware(max: number, windowMs = 60_000) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || "unknown";
    const key = `rl:${req.method}:${req.baseUrl || ""}${req.path}:${ip}`;
    if (!(await checkRateLimit(key, max, windowMs))) {
      return res.status(429).json({ error: "Too many requests. Please slow down." });
    }
    next();
  };
}

// Periodically clean up rate limit map (memory fallback only)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateLimitMap.entries()) {
    if (now > v.resetAt) rateLimitMap.delete(k);
  }
}, 60_000);

export default rateLimitMiddleware;
