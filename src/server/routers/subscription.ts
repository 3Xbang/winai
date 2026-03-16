import { z } from 'zod';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '@/server/trpc';
import {
  checkQuota,
  subscribe,
  cancelSubscription,
  startTrial,
} from '@/server/services/subscription/manager';
import prisma from '@/lib/prisma';

export const subscriptionRouter = createTRPCRouter({
  checkQuota: protectedProcedure.query(async ({ ctx }) => {
    return checkQuota(ctx.userId);
  }),

  subscribe: protectedProcedure
    .input(z.object({ planId: z.string().min(1, '计划ID不能为空') }))
    .mutation(async ({ ctx, input }) => {
      return subscribe(ctx.userId, input.planId);
    }),

  cancel: protectedProcedure.mutation(async ({ ctx }) => {
    await cancelSubscription(ctx.userId);
    return { success: true, message: '订阅已取消' };
  }),

  startTrial: protectedProcedure.mutation(async ({ ctx }) => {
    return startTrial(ctx.userId);
  }),

  plans: publicProcedure.query(async () => {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: [{ tier: 'asc' }, { period: 'asc' }],
    });
    return plans;
  }),
});
