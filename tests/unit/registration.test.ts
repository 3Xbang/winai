import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

// Mock redis
vi.mock('@/lib/redis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
  };
  return { default: mockRedis, redis: mockRedis };
});

// Mock auth-helpers
vi.mock('@/lib/auth-helpers', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  verifyPassword: vi.fn(),
  generateVerificationCode: vi.fn().mockReturnValue('123456'),
  storeVerificationCode: vi.fn().mockResolvedValue(undefined),
  verifyCode: vi.fn(),
}));

import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import { verifyCode } from '@/lib/auth-helpers';
import {
  sendEmailVerificationCode,
  registerWithEmail,
  sendPhoneVerificationCode,
  registerWithPhone,
  sendPasswordResetCode,
  resetPassword,
  checkAccountLock,
  recordFailedLogin,
  clearFailedLogins,
} from '@/server/services/auth/registration';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockRedis = redis as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  ttl: ReturnType<typeof vi.fn>;
};

const mockVerifyCode = verifyCode as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Email Registration', () => {
  describe('sendEmailVerificationCode', () => {
    it('should send code when email is not registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await sendEmailVerificationCode('test@example.com');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should throw CONFLICT when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'test@example.com' });

      await expect(sendEmailVerificationCode('test@example.com')).rejects.toThrow(
        '该邮箱已被注册',
      );
    });
  });

  describe('registerWithEmail', () => {
    it('should create user with verified email', async () => {
      mockVerifyCode.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user1',
        email: 'new@example.com',
        name: 'Test',
        role: 'FREE_USER',
      });

      const result = await registerWithEmail('new@example.com', '123456', 'Password1!', 'Test');

      expect(result).toEqual({
        id: 'user1',
        email: 'new@example.com',
        name: 'Test',
        role: 'FREE_USER',
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'new@example.com',
          passwordHash: 'hashed_password',
          name: 'Test',
          isEmailVerified: true,
        },
      });
    });

    it('should throw when verification code is invalid', async () => {
      mockVerifyCode.mockResolvedValue(false);

      await expect(
        registerWithEmail('new@example.com', '000000', 'Password1!'),
      ).rejects.toThrow('验证码无效或已过期');
    });

    it('should throw CONFLICT on race condition duplicate email', async () => {
      mockVerifyCode.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });

      await expect(
        registerWithEmail('dup@example.com', '123456', 'Password1!'),
      ).rejects.toThrow('该邮箱已被注册');
    });
  });
});

describe('Phone Registration', () => {
  describe('sendPhoneVerificationCode', () => {
    it('should send code when phone is not registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await sendPhoneVerificationCode('+8613800138000');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+8613800138000' },
      });
    });

    it('should throw CONFLICT when phone already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1' });

      await expect(sendPhoneVerificationCode('+8613800138000')).rejects.toThrow(
        '该手机号已被注册',
      );
    });
  });

  describe('registerWithPhone', () => {
    it('should create user with verified phone', async () => {
      mockVerifyCode.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user2',
        phone: '+8613800138000',
        name: null,
        role: 'FREE_USER',
      });

      const result = await registerWithPhone('+8613800138000', '123456');

      expect(result).toEqual({
        id: 'user2',
        phone: '+8613800138000',
        name: null,
        role: 'FREE_USER',
      });
    });

    it('should throw when verification code is invalid', async () => {
      mockVerifyCode.mockResolvedValue(false);

      await expect(
        registerWithPhone('+8613800138000', '000000'),
      ).rejects.toThrow('验证码无效或已过期');
    });
  });
});

describe('Password Reset', () => {
  describe('sendPasswordResetCode', () => {
    it('should send reset code via email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: 'user@example.com' });

      await sendPasswordResetCode('user@example.com', 'email');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('should send reset code via phone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', phone: '+8613800138000' });

      await sendPasswordResetCode('+8613800138000', 'phone');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '+8613800138000' },
      });
    });

    it('should throw NOT_FOUND when account does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        sendPasswordResetCode('nobody@example.com', 'email'),
      ).rejects.toThrow('未找到该账户');
    });
  });

  describe('resetPassword', () => {
    it('should reset password and clear lock state', async () => {
      mockVerifyCode.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user1' });
      mockPrisma.user.update.mockResolvedValue({});
      mockRedis.del.mockResolvedValue(1);

      const result = await resetPassword('user@example.com', 'email', '123456', 'NewPass1!');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          passwordHash: 'hashed_password',
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      // Should clear Redis keys
      expect(mockRedis.del).toHaveBeenCalledWith('login:attempts:user1');
      expect(mockRedis.del).toHaveBeenCalledWith('login:lock:user1');
    });

    it('should throw when reset code is invalid', async () => {
      mockVerifyCode.mockResolvedValue(false);

      await expect(
        resetPassword('user@example.com', 'email', '000000', 'NewPass1!'),
      ).rejects.toThrow('验证码无效或已过期');
    });
  });
});

describe('Account Lock (Redis-based)', () => {
  describe('checkAccountLock', () => {
    it('should return locked when Redis lock key exists', async () => {
      mockRedis.ttl.mockResolvedValue(1500);

      const result = await checkAccountLock('user1');

      expect(result).toEqual({ isLocked: true, remainingSeconds: 1500 });
      expect(mockRedis.ttl).toHaveBeenCalledWith('login:lock:user1');
    });

    it('should return not locked when no lock key', async () => {
      mockRedis.ttl.mockResolvedValue(-2);

      const result = await checkAccountLock('user1');

      expect(result).toEqual({ isLocked: false, remainingSeconds: 0 });
    });
  });

  describe('recordFailedLogin', () => {
    it('should increment attempts and set TTL on first failure', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
      mockPrisma.user.update.mockResolvedValue({});

      const result = await recordFailedLogin('user1');

      expect(result).toEqual({ attempts: 1, isLocked: false });
      expect(mockRedis.incr).toHaveBeenCalledWith('login:attempts:user1');
      expect(mockRedis.expire).toHaveBeenCalledWith('login:attempts:user1', 1800);
    });

    it('should lock account after 5 failed attempts', async () => {
      mockRedis.incr.mockResolvedValue(5);
      mockRedis.set.mockResolvedValue('OK');
      mockPrisma.user.update.mockResolvedValue({});

      const result = await recordFailedLogin('user1');

      expect(result).toEqual({ attempts: 5, isLocked: true });
      expect(mockRedis.set).toHaveBeenCalledWith('login:lock:user1', '1', 'EX', 1800);
    });

    it('should not set TTL on subsequent failures', async () => {
      mockRedis.incr.mockResolvedValue(3);
      mockPrisma.user.update.mockResolvedValue({});

      await recordFailedLogin('user1');

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('clearFailedLogins', () => {
    it('should clear Redis keys and reset DB', async () => {
      mockRedis.del.mockResolvedValue(1);
      mockPrisma.user.update.mockResolvedValue({});

      await clearFailedLogins('user1');

      expect(mockRedis.del).toHaveBeenCalledWith('login:attempts:user1');
      expect(mockRedis.del).toHaveBeenCalledWith('login:lock:user1');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    });
  });
});
