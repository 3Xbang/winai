import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { prisma } from '@/lib/prisma';
import { FeeVisibility } from '@prisma/client';

export const workspaceFeeRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        description: z.string().min(1),
        hours: z.number().min(0),
        amount: z.number().min(0),
        currency: z.string().default('CNY'),
        workDate: z.string().datetime(),
        visibility: z.nativeEnum(FeeVisibility).default(FeeVisibility.INTERNAL_ONLY),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.feeRecord.create({
        data: {
          caseId: input.caseId,
          lawyerId: ctx.userId,
          description: input.description,
          hours: input.hours,
          amount: input.amount,
          currency: input.currency,
          workDate: new Date(input.workDate),
          visibility: input.visibility,
        },
      });
    }),

  list: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        clientView: z.boolean().default(false), // 客户视角只看 CLIENT_VISIBLE
      }),
    )
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      // 客户只能查看自己案件的费用
      const case_ = await prisma.case.findFirst({
        where: {
          id: input.caseId,
          OR: [
            { workspaceId: ws.id },
            { clientId: ctx.userId },
          ],
        },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      const isClient = case_.clientId === ctx.userId && case_.workspaceId !== ws.id;
      const visibilityFilter = isClient || input.clientView
        ? { visibility: FeeVisibility.CLIENT_VISIBLE }
        : {};

      return prisma.feeRecord.findMany({
        where: { caseId: input.caseId, ...visibilityFilter },
        orderBy: { workDate: 'desc' },
      });
    }),

  updateVisibility: protectedProcedure
    .input(
      z.object({
        feeId: z.string(),
        visibility: z.nativeEnum(FeeVisibility),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const fee = await prisma.feeRecord.findFirst({
        where: { id: input.feeId, case: { workspaceId: ws.id } },
      });
      if (!fee) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.feeRecord.update({
        where: { id: input.feeId },
        data: { visibility: input.visibility },
      });
    }),

  getSummary: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      const fees = await prisma.feeRecord.findMany({
        where: { caseId: input.caseId },
        select: { amount: true, hours: true, currency: true },
      });

      const totalAmount = fees.reduce((sum, f) => sum + Number(f.amount), 0);
      const totalHours = fees.reduce((sum, f) => sum + Number(f.hours), 0);

      return { totalAmount, totalHours, count: fees.length };
    }),
});
