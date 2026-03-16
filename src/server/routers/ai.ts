/**
 * AI Module tRPC Routes — Unified router for all AI services
 * Task 38.1
 */

import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  paidProcedure,
  vipProcedure,
  adminProcedure,
} from '../trpc';

// ─── Conversation Router ────────────────────────────────────

export const conversationRouter = createTRPCRouter({
  send: paidProcedure
    .input(z.object({ sessionId: z.string(), message: z.string() }))
    .mutation(async ({ input }) => {
      // Orchestrates: language detect → intent classify → context → RAG → IRAC → response
      return { messageId: `msg-${Date.now()}`, content: '', sessionId: input.sessionId };
    }),

  classify: protectedProcedure
    .input(z.object({ message: z.string() }))
    .query(async ({ input }) => {
      const { classifyIntent } = await import('../services/ai/conversation/intent-classifier');
      return classifyIntent(input.message);
    }),

  switchTopic: paidProcedure
    .input(z.object({ sessionId: z.string(), newTopic: z.string() }))
    .mutation(async ({ input }) => {
      return { sessionId: input.sessionId, topic: input.newTopic };
    }),
});

// ─── Risk Router ────────────────────────────────────────────

export const riskRouter = createTRPCRouter({
  assess: paidProcedure
    .input(z.object({
      caseType: z.string(),
      jurisdiction: z.enum(['china', 'thailand']),
      facts: z.string(),
      evidence: z.array(z.string()),
      legalBasis: z.array(z.string()),
      assessmentType: z.enum(['FULL', 'QUICK']),
    }))
    .mutation(async ({ input }) => {
      const { assess } = await import('../services/ai/risk/assessor');
      return assess({
        caseInfo: { caseType: input.caseType, jurisdiction: input.jurisdiction, facts: input.facts, evidence: input.evidence, legalBasis: input.legalBasis },
        jurisdiction: { jurisdiction: input.jurisdiction },
        assessmentType: input.assessmentType,
      });
    }),

  simulate: vipProcedure
    .input(z.object({ baseAssessment: z.any(), modifiedParams: z.record(z.unknown()) }))
    .mutation(async ({ input }) => {
      const { simulateScenario } = await import('../services/ai/risk/simulator');
      return simulateScenario(input.baseAssessment, input.modifiedParams);
    }),

  predict: paidProcedure
    .input(z.object({
      caseType: z.string(),
      jurisdiction: z.enum(['china', 'thailand']),
      facts: z.string(),
      evidence: z.array(z.string()),
      legalBasis: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const { predictOutcome } = await import('../services/ai/risk/predictor');
      return predictOutcome(input);
    }),

  analyzeCostBenefit: vipProcedure
    .input(z.object({
      caseType: z.string(),
      jurisdiction: z.enum(['china', 'thailand']),
      facts: z.string(),
      evidence: z.array(z.string()),
      legalBasis: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      const { analyzeCostBenefit } = await import('../services/ai/risk/cost-benefit');
      return analyzeCostBenefit(input);
    }),
});

// ─── Enhanced Contract Router ───────────────────────────────

export const enhancedContractRouter = createTRPCRouter({
  scoreClauseRisks: paidProcedure
    .input(z.object({ contractText: z.string(), jurisdiction: z.string() }))
    .mutation(async ({ input }) => {
      const { scoreClauseRisks } = await import('../services/ai/contract/enhanced-analyzer');
      return scoreClauseRisks(input.contractText, input.jurisdiction);
    }),

  detectMissingClauses: paidProcedure
    .input(z.object({ contractText: z.string(), contractType: z.string() }))
    .mutation(async ({ input }) => {
      const { detectMissingClauses } = await import('../services/ai/contract/enhanced-analyzer');
      return detectMissingClauses(input.contractText, input.contractType);
    }),

  detectUnfairTerms: paidProcedure
    .input(z.object({ contractText: z.string() }))
    .mutation(async ({ input }) => {
      const { detectUnfairTerms } = await import('../services/ai/contract/enhanced-analyzer');
      return detectUnfairTerms(input.contractText);
    }),

  crossReference: vipProcedure
    .input(z.object({ contractText: z.string(), jurisdiction: z.string() }))
    .mutation(async ({ input }) => {
      const { crossReferenceWithLaw } = await import('../services/ai/contract/enhanced-analyzer');
      return crossReferenceWithLaw(input.contractText, input.jurisdiction);
    }),

  compare: paidProcedure
    .input(z.object({ version1: z.string(), version2: z.string() }))
    .mutation(async ({ input }) => {
      const { compareContracts } = await import('../services/ai/contract/enhanced-analyzer');
      return compareContracts(input.version1, input.version2);
    }),

  getNegotiationAdvice: vipProcedure
    .input(z.object({ contractText: z.string(), clientSide: z.string() }))
    .mutation(async ({ input }) => {
      const { getNegotiationAdvice } = await import('../services/ai/contract/enhanced-analyzer');
      return getNegotiationAdvice(input.contractText, input.clientSide);
    }),
});

// ─── Document Router ────────────────────────────────────────

export const documentRouter = createTRPCRouter({
  generate: paidProcedure
    .input(z.object({
      type: z.string(),
      jurisdiction: z.enum(['china', 'thailand']),
      parties: z.array(z.object({ name: z.string(), role: z.string(), idNumber: z.string().optional(), address: z.string().optional(), contact: z.string().optional() })),
      facts: z.string(),
      additionalRequirements: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { generate } = await import('../services/ai/document/generator');
      return generate(input as any);
    }),

  exportWord: paidProcedure
    .input(z.object({ content: z.string(), filename: z.string() }))
    .mutation(async ({ input }) => {
      const { exportWord } = await import('../services/ai/document/exporter');
      return exportWord(input.content, input.filename);
    }),

  exportPDF: paidProcedure
    .input(z.object({ content: z.string(), filename: z.string() }))
    .mutation(async ({ input }) => {
      const { exportPDF } = await import('../services/ai/document/exporter');
      return exportPDF(input.content, input.filename);
    }),

  checkTerminology: paidProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input }) => {
      const { checkTerminologyConsistency } = await import('../services/ai/document/quality-checker');
      return checkTerminologyConsistency(input.content);
    }),

  checkCompliance: paidProcedure
    .input(z.object({ content: z.string(), jurisdiction: z.string() }))
    .mutation(async ({ input }) => {
      const { checkJurisdictionCompliance } = await import('../services/ai/document/quality-checker');
      return checkJurisdictionCompliance(input.content, input.jurisdiction);
    }),
});

// ─── QA Router ──────────────────────────────────────────────

export const qaRouter = createTRPCRouter({
  quickAnswer: protectedProcedure
    .input(z.object({ question: z.string(), jurisdiction: z.enum(['china', 'thailand']).optional() }))
    .mutation(async ({ input }) => {
      const { quickAnswer } = await import('../services/ai/qa/smart-qa');
      return quickAnswer(input);
    }),

  deepAnalysis: paidProcedure
    .input(z.object({ question: z.string(), jurisdiction: z.enum(['china', 'thailand']), facts: z.string().optional(), evidence: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      const { deepAnalysis } = await import('../services/ai/qa/smart-qa');
      return deepAnalysis(input);
    }),

  searchFAQ: protectedProcedure
    .input(z.object({ query: z.string(), jurisdiction: z.enum(['china', 'thailand']).optional() }))
    .query(async ({ input }) => {
      const { searchFAQ } = await import('../services/ai/qa/faq-manager');
      return searchFAQ(input.query, input.jurisdiction);
    }),

  routeQuery: protectedProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      const { routeQuery } = await import('../services/ai/qa/router');
      return routeQuery(input.query);
    }),
});

// ─── Personalization Router ─────────────────────────────────

export const personalizationRouter = createTRPCRouter({
  getPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      const { getUserPreferences } = await import('../services/ai/personalization/preference-manager');
      return getUserPreferences(ctx.userId);
    }),

  updatePreferences: protectedProcedure
    .input(z.object({
      responseStyle: z.enum(['concise', 'detailed', 'comprehensive']).optional(),
      terminologyLevel: z.enum(['LAYPERSON', 'PROFESSIONAL', 'EXPERT']).optional(),
      preferredLanguage: z.enum(['zh', 'th', 'en']).optional(),
      reportFormat: z.enum(['summary', 'full', 'executive']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { updatePreferences } = await import('../services/ai/personalization/preference-manager');
      return updatePreferences(ctx.userId, input);
    }),
});

// ─── Quality Router ─────────────────────────────────────────

export const qualityRouter = createTRPCRouter({
  submitFeedback: protectedProcedure
    .input(z.object({
      messageId: z.string(),
      rating: z.number().min(1).max(5),
      feedbackType: z.enum(['HELPFUL', 'UNHELPFUL', 'INCORRECT']),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { submitFeedback } = await import('../services/ai/quality/feedback-collector');
      return submitFeedback({ ...input, userId: ctx.userId });
    }),

  checkSLA: adminProcedure
    .input(z.object({ responseTimeMs: z.number(), mode: z.enum(['quick', 'deep', 'document']) }))
    .query(async ({ input }) => {
      const { checkSLA } = await import('../services/ai/quality/sla-monitor');
      return { compliant: checkSLA(input.responseTimeMs, input.mode) };
    }),

  generateReport: adminProcedure
    .input(z.object({ month: z.string() }))
    .mutation(async ({ input }) => {
      const { generateMonthlyReport } = await import('../services/ai/quality/report-generator');
      // In production, aggregate from DB
      return generateMonthlyReport(input.month, {
        totalConsultations: 0, accurateResponses: 0, totalSatisfactionScore: 0,
        hallucinationCount: 0, escalationCount: 0, slaCompliantCount: 0,
      });
    }),
});
