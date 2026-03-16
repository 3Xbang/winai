import { z } from 'zod';
import { createTRPCRouter, paidProcedure } from '@/server/trpc';
import { getCaseAnalyzer } from '@/server/services/legal/case-analyzer';

const casePartySchema = z.object({
  name: z.string().min(1),
  role: z.enum(['PLAINTIFF', 'DEFENDANT', 'THIRD_PARTY', 'OTHER']),
  description: z.string().optional(),
});

const caseSubmissionSchema = z.object({
  description: z.string().min(1, '案件描述不能为空').max(20000),
  parties: z.array(casePartySchema).min(1),
  keyFacts: z.array(z.string()).min(1),
  jurisdiction: z.enum(['CHINA', 'THAILAND', 'DUAL']),
  caseType: z.enum(['CIVIL', 'CRIMINAL', 'ADMINISTRATIVE', 'OTHER']).optional(),
  context: z.string().max(5000).optional(),
});

export const caseRouter = createTRPCRouter({
  analyze: paidProcedure
    .input(caseSubmissionSchema)
    .mutation(async ({ input }) => {
      const analyzer = getCaseAnalyzer();
      const result = await analyzer.analyze(input);
      return result;
    }),

  generateStrategy: paidProcedure
    .input(
      z.object({
        analysis: z.any(), // CaseAnalysisResult — complex nested type, validated at service layer
      }),
    )
    .mutation(async ({ input }) => {
      const analyzer = getCaseAnalyzer();
      const strategy = await analyzer.generateStrategy(input.analysis);
      return strategy;
    }),
});
