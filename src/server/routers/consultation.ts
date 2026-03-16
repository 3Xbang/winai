import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import { getJurisdictionIdentifier } from '@/server/services/legal/jurisdiction';
import { getIRACEngine } from '@/server/services/legal/irac';

export const consultationRouter = createTRPCRouter({
  submit: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1, '咨询内容不能为空').max(10000),
        language: z.enum(['zh', 'th', 'en']).optional(),
        context: z.string().max(5000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const identifier = getJurisdictionIdentifier();
      const iracEngine = getIRACEngine();

      const request = {
        query: input.query,
        userId: ctx.userId,
        language: input.language,
        context: input.context,
      };

      const jurisdiction = await identifier.identify(request);
      const analysis = await iracEngine.analyze(request, jurisdiction);

      return { jurisdiction, analysis };
    }),

  getResult: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .query(async ({ ctx, input }) => {
      // Placeholder: retrieve analysis result by session ID
      return { sessionId: input.sessionId, userId: ctx.userId, result: null };
    }),
});
