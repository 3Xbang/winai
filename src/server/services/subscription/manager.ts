import { TRPCError } from '@trpc/server';
import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import type { SubscriptionStatus, SubscriptionTier } from '@prisma/client';

// ==================== Types ====================

export interface QuotaStatus {
  allowed: boolean;
  tier: SubscriptionTier;
  dailyUsed: number;
  dailyLimit: number | null;
  monthlyUsed: number;
  monthlyLimit: number | null;
  reason?: string;
}

export interface Trial {
  subscriptionId: string;
  userId: string;
  planId: string;
  startDate: Date;
  trialEndDate: Date;
  isTrial: boolean;
}

// ==================== Constants ====================

const FREE_DAILY_LIMIT = 3;
const FREE_MONTHLY_LIMIT = 30;
const TRIAL_DAYS = 7;
const RENEWAL_NOTICE_DAYS = 3;

// Redis key helpers
const dailyKey = (userId: string, date: string) => `quota:daily:${userId}:${date}`;
const monthlyKey = (userId: string, month: string) => `quota:monthly:${userId}:${month}`;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

// ==================== Subscription Manager ====================

/**
 * Check consultation quota for a user.
 * FREE users: 3/day, 30/month. VIP: unlimited. STANDARD: plan limits.
 */
export async function checkQuota(userId: string): Promise<QuotaStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscription: {
        include: { plan: true },
      },
    },
  });

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
  }

  const subscription = user.subscription;
  const now = new Date();

  // Determine effective tier
  let tier: SubscriptionTier = 'FREE';
  let dailyLimit: number | null = FREE_DAILY_LIMIT;
  let monthlyLimit: number | null = FREE_MONTHLY_LIMIT;

  if (subscription && subscription.status === 'ACTIVE') {
    // Check if subscription has expired
    if (subscription.endDate <= now) {
      // Auto-downgrade handled elsewhere; treat as FREE
      tier = 'FREE';
      dailyLimit = FREE_DAILY_LIMIT;
      monthlyLimit = FREE_MONTHLY_LIMIT;
    } else if (subscription.isTrial && subscription.trialEndDate && subscription.trialEndDate <= now) {
      // Trial expired
      tier = 'FREE';
      dailyLimit = FREE_DAILY_LIMIT;
      monthlyLimit = FREE_MONTHLY_LIMIT;
    } else {
      tier = subscription.plan.tier;
      dailyLimit = subscription.plan.dailyLimit;
      monthlyLimit = subscription.plan.monthlyLimit;
    }
  }

  // VIP: unlimited
  if (tier === 'VIP') {
    return {
      allowed: true,
      tier,
      dailyUsed: 0,
      dailyLimit: null,
      monthlyUsed: 0,
      monthlyLimit: null,
    };
  }

  // Get usage from Redis
  const today = todayStr();
  const month = monthStr();
  const [dailyUsedStr, monthlyUsedStr] = await Promise.all([
    redis.get(dailyKey(userId, today)),
    redis.get(monthlyKey(userId, month)),
  ]);

  const dailyUsed = parseInt(dailyUsedStr || '0', 10);
  const monthlyUsed = parseInt(monthlyUsedStr || '0', 10);

  // Check limits
  if (dailyLimit !== null && dailyUsed >= dailyLimit) {
    return {
      allowed: false,
      tier,
      dailyUsed,
      dailyLimit,
      monthlyUsed,
      monthlyLimit,
      reason: '今日咨询次数已达上限',
    };
  }

  if (monthlyLimit !== null && monthlyUsed >= monthlyLimit) {
    return {
      allowed: false,
      tier,
      dailyUsed,
      dailyLimit,
      monthlyUsed,
      monthlyLimit,
      reason: '本月咨询次数已达上限',
    };
  }

  return {
    allowed: true,
    tier,
    dailyUsed,
    dailyLimit,
    monthlyUsed,
    monthlyLimit,
  };
}


/**
 * Increment usage counters in Redis after a consultation.
 */
export async function incrementUsage(userId: string): Promise<void> {
  const today = todayStr();
  const month = monthStr();

  const pipeline = redis.pipeline();
  pipeline.incr(dailyKey(userId, today));
  pipeline.expire(dailyKey(userId, today), 86400); // 24h TTL
  pipeline.incr(monthlyKey(userId, month));
  pipeline.expire(monthlyKey(userId, month), 86400 * 31); // ~31 days TTL
  await pipeline.exec();
}

/**
 * Create a subscription for a user.
 */
export async function subscribe(
  userId: string,
  planId: string,
): Promise<{
  id: string;
  userId: string;
  planId: string;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  isTrial: boolean;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
  }

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '订阅计划不存在或已下架' });
  }

  // Check for existing active subscription
  const existing = await prisma.subscription.findUnique({ where: { userId } });
  if (existing && existing.status === 'ACTIVE' && existing.endDate > new Date()) {
    throw new TRPCError({ code: 'CONFLICT', message: '用户已有活跃订阅' });
  }

  const now = new Date();
  const endDate = new Date(now);
  if (plan.period === 'MONTHLY') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (plan.period === 'YEARLY') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    // SINGLE: 30 days access
    endDate.setDate(endDate.getDate() + 30);
  }

  // Map tier to role
  const roleMap: Record<string, 'FREE_USER' | 'PAID_USER' | 'VIP_MEMBER'> = {
    FREE: 'FREE_USER',
    STANDARD: 'PAID_USER',
    VIP: 'VIP_MEMBER',
  };

  const [subscription] = await prisma.$transaction([
    existing
      ? prisma.subscription.update({
          where: { userId },
          data: {
            planId,
            status: 'ACTIVE',
            startDate: now,
            endDate,
            isTrial: false,
            trialEndDate: null,
            autoRenew: true,
          },
        })
      : prisma.subscription.create({
          data: {
            userId,
            planId,
            status: 'ACTIVE',
            startDate: now,
            endDate,
            isTrial: false,
            autoRenew: true,
          },
        }),
    prisma.user.update({
      where: { id: userId },
      data: { role: roleMap[plan.tier] || 'PAID_USER' },
    }),
  ]);

  return subscription;
}

/**
 * Cancel a user's subscription.
 */
export async function cancelSubscription(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '未找到订阅记录' });
  }

  if (subscription.status === 'CANCELLED') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '订阅已取消' });
  }

  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId },
      data: { status: 'CANCELLED', autoRenew: false },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { role: 'FREE_USER' },
    }),
  ]);
}

/**
 * Start a 7-day trial for a new user.
 */
export async function startTrial(userId: string): Promise<Trial> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
  }

  if (user.subscription) {
    throw new TRPCError({ code: 'CONFLICT', message: '用户已有订阅记录，无法开启试用' });
  }

  // Find the STANDARD plan for trial (default trial plan)
  const trialPlan = await prisma.subscriptionPlan.findFirst({
    where: { tier: 'STANDARD', isActive: true },
    orderBy: { price: 'asc' },
  });

  if (!trialPlan) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: '未找到可用的试用计划' });
  }

  const now = new Date();
  const trialEndDate = new Date(now);
  trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DAYS);

  const subscription = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId,
        planId: trialPlan.id,
        status: 'TRIAL',
        startDate: now,
        endDate: trialEndDate,
        isTrial: true,
        trialEndDate,
        autoRenew: false,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { role: 'PAID_USER' },
    });

    return sub;
  });

  return {
    subscriptionId: subscription.id,
    userId: subscription.userId,
    planId: subscription.planId,
    startDate: subscription.startDate,
    trialEndDate: subscription.trialEndDate!,
    isTrial: true,
  };
}

/**
 * Downgrade a user to FREE tier (e.g., when subscription expires).
 */
export async function downgradeToFree(userId: string): Promise<void> {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription) {
    // No subscription — already free, nothing to do
    return;
  }

  await prisma.$transaction([
    prisma.subscription.update({
      where: { userId },
      data: { status: 'EXPIRED' },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { role: 'FREE_USER' },
    }),
  ]);
}

/**
 * Check for subscriptions expiring within N days and send renewal notifications.
 * Returns list of user IDs that were notified.
 */
export async function sendRenewalNotifications(): Promise<string[]> {
  const now = new Date();
  const noticeDate = new Date(now);
  noticeDate.setDate(noticeDate.getDate() + RENEWAL_NOTICE_DAYS);

  const expiringSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: {
        gte: now,
        lte: noticeDate,
      },
      autoRenew: true,
    },
    include: {
      user: { select: { id: true, email: true, phone: true, name: true } },
      plan: { select: { name: true, tier: true } },
    },
  });

  const notifiedUserIds: string[] = [];

  for (const sub of expiringSubscriptions) {
    const notificationKey = `renewal:notified:${sub.userId}:${sub.endDate.toISOString().slice(0, 10)}`;
    const alreadyNotified = await redis.get(notificationKey);

    if (!alreadyNotified) {
      // Mark as notified (prevent duplicate notifications)
      await redis.set(notificationKey, '1', 'EX', 86400 * 7);

      // In production, integrate SES/SMS here:
      // await sendEmail(sub.user.email, 'renewal_reminder', { ... });
      // await sendSMS(sub.user.phone, '您的订阅将于...到期');

      notifiedUserIds.push(sub.userId);
    }
  }

  return notifiedUserIds;
}

/**
 * Process expired subscriptions — auto-downgrade to FREE.
 * Returns list of user IDs that were downgraded.
 */
export async function processExpiredSubscriptions(): Promise<string[]> {
  const now = new Date();

  const expiredSubscriptions = await prisma.subscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIAL'] },
      endDate: { lt: now },
    },
    select: { userId: true },
  });

  const downgradedUserIds: string[] = [];

  for (const sub of expiredSubscriptions) {
    await downgradeToFree(sub.userId);
    downgradedUserIds.push(sub.userId);
  }

  return downgradedUserIds;
}
