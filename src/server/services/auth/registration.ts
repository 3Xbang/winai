import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import {
  hashPassword,
  generateVerificationCode,
  storeVerificationCode,
  verifyCode,
} from '@/lib/auth-helpers';
import { TRPCError } from '@trpc/server';

// Redis key patterns for login failure tracking
const LOGIN_ATTEMPTS_KEY = (userId: string) => `login:attempts:${userId}`;
const LOGIN_LOCK_KEY = (userId: string) => `login:lock:${userId}`;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_SECONDS = 30 * 60; // 30 minutes

// ==================== Email Registration ====================

export async function sendEmailVerificationCode(email: string): Promise<void> {
  // Check email uniqueness
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: '该邮箱已被注册',
    });
  }

  const code = generateVerificationCode();
  const key = `verify:email:${email}`;
  await storeVerificationCode(key, code);

  // In production, send email via SES. For now, log it.
  console.log(`[Email Verification] ${email}: ${code}`);
}

export async function registerWithEmail(
  email: string,
  code: string,
  password: string,
  name?: string,
) {
  const key = `verify:email:${email}`;
  const isValid = await verifyCode(key, code);
  if (!isValid) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '验证码无效或已过期',
    });
  }

  // Double-check uniqueness (race condition guard)
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: '该邮箱已被注册',
    });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      isEmailVerified: true,
    },
  });

  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// ==================== Phone Registration ====================

export async function sendPhoneVerificationCode(phone: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: '该手机号已被注册',
    });
  }

  const code = generateVerificationCode();
  const key = `verify:phone:${phone}`;
  await storeVerificationCode(key, code);

  // In production, send SMS. For now, log it.
  console.log(`[SMS Verification] ${phone}: ${code}`);
}

export async function registerWithPhone(
  phone: string,
  code: string,
  password?: string,
  name?: string,
) {
  const key = `verify:phone:${phone}`;
  const isValid = await verifyCode(key, code);
  if (!isValid) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '验证码无效或已过期',
    });
  }

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    throw new TRPCError({
      code: 'CONFLICT',
      message: '该手机号已被注册',
    });
  }

  const data: {
    phone: string;
    isPhoneVerified: boolean;
    passwordHash?: string;
    name?: string;
  } = {
    phone,
    isPhoneVerified: true,
  };

  if (password) {
    data.passwordHash = await hashPassword(password);
  }
  if (name) {
    data.name = name;
  }

  const user = await prisma.user.create({ data });

  return { id: user.id, phone: user.phone, name: user.name, role: user.role };
}

// ==================== Password Reset ====================

export async function sendPasswordResetCode(
  identifier: string,
  type: 'email' | 'phone',
): Promise<void> {
  const where = type === 'email' ? { email: identifier } : { phone: identifier };
  const user = await prisma.user.findUnique({ where });

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: '未找到该账户',
    });
  }

  const code = generateVerificationCode();
  const key = `reset:${type}:${identifier}`;
  await storeVerificationCode(key, code);

  if (type === 'email') {
    console.log(`[Password Reset Email] ${identifier}: ${code}`);
  } else {
    console.log(`[Password Reset SMS] ${identifier}: ${code}`);
  }
}

export async function resetPassword(
  identifier: string,
  type: 'email' | 'phone',
  code: string,
  newPassword: string,
) {
  const key = `reset:${type}:${identifier}`;
  const isValid = await verifyCode(key, code);
  if (!isValid) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: '验证码无效或已过期',
    });
  }

  const where = type === 'email' ? { email: identifier } : { phone: identifier };
  const user = await prisma.user.findUnique({ where });

  if (!user) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: '未找到该账户',
    });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  // Clear any Redis lock/attempts
  await redis.del(LOGIN_ATTEMPTS_KEY(user.id));
  await redis.del(LOGIN_LOCK_KEY(user.id));

  return { success: true };
}

// ==================== Account Lock (Redis-based) ====================

export async function checkAccountLock(userId: string): Promise<{
  isLocked: boolean;
  remainingSeconds: number;
}> {
  const ttl = await redis.ttl(LOGIN_LOCK_KEY(userId));
  if (ttl > 0) {
    return { isLocked: true, remainingSeconds: ttl };
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export async function recordFailedLogin(userId: string): Promise<{
  attempts: number;
  isLocked: boolean;
}> {
  const attemptsKey = LOGIN_ATTEMPTS_KEY(userId);
  const lockKey = LOGIN_LOCK_KEY(userId);

  // Increment attempts with TTL
  const attempts = await redis.incr(attemptsKey);
  if (attempts === 1) {
    // Set TTL on first failure
    await redis.expire(attemptsKey, LOCK_DURATION_SECONDS);
  }

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    // Lock the account
    await redis.set(lockKey, '1', 'EX', LOCK_DURATION_SECONDS);

    // Also update the DB for the credentials provider check
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: new Date(Date.now() + LOCK_DURATION_SECONDS * 1000),
      },
    });

    return { attempts, isLocked: true };
  }

  // Update DB attempts count
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: attempts },
  });

  return { attempts, isLocked: false };
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await redis.del(LOGIN_ATTEMPTS_KEY(userId));
  await redis.del(LOGIN_LOCK_KEY(userId));

  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
