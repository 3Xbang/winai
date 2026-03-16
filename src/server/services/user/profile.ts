import { TRPCError } from '@trpc/server';
import prisma from '@/lib/prisma';

/**
 * Get user profile by userId.
 */
export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
  }

  return user;
}

/**
 * Update user profile (name, phone, avatar).
 */
export async function updateProfile(
  userId: string,
  data: { name?: string; phone?: string; avatar?: string },
) {
  // If phone is being updated, check uniqueness
  if (data.phone) {
    const existing = await prisma.user.findUnique({
      where: { phone: data.phone },
    });
    if (existing && existing.id !== userId) {
      throw new TRPCError({ code: 'CONFLICT', message: '该手机号已被其他用户使用' });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.avatar !== undefined && { avatar: data.avatar }),
    },
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

  return user;
}

/**
 * Get enterprise info for a user.
 */
export async function getEnterprise(userId: string) {
  const enterprise = await prisma.enterprise.findUnique({
    where: { userId },
  });

  return enterprise;
}

/**
 * Create or update enterprise info for a user.
 */
export async function upsertEnterprise(
  userId: string,
  data: { companyName: string; businessLicense?: string; contactAddress?: string },
) {
  const enterprise = await prisma.enterprise.upsert({
    where: { userId },
    create: {
      userId,
      companyName: data.companyName,
      businessLicense: data.businessLicense ?? null,
      contactAddress: data.contactAddress ?? null,
    },
    update: {
      companyName: data.companyName,
      ...(data.businessLicense !== undefined && { businessLicense: data.businessLicense }),
      ...(data.contactAddress !== undefined && { contactAddress: data.contactAddress }),
    },
  });

  return enterprise;
}
