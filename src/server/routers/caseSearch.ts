import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { getCaseSearchEngine } from '@/server/services/legal/case-search';

export const caseSearchRouter = createTRPCRouter({
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1, '搜索内容不能为空').max(5000),
        jurisdiction: z.enum(['CHINA', 'THAILAND', 'DUAL']).optional(),
        caseType: z.string().optional(),
        dateRange: z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    )
    .query(async ({ input }) => {
      const engine = getCaseSearchEngine();
      const result = await engine.search(input);
      return result;
    }),

  analyzeTrends: protectedProcedure
    .input(
      z.object({
        cases: z.array(
          z.object({
            caseId: z.string(),
            jurisdiction: z.enum(['CHINA', 'THAILAND']),
            summary: z.string(),
            verdict: z.string(),
            keyReasoning: z.string(),
            relevanceScore: z.number(),
          }),
        ).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const engine = getCaseSearchEngine();
      const trends = await engine.analyzeTrends(input.cases);
      return trends;
    }),
});
