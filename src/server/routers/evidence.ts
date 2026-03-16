import { z } from 'zod';
import { createTRPCRouter, paidProcedure } from '@/server/trpc';
import { getEvidenceOrganizer } from '@/server/services/legal/evidence';

const legalIssueSchema = z.object({
  issue: z.string().min(1),
  legalBasis: z.array(
    z.object({
      lawName: z.string(),
      articleNumber: z.string().optional(),
      description: z.string(),
    }),
  ),
  analysis: z.string(),
});

const evidenceItemSchema = z.object({
  description: z.string().min(1),
  type: z.enum(['DOCUMENTARY', 'PHYSICAL', 'TESTIMONY', 'ELECTRONIC', 'EXPERT_OPINION']),
  strength: z.enum(['STRONG', 'MEDIUM', 'WEAK']),
  strengthReason: z.string(),
  legalityRisk: z.string().optional(),
  alternativeCollection: z.string().optional(),
});

export const evidenceRouter = createTRPCRouter({
  generateChecklist: paidProcedure
    .input(z.object({ issues: z.array(legalIssueSchema).min(1) }))
    .mutation(async ({ input }) => {
      const organizer = getEvidenceOrganizer();
      const checklist = await organizer.generateChecklist(input.issues);
      return { checklist };
    }),

  assessStrength: paidProcedure
    .input(z.object({ evidence: z.array(evidenceItemSchema).min(1) }))
    .mutation(async ({ input }) => {
      const organizer = getEvidenceOrganizer();
      const assessment = await organizer.assessStrength(input.evidence);
      return assessment;
    }),

  identifyGaps: paidProcedure
    .input(
      z.object({
        evidence: z.array(evidenceItemSchema).min(1),
        issues: z.array(legalIssueSchema).min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const organizer = getEvidenceOrganizer();
      const gaps = await organizer.identifyGaps(input.evidence, input.issues);
      return { gaps };
    }),
});
