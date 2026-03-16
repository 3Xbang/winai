import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock prisma
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    enterprise: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

import prisma from '@/lib/prisma';
import {
  getProfile,
  updateProfile,
  getEnterprise,
  upsertEnterprise,
} from '@/server/services/user/profile';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  enterprise: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getProfile', () => {
  it('should return user profile when user exists', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      phone: '+8613800138000',
      name: 'Test User',
      avatar: null,
      role: 'FREE_USER',
      locale: 'zh',
      createdAt: new Date('2024-01-01'),
    };
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);

    const result = await getProfile('user-1');

    expect(result).toEqual(mockUser);
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        avatar: true,
        role: true,
        locale: true,
        createdAt: true,
      },
    });
  });

  it('should throw NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(getProfile('nonexistent')).rejects.toThrow(TRPCError);
    await expect(getProfile('nonexistent')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('updateProfile', () => {
  const baseUser = {
    id: 'user-1',
    email: 'test@example.com',
    phone: '+8613800138000',
    name: 'Updated Name',
    avatar: null,
    role: 'FREE_USER',
    locale: 'zh',
    createdAt: new Date('2024-01-01'),
  };

  it('should update name only', async () => {
    mockPrisma.user.update.mockResolvedValue({ ...baseUser, name: 'New Name' });

    const result = await updateProfile('user-1', { name: 'New Name' });

    expect(result.name).toBe('New Name');
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'New Name' },
      select: expect.any(Object),
    });
  });

  it('should update avatar', async () => {
    mockPrisma.user.update.mockResolvedValue({
      ...baseUser,
      avatar: 'https://example.com/avatar.png',
    });

    const result = await updateProfile('user-1', {
      avatar: 'https://example.com/avatar.png',
    });

    expect(result.avatar).toBe('https://example.com/avatar.png');
  });

  it('should check phone uniqueness before updating', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user' });

    await expect(
      updateProfile('user-1', { phone: '+8613900139000' }),
    ).rejects.toThrow('该手机号已被其他用户使用');
  });

  it('should allow updating to own phone number', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.user.update.mockResolvedValue(baseUser);

    const result = await updateProfile('user-1', { phone: '+8613800138000' });

    expect(result).toEqual(baseUser);
  });

  it('should allow updating phone when no conflict', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.update.mockResolvedValue({
      ...baseUser,
      phone: '+8613900139000',
    });

    const result = await updateProfile('user-1', { phone: '+8613900139000' });

    expect(result.phone).toBe('+8613900139000');
  });
});

describe('getEnterprise', () => {
  it('should return enterprise info when it exists', async () => {
    const mockEnterprise = {
      id: 'ent-1',
      userId: 'user-1',
      companyName: 'Test Corp',
      businessLicense: 'BL-12345',
      contactAddress: '123 Main St',
    };
    mockPrisma.enterprise.findUnique.mockResolvedValue(mockEnterprise);

    const result = await getEnterprise('user-1');

    expect(result).toEqual(mockEnterprise);
    expect(mockPrisma.enterprise.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('should return null when no enterprise exists', async () => {
    mockPrisma.enterprise.findUnique.mockResolvedValue(null);

    const result = await getEnterprise('user-1');

    expect(result).toBeNull();
  });
});

describe('upsertEnterprise', () => {
  it('should create enterprise when it does not exist', async () => {
    const mockEnterprise = {
      id: 'ent-1',
      userId: 'user-1',
      companyName: 'New Corp',
      businessLicense: 'BL-99999',
      contactAddress: '456 Oak Ave',
    };
    mockPrisma.enterprise.upsert.mockResolvedValue(mockEnterprise);

    const result = await upsertEnterprise('user-1', {
      companyName: 'New Corp',
      businessLicense: 'BL-99999',
      contactAddress: '456 Oak Ave',
    });

    expect(result).toEqual(mockEnterprise);
    expect(mockPrisma.enterprise.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        companyName: 'New Corp',
        businessLicense: 'BL-99999',
        contactAddress: '456 Oak Ave',
      },
      update: {
        companyName: 'New Corp',
        businessLicense: 'BL-99999',
        contactAddress: '456 Oak Ave',
      },
    });
  });

  it('should update enterprise with only companyName', async () => {
    const mockEnterprise = {
      id: 'ent-1',
      userId: 'user-1',
      companyName: 'Updated Corp',
      businessLicense: null,
      contactAddress: null,
    };
    mockPrisma.enterprise.upsert.mockResolvedValue(mockEnterprise);

    const result = await upsertEnterprise('user-1', {
      companyName: 'Updated Corp',
    });

    expect(result.companyName).toBe('Updated Corp');
    expect(mockPrisma.enterprise.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        companyName: 'Updated Corp',
        businessLicense: null,
        contactAddress: null,
      },
      update: {
        companyName: 'Updated Corp',
      },
    });
  });
});
