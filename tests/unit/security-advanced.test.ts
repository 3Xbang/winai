import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ─────────────────────────────────────────

const { mockRedis, mockPrisma } = vi.hoisted(() => {
  const mockRedis = {
    zadd: vi.fn(),
    zcard: vi.fn(),
    zremrangebyrank: vi.fn(),
    expire: vi.fn(),
    zscore: vi.fn(),
    zrevrange: vi.fn(),
    get: vi.fn(),
    incr: vi.fn(),
    del: vi.fn(),
  };

  const mockPrisma = {
    user: {
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    consultationSession: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    bookmark: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    order: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    auditLog: {
      deleteMany: vi.fn(),
    },
    enterprise: {
      deleteMany: vi.fn(),
    },
    socialAccount: {
      deleteMany: vi.fn(),
    },
  };

  return { mockRedis, mockPrisma };
});

vi.mock('@/lib/redis', () => ({ default: mockRedis }));
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

// ─── Imports (after mocks) ──────────────────────────────────

import {
  recordLoginIP,
  detectAnomalousLogin,
  getRecentLoginIPs,
  recordFailedLogin,
  resetFailedLogins,
} from '@/server/services/security/login-detector';

import {
  softDeleteUser,
  markForDeletion,
  exportUserData,
  permanentlyDeleteUser,
} from '@/server/services/security/data-retention';

import {
  checkRateLimit,
  RATE_LIMITS,
} from '@/server/services/security/rate-limiter';

// ═══════════════════════════════════════════════════════════
// 1. Login Detector Tests
// ═══════════════════════════════════════════════════════════

describe('Login Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── recordLoginIP ──────────────────────────────────────

  describe('recordLoginIP', () => {
    it('should store IP in Redis sorted set with timestamp score', async () => {
      mockRedis.zcard.mockResolvedValue(1);

      await recordLoginIP('user-1', '1.2.3.4');

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'login:ips:user-1',
        expect.any(Number),
        '1.2.3.4',
      );
    });

    it('should set expiry on the IP set key', async () => {
      mockRedis.zcard.mockResolvedValue(1);

      await recordLoginIP('user-1', '1.2.3.4');

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'login:ips:user-1',
        90 * 24 * 60 * 60,
      );
    });

    it('should trim old IPs when exceeding max stored count', async () => {
      mockRedis.zcard.mockResolvedValue(51);

      await recordLoginIP('user-1', '10.0.0.1');

      expect(mockRedis.zremrangebyrank).toHaveBeenCalledWith(
        'login:ips:user-1',
        0,
        0,
      );
    });

    it('should not trim when under max stored count', async () => {
      mockRedis.zcard.mockResolvedValue(10);

      await recordLoginIP('user-1', '10.0.0.1');

      expect(mockRedis.zremrangebyrank).not.toHaveBeenCalled();
    });
  });

  // ─── detectAnomalousLogin ─────────────────────────────────

  describe('detectAnomalousLogin', () => {
    it('should return not anomalous for a known IP', async () => {
      mockRedis.zscore.mockResolvedValue('1700000000000');

      const result = await detectAnomalousLogin('user-1', '1.2.3.4');

      expect(result.isAnomalous).toBe(false);
      expect(result.shouldAlert).toBe(false);
    });

    it('should return anomalous for new IP with >= 3 failures', async () => {
      mockRedis.zscore.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue('3');

      const result = await detectAnomalousLogin('user-1', '99.99.99.99');

      expect(result.isAnomalous).toBe(true);
      expect(result.shouldAlert).toBe(true);
      expect(result.reason).toContain('New IP');
      expect(result.reason).toContain('3');
    });

    it('should return anomalous for new IP with more than 3 failures', async () => {
      mockRedis.zscore.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue('7');

      const result = await detectAnomalousLogin('user-1', '99.99.99.99');

      expect(result.isAnomalous).toBe(true);
      expect(result.shouldAlert).toBe(true);
    });

    it('should return not anomalous for new IP with fewer than 3 failures', async () => {
      mockRedis.zscore.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue('2');

      const result = await detectAnomalousLogin('user-1', '5.5.5.5');

      expect(result.isAnomalous).toBe(false);
      expect(result.shouldAlert).toBe(false);
    });

    it('should return not anomalous for new IP with zero failures', async () => {
      mockRedis.zscore.mockResolvedValue(null);
      mockRedis.get.mockResolvedValue(null);

      const result = await detectAnomalousLogin('user-1', '5.5.5.5');

      expect(result.isAnomalous).toBe(false);
      expect(result.shouldAlert).toBe(false);
    });
  });

  // ─── getRecentLoginIPs ────────────────────────────────────

  describe('getRecentLoginIPs', () => {
    it('should return IPs from Redis sorted set in reverse order', async () => {
      mockRedis.zrevrange.mockResolvedValue(['10.0.0.3', '10.0.0.2', '10.0.0.1']);

      const ips = await getRecentLoginIPs('user-1');

      expect(ips).toEqual(['10.0.0.3', '10.0.0.2', '10.0.0.1']);
      expect(mockRedis.zrevrange).toHaveBeenCalledWith('login:ips:user-1', 0, -1);
    });

    it('should return empty array when no IPs recorded', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);

      const ips = await getRecentLoginIPs('user-new');

      expect(ips).toEqual([]);
    });
  });

  // ─── recordFailedLogin ────────────────────────────────────

  describe('recordFailedLogin', () => {
    it('should increment the failure counter', async () => {
      mockRedis.incr.mockResolvedValue(2);

      await recordFailedLogin('user-1');

      expect(mockRedis.incr).toHaveBeenCalledWith('login:failures:user-1');
    });

    it('should set TTL on first failure', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await recordFailedLogin('user-1');

      expect(mockRedis.expire).toHaveBeenCalledWith('login:failures:user-1', 3600);
    });

    it('should not reset TTL on subsequent failures', async () => {
      mockRedis.incr.mockResolvedValue(3);

      await recordFailedLogin('user-1');

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  // ─── resetFailedLogins ────────────────────────────────────

  describe('resetFailedLogins', () => {
    it('should delete the failure counter key', async () => {
      await resetFailedLogins('user-1');

      expect(mockRedis.del).toHaveBeenCalledWith('login:failures:user-1');
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Data Retention Tests
// ═══════════════════════════════════════════════════════════

describe('Data Retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── softDeleteUser ───────────────────────────────────────

  describe('softDeleteUser', () => {
    it('should set deletedAt on the user record', async () => {
      mockPrisma.user.update.mockResolvedValue({});

      await softDeleteUser('user-1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should set deletedAt to approximately now', async () => {
      mockPrisma.user.update.mockResolvedValue({});
      const before = Date.now();

      await softDeleteUser('user-1');

      const after = Date.now();
      const call = mockPrisma.user.update.mock.calls[0]![0];
      const deletedAt = call.data.deletedAt as Date;
      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(deletedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  // ─── markForDeletion ──────────────────────────────────────

  describe('markForDeletion', () => {
    it('should query users with deletedAt > 90 days ago', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await markForDeletion();

      const call = mockPrisma.user.findMany.mock.calls[0]![0];
      expect(call.where.deletedAt.not).toBeNull();
      expect(call.where.deletedAt.lte).toBeInstanceOf(Date);

      // The cutoff should be approximately 90 days ago
      const cutoff = call.where.deletedAt.lte as Date;
      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const expectedCutoff = Date.now() - ninetyDaysMs;
      expect(Math.abs(cutoff.getTime() - expectedCutoff)).toBeLessThan(5000);
    });

    it('should return user IDs eligible for deletion', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-old-1' },
        { id: 'user-old-2' },
      ]);

      const ids = await markForDeletion();

      expect(ids).toEqual(['user-old-1', 'user-old-2']);
    });

    it('should return empty array when no users are eligible', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const ids = await markForDeletion();

      expect(ids).toEqual([]);
    });
  });

  // ─── exportUserData ───────────────────────────────────────

  describe('exportUserData', () => {
    it('should export all user data as structured JSON', async () => {
      const mockUser = { id: 'user-1', name: 'Test', enterprise: null };
      const mockSessions = [{ id: 'sess-1', userId: 'user-1' }];
      const mockMessages = [{ id: 'msg-1', sessionId: 'sess-1' }];
      const mockBookmarks = [{ id: 'bm-1', userId: 'user-1' }];
      const mockOrders = [{ id: 'ord-1', userId: 'user-1' }];

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.consultationSession.findMany.mockResolvedValue(mockSessions);
      mockPrisma.message.findMany.mockResolvedValue(mockMessages);
      mockPrisma.bookmark.findMany.mockResolvedValue(mockBookmarks);
      mockPrisma.order.findMany.mockResolvedValue(mockOrders);

      const result = await exportUserData('user-1');

      expect(result.user).toEqual(mockUser);
      expect(result.sessions).toEqual(mockSessions);
      expect(result.messages).toEqual(mockMessages);
      expect(result.bookmarks).toEqual(mockBookmarks);
      expect(result.orders).toEqual(mockOrders);
    });

    it('should include all required fields in the export', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.consultationSession.findMany.mockResolvedValue([]);
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.bookmark.findMany.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);

      const result = await exportUserData('user-1');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('bookmarks');
      expect(result).toHaveProperty('orders');
    });

    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(exportUserData('non-existent')).rejects.toThrow('not found');
    });

    it('should query messages for the user sessions only', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      mockPrisma.consultationSession.findMany.mockResolvedValue([
        { id: 'sess-a' },
        { id: 'sess-b' },
      ]);
      mockPrisma.message.findMany.mockResolvedValue([]);
      mockPrisma.bookmark.findMany.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await exportUserData('user-1');

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: { in: ['sess-a', 'sess-b'] } },
      });
    });
  });

  // ─── permanentlyDeleteUser ────────────────────────────────

  describe('permanentlyDeleteUser', () => {
    it('should delete all user data in dependency order', async () => {
      mockPrisma.consultationSession.findMany.mockResolvedValue([
        { id: 'sess-1' },
      ]);
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.bookmark.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.consultationSession.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.order.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 3 });
      mockPrisma.enterprise.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.socialAccount.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.delete.mockResolvedValue({});

      await permanentlyDeleteUser('user-1');

      // Verify all related data is deleted
      expect(mockPrisma.message.deleteMany).toHaveBeenCalled();
      expect(mockPrisma.bookmark.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.consultationSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.order.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.enterprise.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.socialAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
    });

    it('should delete messages for the correct sessions', async () => {
      mockPrisma.consultationSession.findMany.mockResolvedValue([
        { id: 'sess-a' },
        { id: 'sess-b' },
      ]);
      mockPrisma.message.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.bookmark.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.consultationSession.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.order.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.enterprise.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.socialAccount.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.delete.mockResolvedValue({});

      await permanentlyDeleteUser('user-1');

      expect(mockPrisma.message.deleteMany).toHaveBeenCalledWith({
        where: { sessionId: { in: ['sess-a', 'sess-b'] } },
      });
    });

    it('should delete user record last', async () => {
      const callOrder: string[] = [];
      mockPrisma.consultationSession.findMany.mockResolvedValue([]);
      mockPrisma.message.deleteMany.mockImplementation(async () => { callOrder.push('messages'); return { count: 0 }; });
      mockPrisma.bookmark.deleteMany.mockImplementation(async () => { callOrder.push('bookmarks'); return { count: 0 }; });
      mockPrisma.consultationSession.deleteMany.mockImplementation(async () => { callOrder.push('sessions'); return { count: 0 }; });
      mockPrisma.order.deleteMany.mockImplementation(async () => { callOrder.push('orders'); return { count: 0 }; });
      mockPrisma.auditLog.deleteMany.mockImplementation(async () => { callOrder.push('auditLogs'); return { count: 0 }; });
      mockPrisma.enterprise.deleteMany.mockImplementation(async () => { callOrder.push('enterprise'); return { count: 0 }; });
      mockPrisma.socialAccount.deleteMany.mockImplementation(async () => { callOrder.push('socialAccounts'); return { count: 0 }; });
      mockPrisma.user.delete.mockImplementation(async () => { callOrder.push('user'); return {}; });

      await permanentlyDeleteUser('user-1');

      expect(callOrder[callOrder.length - 1]).toBe('user');
    });
  });
});


// ═══════════════════════════════════════════════════════════
// 3. Rate Limiter Tests
// ═══════════════════════════════════════════════════════════

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Role-based limits ────────────────────────────────────

  describe('role-based rate limits', () => {
    it('should define correct limits for FREE_USER', () => {
      expect(RATE_LIMITS['FREE_USER']).toBe(60);
    });

    it('should define correct limits for PAID_USER', () => {
      expect(RATE_LIMITS['PAID_USER']).toBe(120);
    });

    it('should define correct limits for VIP_MEMBER', () => {
      expect(RATE_LIMITS['VIP_MEMBER']).toBe(300);
    });

    it('should define correct limits for ADMIN', () => {
      expect(RATE_LIMITS['ADMIN']).toBe(600);
    });
  });

  // ─── checkRateLimit ───────────────────────────────────────

  describe('checkRateLimit', () => {
    it('should allow first request and return remaining count', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const result = await checkRateLimit('user-1', 'FREE_USER', '/api/consult');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(59); // 60 - 1
      expect(result.resetAt).toBeInstanceOf(Date);
    });

    it('should set TTL on first request in window', async () => {
      mockRedis.incr.mockResolvedValue(1);

      await checkRateLimit('user-1', 'FREE_USER', '/api/consult');

      expect(mockRedis.expire).toHaveBeenCalledWith(
        expect.stringMatching(/^ratelimit:user-1:\d+$/),
        60,
      );
    });

    it('should not reset TTL on subsequent requests', async () => {
      mockRedis.incr.mockResolvedValue(5);

      await checkRateLimit('user-1', 'FREE_USER', '/api/consult');

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should block when limit is exceeded for FREE_USER', async () => {
      mockRedis.incr.mockResolvedValue(61);

      const result = await checkRateLimit('user-1', 'FREE_USER', '/api/consult');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow up to the limit for FREE_USER', async () => {
      mockRedis.incr.mockResolvedValue(60);

      const result = await checkRateLimit('user-1', 'FREE_USER', '/api/consult');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('should allow higher limits for PAID_USER', async () => {
      mockRedis.incr.mockResolvedValue(100);

      const result = await checkRateLimit('user-2', 'PAID_USER', '/api/consult');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(20); // 120 - 100
    });

    it('should block PAID_USER when exceeding 120', async () => {
      mockRedis.incr.mockResolvedValue(121);

      const result = await checkRateLimit('user-2', 'PAID_USER', '/api/consult');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should allow higher limits for VIP_MEMBER', async () => {
      mockRedis.incr.mockResolvedValue(250);

      const result = await checkRateLimit('user-3', 'VIP_MEMBER', '/api/consult');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(50); // 300 - 250
    });

    it('should allow highest limits for ADMIN', async () => {
      mockRedis.incr.mockResolvedValue(500);

      const result = await checkRateLimit('admin-1', 'ADMIN', '/api/admin');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100); // 600 - 500
    });

    it('should use default limit for unknown roles', async () => {
      mockRedis.incr.mockResolvedValue(61);

      const result = await checkRateLimit('user-x', 'UNKNOWN_ROLE', '/api/test');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return a future resetAt date', async () => {
      mockRedis.incr.mockResolvedValue(1);

      const before = Date.now();
      const result = await checkRateLimit('user-1', 'FREE_USER', '/api/test');

      // resetAt should be within the next ~60 seconds
      expect(result.resetAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.resetAt.getTime()).toBeLessThanOrEqual(before + 61000);
    });
  });
});
