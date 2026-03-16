import { z } from 'zod';
import { createTRPCRouter, paidProcedure } from '@/server/trpc';
import { getReportGenerator } from '@/server/services/report/generator';

const analysisResultSchema = z.object({
  jurisdiction: z.enum(['CHINA', 'THAILAND', 'DUAL']),
  query: z.string().min(1),
  iracAnalysis: z.string().optional(),
  caseAnalysis: z.string().optional(),
  contractReview: z.string().optional(),
  evidenceAssessment: z.string().optional(),
  complianceAnnotation: z.string().optional(),
});

export const reportRouter = createTRPCRouter({
  generate: paidProcedure
    .input(
      z.object({
        analysisResult: analysisResultSchema,
        format: z.enum(['STANDARD', 'DETAILED', 'EXECUTIVE']).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const generator = getReportGenerator();
      const report = await generator.generate(input.analysisResult, input.format);
      return report;
    }),

  exportPDF: paidProcedure
    .input(z.object({ report: z.any() }))
    .mutation(async ({ input }) => {
      const generator = getReportGenerator();
      const buffer = await generator.exportPDF(input.report);
      return { pdf: buffer.toString('base64') };
    }),
});
