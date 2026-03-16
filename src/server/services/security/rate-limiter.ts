/**
 * API Rate Limiter (API 限流)
 * Redis-based sliding window rate limiting with role-based limits.
 *
 * Requirements: 19.1
 */

import redis from '@/lib/redis';

// ─── Types ──────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

// ─── Rate limit configuration by role ───────────────────────

export const RATE_LIMITS: Record<string, number> = {
  FREE_USER: 60,
  PAID_USER: 120,
  VIP_MEMBER: 300,
  ADMIN: 600,
};

const DEFAULT_LIMIT = 60;
const WINDOW_SECONDS = 60;

// ─── Public API ─────────────────────────────────────────────

/**
 * Check and consume a rate limit token for the given user/role/endpoint.
 * Uses a per-minute Redis counter with TTL.
 *
 * Redis key: `ratelimit:{userId}:{minute}` with TTL 60s
 */
export async function checkRateLimit(
  userId: string,
  role: string,
  _endpoint: string,
): Promise<RateLimitResult> {
  const limit = RATE_LIMITS[role] ?? DEFAULT_LIMIT;
  const currentMinute = Math.floor(Date.now() / 1000 / WINDOW_SECONDS);
  const key = `ratelimit:${userId}:${currentMinute}`;

  const current = await redis.incr(key);

  // Set TTL on first request in this window
  if (current === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }

  const resetAt = new Date((currentMinute + 1) * WINDOW_SECONDS * 1000);

  if (current > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  return {
    allowed: true,
    remaining: limit - current,
    resetAt,
  };
}
