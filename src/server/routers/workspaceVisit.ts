import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { aiService } from '../services/workspace/aiService';
import { prisma } from '@/lib/prisma';

export const workspaceVisitRouter = createTRPCRouter({
  /**
   * 生成会见前摘要（AI 辅助）
   */
  generateSummary: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      const summary = await aiService.generateVisitSummary(input.caseId, ctx.userId);
      return { summary };
    }),

  /**
   * 保存会见记录
   */
  saveRecord: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        visitedAt: z.string().datetime(),
        summary: z.string().optional(),
        outcome: z.string().min(1),
        nextSteps: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      const record = await prisma.visitRecord.create({
        data: {
          caseId: input.caseId,
          lawyerId: ctx.userId,
          visitedAt: new Date(input.visitedAt),
          summary: input.summary,
          outcome: input.outcome,
          nextSteps: input.nextSteps,
        },
      });

      // 追加时间线
      await prisma.caseTimelineEvent.create({
        data: {
          caseId: input.caseId,
          eventType: 'VISIT_RECORDED',
          description: `会见记录：${input.outcome.slice(0, 50)}${input.outcome.length > 50 ? '...' : ''}`,
          operatorId: ctx.userId,
        },
      });

      return record;
    }),

  /**
   * 获取会见记录列表
   */
  listRecords: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.visitRecord.findMany({
        where: { caseId: input.caseId },
        orderBy: { visitedAt: 'desc' },
      });
    }),
});
