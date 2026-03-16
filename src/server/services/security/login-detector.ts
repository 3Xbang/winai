/**
 * Anomalous Login Detector (异常登录检测)
 * Redis-based login IP tracking and anomaly detection.
 * Detects new IP + recent login failures as anomalous behavior.
 *
 * Requirements: 19.8
 */

import redis from '@/lib/redis';

// ─── Types ──────────────────────────────────────────────────

export interface AnomalyResult {
  isAnomalous: boolean;
  reason?: string;
  shouldAlert: boolean;
}

// ─── Constants ──────────────────────────────────────────────

const IP_SET_PREFIX = 'login:ips:';
const FAILURE_PREFIX = 'login:failures:';
const MAX_STORED_IPS = 50;
const IP_RETENTION_SECONDS = 90 * 24 * 60 * 60; // 90 days
const FAILURE_WINDOW_SECONDS = 3600; // 1 hour
const FAILURE_THRESHOLD = 3;

// ─── Public API ─────────────────────────────────────────────

/**
 * Record a login IP for a user in a Redis sorted set (score = timestamp).
 */
export async function recordLoginIP(userId: string, ip: string): Promise<void> {
  const key = `${IP_SET_PREFIX}${userId}`;
  const now = Date.now();

  await redis.zadd(key, now, ip);

  // Trim to keep only the most recent IPs
  const count = await redis.zcard(key);
  if (count > MAX_STORED_IPS) {
    await redis.zremrangebyrank(key, 0, count - MAX_STORED_IPS - 1);
  }

  // Set expiry on the key
  await redis.expire(key, IP_RETENTION_SECONDS);
}

/**
 * Detect anomalous login: new IP AND >= 3 failures in the last hour.
 */
export async function detectAnomalousLogin(
  userId: string,
  ip: string,
): Promise<AnomalyResult> {
  const key = `${IP_SET_PREFIX}${userId}`;

  // Check if IP is known
  const score = await redis.zscore(key, ip);
  const isNewIP = score === null;

  if (!isNewIP) {
    return { isAnomalous: false, shouldAlert: false };
  }

  // Check recent failure count
  const failureKey = `${FAILURE_PREFIX}${userId}`;
  const failureCountStr = await redis.get(failureKey);
  const failureCount = failureCountStr ? parseInt(failureCountStr, 10) : 0;

  if (failureCount >= FAILURE_THRESHOLD) {
    return {
      isAnomalous: true,
      reason: `New IP address detected with ${failureCount} failed login attempts in the last hour`,
      shouldAlert: true,
    };
  }

  return { isAnomalous: false, shouldAlert: false };
}

/**
 * Get recent login IPs for a user, ordered by most recent first.
 */
export async function getRecentLoginIPs(userId: string): Promise<string[]> {
  const key = `${IP_SET_PREFIX}${userId}`;
  // zrevrange returns members from highest to lowest score (most recent first)
  return redis.zrevrange(key, 0, -1);
}

/**
 * Record a failed login attempt. Increments a counter with 1-hour TTL.
 */
export async function recordFailedLogin(userId: string): Promise<void> {
  const key = `${FAILURE_PREFIX}${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, FAILURE_WINDOW_SECONDS);
  }
}

/**
 * Reset the failed login counter (e.g., after successful login).
 */
export async function resetFailedLogins(userId: string): Promise<void> {
  const key = `${FAILURE_PREFIX}${userId}`;
  await redis.del(key);
}
