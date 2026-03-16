import { z } from 'zod';
import { createTRPCRouter, paidProcedure } from '@/server/trpc';
import { getContractAnalyzer } from '@/server/services/legal/contract';

const partySchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  nationality: z.string().optional(),
  idNumber: z.string().optional(),
  address: z.string().optional(),
});

const jurisdictionResultSchema = z.object({
  jurisdiction: z.enum(['CHINA', 'THAILAND', 'DUAL']),
  confidence: z.number().min(0).max(1),
  chinaLaws: z
    .array(z.object({ lawName: z.string(), articleNumber: z.string().optional(), description: z.string() }))
    .optional(),
  thailandLaws: z
    .array(z.object({ lawName: z.string(), articleNumber: z.string().optional(), description: z.string() }))
    .optional(),
  needsMoreInfo: z.array(z.string()).optional(),
});

export const contractRouter = createTRPCRouter({
  draft: paidProcedure
    .input(
      z.object({
        contractType: z.enum(['LEASE', 'SALE', 'PARTNERSHIP', 'EMPLOYMENT', 'SERVICE', 'OTHER']),
        parties: z.array(partySchema).min(1),
        keyTerms: z.record(z.string(), z.string()),
        languages: z.array(z.enum(['zh', 'en', 'th'])).min(1),
        jurisdiction: jurisdictionResultSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const analyzer = getContractAnalyzer();
      const draft = await analyzer.draft(input);
      return { draft };
    }),

  review: paidProcedure
    .input(
      z.object({
        contractText: z.string().min(1, '合同文本不能为空').max(50000),
        jurisdiction: jurisdictionResultSchema,
      }),
    )
    .mutation(async ({ input }) => {
      const analyzer = getContractAnalyzer();
      const result = await analyzer.review(input.contractText, input.jurisdiction);
      return result;
    }),
});
