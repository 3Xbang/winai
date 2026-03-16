import { z } from 'zod';
import { createTRPCRouter, adminProcedure } from '@/server/trpc';
import {
  sendRenewalNotifications,
  processExpiredSubscriptions,
} from '@/server/services/subscription/manager';
import prisma from '@/lib/prisma';

export const adminRouter = createTRPCRouter({
  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const { page, pageSize, search: searchTerm } = input;
      const where = searchTerm
        ? {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' as const } },
              { email: { contains: searchTerm, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return { users, total, page, pageSize };
    }),

  updateUserRole: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1, '用户ID不能为空'),
        role: z.enum(['FREE_USER', 'PAID_USER', 'VIP_MEMBER', 'ADMIN']),
      }),
    )
    .mutation(async ({ input }) => {
      const user = await prisma.user.update({
        where: { id: input.userId },
        data: { role: input.role },
        select: { id: true, name: true, role: true },
      });
      return user;
    }),

  processExpiredSubscriptions: adminProcedure.mutation(async () => {
    const downgraded = await processExpiredSubscriptions();
    return { downgradedUserIds: downgraded, count: downgraded.length };
  }),

  sendRenewalNotifications: adminProcedure.mutation(async () => {
    const notified = await sendRenewalNotifications();
    return { notifiedUserIds: notified, count: notified.length };
  }),
});
