import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import {
  save,
  search,
  exportPDF,
  bookmark,
  unbookmark,
  resume,
} from '@/server/services/session/manager';

const sessionMessageSchema = z.object({
  role: z.enum(['USER', 'ASSISTANT', 'SYSTEM']),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const sessionRouter = createTRPCRouter({
  save: protectedProcedure
    .input(
      z.object({
        id: z.string().optional(),
        title: z.string().max(200).optional(),
        legalDomain: z.string().optional(),
        jurisdiction: z.string().optional(),
        messages: z.array(sessionMessageSchema).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await save({ userId: ctx.userId, ...input });
      return { success: true };
    }),

  search: protectedProcedure
    .input(
      z.object({
        dateFrom: z.coerce.date().optional(),
        dateTo: z.coerce.date().optional(),
        keyword: z.string().optional(),
        legalDomain: z.string().optional(),
        bookmarkedOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return search(ctx.userId, input);
    }),

  exportPDF: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .mutation(async ({ input }) => {
      const buffer = await exportPDF(input.sessionId);
      return { pdf: buffer.toString('base64') };
    }),

  bookmark: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .mutation(async ({ ctx, input }) => {
      await bookmark(input.sessionId, ctx.userId);
      return { success: true };
    }),

  unbookmark: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .mutation(async ({ ctx, input }) => {
      await unbookmark(input.sessionId, ctx.userId);
      return { success: true };
    }),

  resume: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .query(async ({ input }) => {
      return resume(input.sessionId);
    }),
});
