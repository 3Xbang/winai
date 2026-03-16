import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock Redis
vi.mock('@/lib/redis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    pipeline: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  };
  return { default: mockRedis, redis: mockRedis };
});

// Mock Prisma
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    subscriptionPlan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import {
  checkQuota,
  incrementUsage,
  subscribe,
  cancelSubscription,
  startTrial,
  downgradeToFree,
  sendRenewalNotifications,
  processExpiredSubscriptions,
} from '@/server/services/subscription/manager';

const mockPrisma = prisma as any;
const mockRedis = redis as any;

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== checkQuota ====================

describe('checkQuota', () => {
  it('should throw NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(checkQuota('nonexistent')).rejects.toThrow(TRPCError);
    await expect(checkQuota('nonexistent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('should return FREE tier limits for user without subscription', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'FREE_USER',
      subscription: null,
    });
    mockRedis.get.mockResolvedValue(null);

    const result = await checkQuota('user-1');

    expect(result.tier).toBe('FREE');
    expect(result.dailyLimit).toBe(3);
    expect(result.monthlyLimit).toBe(30);
    expect(result.allowed).toBe(true);
    expect(result.dailyUsed).toBe(0);
    expect(result.monthlyUsed).toBe(0);
  });

  it('should deny when FREE user exceeds daily limit', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'FREE_USER',
      subscription: null,
    });
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('daily')) return Promise.resolve('3');
      return Promise.resolve('5');
    });

    const result = await checkQuota('user-1');

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('今日咨询次数已达上限');
  });

  it('should deny when FREE user exceeds monthly limit', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      role: 'FREE_USER',
      subscription: null,
    });
    mockRedis.get.mockImplementation((key: string) => {
      if (key.includes('daily')) return Promise.resolve('1');
      return Promise.resolve('30');
    });

    const result = await checkQuota('user-1');

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('本月咨询次数已达上限');
  });

  it('should allow VIP users unlimited consultations', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-vip',
      role: 'VIP_MEMBER',
      subscription: {
        status: 'ACTIVE',
        endDate: futureDate,
        isTrial: false,
        trialEndDate: null,
        plan: {
          tier: 'VIP',
          dailyLimit: null,
          monthlyLimit: null,
        },
      },
    });

    const result = await checkQuota('user-vip');

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('VIP');
    expect(result.dailyLimit).toBeNull();
    expect(result.monthlyLimit).toBeNull();
  });

  it('should use STANDARD plan limits for paid users', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-std',
      role: 'PAID_USER',
      subscription: {
        status: 'ACTIVE',
        endDate: futureDate,
        isTrial: false,
        trialEndDate: null,
        plan: {
          tier: 'STANDARD',
          dailyLimit: 10,
          monthlyLimit: 200,
        },
      },
    });
    mockRedis.get.mockResolvedValue('5');

    const result = await checkQuota('user-std');

    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('STANDARD');
    expect(result.dailyLimit).toBe(10);
    expect(result.monthlyLimit).toBe(200);
  });

  it('should treat expired subscription as FREE tier', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-expired',
      role: 'PAID_USER',
      subscription: {
        status: 'ACTIVE',
        endDate: pastDate,
        isTrial: false,
        trialEndDate: null,
        plan: {
          tier: 'STANDARD',
          dailyLimit: 10,
          monthlyLimit: 200,
        },
      },
    });
    mockRedis.get.mockResolvedValue('0');

    const result = await checkQuota('user-expired');

    expect(result.tier).toBe('FREE');
    expect(result.dailyLimit).toBe(3);
    expect(result.monthlyLimit).toBe(30);
  });

  it('should treat expired trial as FREE tier', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-trial-expired',
      role: 'PAID_USER',
      subscription: {
        status: 'ACTIVE',
        endDate: futureDate,
        isTrial: true,
        trialEndDate: pastDate,
        plan: {
          tier: 'STANDARD',
          dailyLimit: 10,
          monthlyLimit: 200,
        },
      },
    });
    mockRedis.get.mockResolvedValue('0');

    const result = await checkQuota('user-trial-expired');

    expect(result.tier).toBe('FREE');
    expect(result.dailyLimit).toBe(3);
  });
});

// ==================== incrementUsage ====================

describe('incrementUsage', () => {
  it('should increment daily and monthly counters via Redis pipeline', async () => {
    const mockPipeline = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    mockRedis.pipeline.mockReturnValue(mockPipeline);

    await incrementUsage('user-1');

    expect(mockRedis.pipeline).toHaveBeenCalled();
    expect(mockPipeline.incr).toHaveBeenCalledTimes(2);
    expect(mockPipeline.expire).toHaveBeenCalledTimes(2);
    expect(mockPipeline.exec).toHaveBeenCalled();
  });
});

// ==================== subscribe ====================

describe('subscribe', () => {
  it('should throw NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(subscribe('nonexistent', 'plan-1')).rejects.toThrow(TRPCError);
    await expect(subscribe('nonexistent', 'plan-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('should throw NOT_FOUND when plan does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

    await expect(subscribe('user-1', 'bad-plan')).rejects.toThrow(TRPCError);
    await expect(subscribe('user-1', 'bad-plan')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('should throw NOT_FOUND when plan is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      isActive: false,
    });

    await expect(subscribe('user-1', 'plan-1')).rejects.toThrow('订阅计划不存在或已下架');
  });

  it('should throw CONFLICT when user has active subscription', async () => {
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      isActive: true,
      tier: 'STANDARD',
      period: 'MONTHLY',
    });
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: 'ACTIVE',
      endDate: futureDate,
    });

    await expect(subscribe('user-1', 'plan-1')).rejects.toThrow('用户已有活跃订阅');
  });

  it('should create new subscription for user without existing one', async () => {
    const mockSub = {
      id: 'sub-1',
      userId: 'user-1',
      planId: 'plan-1',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(),
      isTrial: false,
    };

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-1',
      isActive: true,
      tier: 'STANDARD',
      period: 'MONTHLY',
    });
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.$transaction.mockResolvedValue([mockSub, {}]);

    const result = await subscribe('user-1', 'plan-1');

    expect(result.id).toBe('sub-1');
    expect(result.userId).toBe('user-1');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
  });

  it('should update existing expired subscription', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);
    const mockSub = {
      id: 'sub-1',
      userId: 'user-1',
      planId: 'plan-vip',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(),
      isTrial: false,
    };

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.subscriptionPlan.findUnique.mockResolvedValue({
      id: 'plan-vip',
      isActive: true,
      tier: 'VIP',
      period: 'YEARLY',
    });
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: 'EXPIRED',
      endDate: pastDate,
    });
    mockPrisma.$transaction.mockResolvedValue([mockSub, {}]);

    const result = await subscribe('user-1', 'plan-vip');

    expect(result.planId).toBe('plan-vip');
  });
});

// ==================== cancelSubscription ====================

describe('cancelSubscription', () => {
  it('should throw NOT_FOUND when no subscription exists', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await expect(cancelSubscription('user-1')).rejects.toThrow('未找到订阅记录');
  });

  it('should throw BAD_REQUEST when subscription already cancelled', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: 'CANCELLED',
    });

    await expect(cancelSubscription('user-1')).rejects.toThrow('订阅已取消');
  });

  it('should cancel active subscription and downgrade role', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: 'ACTIVE',
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    await cancelSubscription('user-1');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    const transactionArgs = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionArgs).toHaveLength(2);
  });
});

// ==================== startTrial ====================

describe('startTrial', () => {
  it('should throw NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(startTrial('nonexistent')).rejects.toThrow('用户不存在');
  });

  it('should throw CONFLICT when user already has subscription', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: { id: 'sub-1' },
    });

    await expect(startTrial('user-1')).rejects.toThrow('用户已有订阅记录，无法开启试用');
  });

  it('should throw INTERNAL_SERVER_ERROR when no trial plan found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: null,
    });
    mockPrisma.subscriptionPlan.findFirst.mockResolvedValue(null);

    await expect(startTrial('user-1')).rejects.toThrow('未找到可用的试用计划');
  });

  it('should create 7-day trial subscription', async () => {
    const now = new Date();
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 7);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      subscription: null,
    });
    mockPrisma.subscriptionPlan.findFirst.mockResolvedValue({
      id: 'plan-std-monthly',
      tier: 'STANDARD',
      isActive: true,
    });

    const mockSub = {
      id: 'sub-trial',
      userId: 'user-1',
      planId: 'plan-std-monthly',
      status: 'TRIAL',
      startDate: now,
      endDate: trialEnd,
      isTrial: true,
      trialEndDate: trialEnd,
    };

    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        subscription: {
          create: vi.fn().mockResolvedValue(mockSub),
        },
        user: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      return fn(tx);
    });

    const result = await startTrial('user-1');

    expect(result.isTrial).toBe(true);
    expect(result.subscriptionId).toBe('sub-trial');
    expect(result.userId).toBe('user-1');
    expect(result.trialEndDate).toEqual(trialEnd);
  });
});

// ==================== downgradeToFree ====================

describe('downgradeToFree', () => {
  it('should do nothing when no subscription exists', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    await downgradeToFree('user-1');

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('should set subscription to EXPIRED and role to FREE_USER', async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      userId: 'user-1',
      status: 'ACTIVE',
    });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    await downgradeToFree('user-1');

    expect(mockPrisma.$transaction).toHaveBeenCalled();
    const transactionArgs = mockPrisma.$transaction.mock.calls[0][0];
    expect(transactionArgs).toHaveLength(2);
  });
});

// ==================== sendRenewalNotifications ====================

describe('sendRenewalNotifications', () => {
  it('should return empty array when no subscriptions are expiring', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const result = await sendRenewalNotifications();

    expect(result).toEqual([]);
  });

  it('should notify users with expiring subscriptions', async () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);

    mockPrisma.subscription.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        endDate: expiryDate,
        user: { id: 'user-1', email: 'test@example.com', phone: null, name: 'Test' },
        plan: { name: 'Standard Monthly', tier: 'STANDARD' },
      },
    ]);
    mockRedis.get.mockResolvedValue(null); // not yet notified
    mockRedis.set.mockResolvedValue('OK');

    const result = await sendRenewalNotifications();

    expect(result).toEqual(['user-1']);
    expect(mockRedis.set).toHaveBeenCalled();
  });

  it('should skip already notified users', async () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 2);

    mockPrisma.subscription.findMany.mockResolvedValue([
      {
        userId: 'user-1',
        endDate: expiryDate,
        user: { id: 'user-1', email: 'test@example.com', phone: null, name: 'Test' },
        plan: { name: 'Standard Monthly', tier: 'STANDARD' },
      },
    ]);
    mockRedis.get.mockResolvedValue('1'); // already notified

    const result = await sendRenewalNotifications();

    expect(result).toEqual([]);
  });
});

// ==================== processExpiredSubscriptions ====================

describe('processExpiredSubscriptions', () => {
  it('should return empty array when no subscriptions are expired', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([]);

    const result = await processExpiredSubscriptions();

    expect(result).toEqual([]);
  });

  it('should downgrade all expired subscriptions', async () => {
    mockPrisma.subscription.findMany.mockResolvedValue([
      { userId: 'user-1' },
      { userId: 'user-2' },
    ]);
    // downgradeToFree calls
    mockPrisma.subscription.findUnique
      .mockResolvedValueOnce({ userId: 'user-1', status: 'ACTIVE' })
      .mockResolvedValueOnce({ userId: 'user-2', status: 'ACTIVE' });
    mockPrisma.$transaction.mockResolvedValue([{}, {}]);

    const result = await processExpiredSubscriptions();

    expect(result).toEqual(['user-1', 'user-2']);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });
});
