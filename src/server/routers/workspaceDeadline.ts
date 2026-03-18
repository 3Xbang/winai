import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { notificationService } from '../services/workspace/notificationService';
import { prisma } from '@/lib/prisma';
import { DeadlineType } from '@prisma/client';

export const workspaceDeadlineRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        deadlineType: z.nativeEnum(DeadlineType),
        title: z.string().min(1),
        dueDate: z.string().datetime(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.deadline.create({
        data: {
          caseId: input.caseId,
          deadlineType: input.deadlineType,
          title: input.title,
          dueDate: new Date(input.dueDate),
        },
      });
    }),

  list: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.deadline.findMany({
        where: { caseId: input.caseId },
        orderBy: { dueDate: 'asc' },
      });
    }),

  markHandled: protectedProcedure
    .input(z.object({ deadlineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const deadline = await prisma.deadline.findFirst({
        where: { id: input.deadlineId, case: { workspaceId: ws.id } },
      });
      if (!deadline) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.deadline.update({
        where: { id: input.deadlineId },
        data: { isHandled: true, handledAt: new Date() },
      });
    }),

  /**
   * 获取即将到期的期限（仪表盘用）
   */
  getUpcoming: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(30).default(7) }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const cutoff = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);

      return prisma.deadline.findMany({
        where: {
          isHandled: false,
          dueDate: { lte: cutoff },
          case: { workspaceId: ws.id },
        },
        include: { case: { select: { title: true, caseNumber: true } } },
        orderBy: { dueDate: 'asc' },
        take: 20,
      });
    }),
});

export const workspaceNotificationRouter = createTRPCRouter({
  getUnread: protectedProcedure.query(async ({ ctx }) => {
    return notificationService.getUnread(ctx.userId);
  }),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return notificationService.markRead(input.notificationId, ctx.userId);
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return notificationService.markAllRead(ctx.userId);
  }),
});
