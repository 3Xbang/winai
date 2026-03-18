import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { LawyerPlanTier, WorkspaceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Middleware：要求工作空间处于 ACTIVE 状态
 * 订阅到期（READONLY）时写操作抛出 WORKSPACE_READONLY
 */
export function requireActiveWorkspace(ws: { status: WorkspaceStatus }) {
  if (ws.status === WorkspaceStatus.READONLY) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'WORKSPACE_READONLY',
    });
  }
  if (ws.status === WorkspaceStatus.SUSPENDED) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'WORKSPACE_SUSPENDED',
    });
  }
}

export const workspaceRouter = createTRPCRouter({
  /**
   * 初始化工作空间（律师注册后调用）
   */
  initWorkspace: protectedProcedure
    .input(
      z.object({
        planTier: z.nativeEnum(LawyerPlanTier).optional().default(LawyerPlanTier.BASIC),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return workspaceService.initWorkspace(ctx.userId, input.planTier);
    }),

  /**
   * 获取存储用量
   */
  getStorageUsage: protectedProcedure.query(async ({ ctx }) => {
    return workspaceService.getStorageUsage(ctx.userId);
  }),

  /**
   * 获取工作空间信息
   */
  getWorkspace: protectedProcedure.query(async ({ ctx }) => {
    return workspaceService.getWorkspace(ctx.userId);
  }),

  /**
   * 购买存储扩充包
   */
  purchaseStorageAddOn: protectedProcedure
    .input(z.object({ addedGB: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      requireActiveWorkspace(ws);

      // 确保有订阅记录
      let sub = await prisma.lawyerSubscription.findUnique({
        where: { workspaceId: ws.id },
      });

      if (!sub) {
        sub = await prisma.lawyerSubscription.create({
          data: {
            workspaceId: ws.id,
            planTier: ws.planTier,
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        });
      }

      await prisma.$transaction([
        prisma.storageAddOn.create({
          data: { subscriptionId: sub.id, addedGB: input.addedGB },
        }),
        prisma.lawyerWorkspace.update({
          where: { id: ws.id },
          data: { storageAddOnGB: { increment: input.addedGB } },
        }),
      ]);

      return workspaceService.getStorageUsage(ctx.userId);
    }),
});
