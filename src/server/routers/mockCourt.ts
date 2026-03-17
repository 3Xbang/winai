import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import prisma from '@/lib/prisma';
import { MockCourtService } from '@/server/services/mock-court/service';
import { PerformanceEvaluator } from '@/server/services/mock-court/evaluator';
import { getLLMGateway } from '@/server/services/llm/gateway';

// ─── Lazy singleton instances ───────────────────────────────

let _service: MockCourtService | null = null;
function getService(): MockCourtService {
  if (!_service) _service = new MockCourtService();
  return _service;
}

let _evaluator: PerformanceEvaluator | null = null;
function getEvaluator(): PerformanceEvaluator {
  if (!_evaluator) _evaluator = new PerformanceEvaluator(getLLMGateway());
  return _evaluator;
}

// ─── Zod Input Schemas ─────────────────────────────────────

const createSessionInputSchema = z.object({
  caseType: z.enum([
    'CONTRACT_DISPUTE', 'TORT', 'LABOR_DISPUTE',
    'IP_DISPUTE', 'CROSS_BORDER_TRADE', 'OTHER',
  ]),
  caseDescription: z.string().min(50, '案情描述至少需要50个字符').max(5000, '案情描述不能超过5000个字符'),
  jurisdiction: z.enum(['CHINA', 'THAILAND', 'ARBITRATION']),
  userRole: z.enum(['PLAINTIFF_LAWYER', 'DEFENDANT_LAWYER']),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  supplementary: z.record(z.string(), z.unknown()).optional(),
  importedFromSessionId: z.string().optional(),
});

const submitEvidenceInputSchema = z.object({
  sessionId: z.string().min(1, '会话ID不能为空'),
  evidence: z.object({
    name: z.string().min(1, '证据名称不能为空'),
    evidenceType: z.enum(['DOCUMENTARY', 'PHYSICAL', 'TESTIMONY', 'EXPERT_OPINION', 'ELECTRONIC']),
    description: z.string().min(1, '证据描述不能为空'),
    proofPurpose: z.string().min(1, '证明目的不能为空'),
  }),
});

const raiseObjectionInputSchema = z.object({
  sessionId: z.string().min(1, '会话ID不能为空'),
  objection: z.object({
    objectionType: z.enum(['IRRELEVANT', 'HEARSAY', 'LEADING_QUESTION', 'NON_RESPONSIVE', 'OTHER']),
    reason: z.string().optional(),
  }),
});

// ─── Router ─────────────────────────────────────────────────

export const mockCourtRouter = createTRPCRouter({
  /**
   * Create a new mock court session.
   * Validates input, checks quota, and delegates to MockCourtService.
   * Requirements: 1.5, 12.1
   */
  create: protectedProcedure
    .input(createSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = getService();
      return service.createSession(ctx.userId, input);
    }),

  /**
   * Import case data from an existing case analysis session.
   * Returns partial case config for form pre-filling.
   * Requirements: 2.1, 2.3
   */
  importFromCaseAnalysis: protectedProcedure
    .input(z.object({ caseAnalysisSessionId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const session = await prisma.consultationSession.findUnique({
        where: { id: input.caseAnalysisSessionId },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '案件分析会话不存在' });
      }

      if (session.userId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问此案件分析会话' });
      }

      // Map consultation session fields to mock court case config
      const jurisdictionMap: Record<string, 'CHINA' | 'THAILAND' | 'ARBITRATION'> = {
        china: 'CHINA',
        thailand: 'THAILAND',
        arbitration: 'ARBITRATION',
        中国: 'CHINA',
        泰国: 'THAILAND',
        仲裁: 'ARBITRATION',
      };

      const caseTypeMap: Record<string, string> = {
        contract: 'CONTRACT_DISPUTE',
        tort: 'TORT',
        labor: 'LABOR_DISPUTE',
        ip: 'IP_DISPUTE',
        trade: 'CROSS_BORDER_TRADE',
        合同纠纷: 'CONTRACT_DISPUTE',
        侵权纠纷: 'TORT',
        劳动争议: 'LABOR_DISPUTE',
        知识产权: 'IP_DISPUTE',
        跨境贸易: 'CROSS_BORDER_TRADE',
      };

      // Extract case description from messages (first user message or session title)
      const userMessages = session.messages.filter((m) => m.role === 'USER');
      const caseDescription = userMessages.length > 0
        ? userMessages.map((m) => m.content).join('\n')
        : session.title ?? '';

      const jurisdiction = session.jurisdiction
        ? jurisdictionMap[session.jurisdiction.toLowerCase()] ?? undefined
        : undefined;

      const caseType = session.legalDomain
        ? caseTypeMap[session.legalDomain.toLowerCase()] ?? undefined
        : undefined;

      // Extract evidence items from message metadata if available
      const evidenceItems: Array<{
        name: string;
        evidenceType: 'DOCUMENTARY' | 'PHYSICAL' | 'TESTIMONY' | 'EXPERT_OPINION' | 'ELECTRONIC';
        description: string;
        proofPurpose: string;
      }> = [];

      for (const msg of session.messages) {
        if (msg.metadata && typeof msg.metadata === 'object') {
          const meta = msg.metadata as Record<string, unknown>;
          if (Array.isArray(meta.evidenceItems)) {
            for (const item of meta.evidenceItems) {
              if (item && typeof item === 'object') {
                const e = item as Record<string, unknown>;
                evidenceItems.push({
                  name: String(e.name ?? ''),
                  evidenceType: (e.evidenceType as 'DOCUMENTARY') ?? 'DOCUMENTARY',
                  description: String(e.description ?? ''),
                  proofPurpose: String(e.proofPurpose ?? ''),
                });
              }
            }
          }
        }
      }

      return {
        caseDescription: caseDescription || undefined,
        caseType: caseType as 'CONTRACT_DISPUTE' | 'TORT' | 'LABOR_DISPUTE' | 'IP_DISPUTE' | 'CROSS_BORDER_TRADE' | 'OTHER' | undefined,
        jurisdiction,
        evidenceItems: evidenceItems.length > 0 ? evidenceItems : undefined,
      };
    }),

  /**
   * List user's historical case analysis sessions for import.
   * Ordered by creation time descending.
   * Requirements: 2.2
   */
  listCaseAnalyses: protectedProcedure
    .query(async ({ ctx }) => {
      const sessions = await prisma.consultationSession.findMany({
        where: {
          userId: ctx.userId,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          title: true,
          legalDomain: true,
          jurisdiction: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sessions.map((s) => ({
        sessionId: s.id,
        title: s.title ?? undefined,
        legalDomain: s.legalDomain ?? undefined,
        jurisdiction: s.jurisdiction ?? undefined,
        createdAt: s.createdAt,
      }));
    }),

  /**
   * Send a message during the court session.
   * Requirements: 5.1, 6.2
   */
  sendMessage: protectedProcedure
    .input(z.object({
      sessionId: z.string().min(1, '会话ID不能为空'),
      content: z.string().min(1, '消息内容不能为空'),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = getService();
      return service.processMessage(input.sessionId, ctx.userId, input.content);
    }),

  /**
   * Submit evidence during the EVIDENCE phase.
   * Requirements: 5.1, 6.2
   */
  submitEvidence: protectedProcedure
    .input(submitEvidenceInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = getService();
      return service.submitEvidence(input.sessionId, ctx.userId, input.evidence);
    }),

  /**
   * Raise an objection during the court session.
   * Requirements: 6.2, 6.3
   */
  raiseObjection: protectedProcedure
    .input(raiseObjectionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = getService();
      return service.handleObjection(input.sessionId, ctx.userId, input.objection);
    }),

  /**
   * Respond to an AI-raised objection.
   * Requirements: 6.3
   */
  respondToObjection: protectedProcedure
    .input(z.object({
      sessionId: z.string().min(1, '会话ID不能为空'),
      response: z.string().min(1, '回应内容不能为空'),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = getService();
      return service.respondToObjection(input.sessionId, ctx.userId, input.response);
    }),

  /**
   * Get session details including message history.
   * Delegates to MockCourtService.resumeSession for state restoration.
   * Requirements: 8.5, 11.4
   */
  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .query(async ({ ctx, input }) => {
      const service = getService();
      return service.resumeSession(input.sessionId, ctx.userId);
    }),

  /**
   * Get messages since a given message ID (incremental sync for reconnection).
   * If afterMessageId is omitted, returns all messages for the session.
   * Requirements: 11.3
   */
  getMessagesSince: protectedProcedure
    .input(z.object({
      sessionId: z.string().min(1, '会话ID不能为空'),
      afterMessageId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const service = getService();
      return service.getMessagesSince(input.sessionId, ctx.userId, input.afterMessageId);
    }),

  /**
   * List user's mock court sessions.
   * Filters out DELETED sessions, ordered by creation time descending.
   * Requirements: 8.4, 11.4
   */
  listSessions: protectedProcedure
    .query(async ({ ctx }) => {
      const sessions = await prisma.mockCourtSession.findMany({
        where: {
          userId: ctx.userId,
          status: { not: 'DELETED' },
        },
        select: {
          id: true,
          caseType: true,
          jurisdiction: true,
          difficulty: true,
          status: true,
          currentPhase: true,
          reportGenerated: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return sessions;
    }),

  /**
   * Get the performance evaluation report for a completed session.
   * Requirements: 7.7
   */
  getReport: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const session = await prisma.mockCourtSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
      }

      if (session.userId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问此会话' });
      }

      // Check if report already exists
      const existingReport = await prisma.courtPerformanceReport.findUnique({
        where: { sessionId: input.sessionId },
      });

      if (existingReport) {
        const details = existingReport.dimensionDetails as Record<string, { comment?: string; strengths?: string[]; weaknesses?: string[] }> | null;
        const getDimensionDetail = (key: string) => details?.[key] ?? {};

        return {
          id: existingReport.id,
          sessionId: existingReport.sessionId,
          dimensions: [
            { dimension: 'LEGAL_ARGUMENT' as const, score: existingReport.legalArgumentScore, comment: getDimensionDetail('LEGAL_ARGUMENT').comment ?? '', strengths: getDimensionDetail('LEGAL_ARGUMENT').strengths ?? [], weaknesses: getDimensionDetail('LEGAL_ARGUMENT').weaknesses ?? [] },
            { dimension: 'EVIDENCE_USE' as const, score: existingReport.evidenceUseScore, comment: getDimensionDetail('EVIDENCE_USE').comment ?? '', strengths: getDimensionDetail('EVIDENCE_USE').strengths ?? [], weaknesses: getDimensionDetail('EVIDENCE_USE').weaknesses ?? [] },
            { dimension: 'PROCEDURE' as const, score: existingReport.procedureScore, comment: getDimensionDetail('PROCEDURE').comment ?? '', strengths: getDimensionDetail('PROCEDURE').strengths ?? [], weaknesses: getDimensionDetail('PROCEDURE').weaknesses ?? [] },
            { dimension: 'ADAPTABILITY' as const, score: existingReport.adaptabilityScore, comment: getDimensionDetail('ADAPTABILITY').comment ?? '', strengths: getDimensionDetail('ADAPTABILITY').strengths ?? [], weaknesses: getDimensionDetail('ADAPTABILITY').weaknesses ?? [] },
            { dimension: 'EXPRESSION' as const, score: existingReport.expressionScore, comment: getDimensionDetail('EXPRESSION').comment ?? '', strengths: getDimensionDetail('EXPRESSION').strengths ?? [], weaknesses: getDimensionDetail('EXPRESSION').weaknesses ?? [] },
          ],
          overallScore: existingReport.overallScore,
          overallComment: existingReport.overallComment,
          improvements: existingReport.improvements as { suggestion: string; exampleQuote: string }[],
          legalCitations: existingReport.legalCitations as { citation: string; isAccurate: boolean; correction?: string }[],
          verdictSummary: existingReport.verdictSummary,
        };
      }

      // Generate report if session is in VERDICT phase
      if (session.currentPhase !== 'VERDICT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '庭审尚未结束，无法生成评估报告',
        });
      }

      // Build session detail for evaluation
      const service = getService();
      const sessionDetail = await service.resumeSession(input.sessionId, ctx.userId);
      const evaluator = getEvaluator();
      const report = await evaluator.evaluate(sessionDetail);

      return report;
    }),

  /**
   * Export court session transcript as PDF.
   * Returns base64-encoded PDF content.
   * Requirements: 8.2, 8.3
   */
  exportPDF: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.mockCourtSession.findUnique({
        where: { id: input.sessionId },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          evidenceItems: { orderBy: { createdAt: 'asc' } },
          report: true,
        },
      });

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
      }

      if (session.userId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问此会话' });
      }

      // Build HTML for PDF generation
      const html = buildCourtSessionHTML(session);
      const buffer = Buffer.from(html, 'utf-8');
      return { pdf: buffer.toString('base64') };
    }),

  /**
   * Soft-delete a mock court session.
   * Sets deletedAt timestamp and status to DELETED.
   * Requirements: 11.5
   */
  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1, '会话ID不能为空') }))
    .mutation(async ({ ctx, input }) => {
      const session = await prisma.mockCourtSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) {
        throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
      }

      if (session.userId !== ctx.userId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: '无权删除此会话' });
      }

      if (session.status === 'DELETED') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: '会话已被删除' });
      }

      await prisma.mockCourtSession.update({
        where: { id: input.sessionId },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
        },
      });

      return { success: true };
    }),
});


// ─── PDF HTML Builder ───────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  OPENING: '开庭陈述',
  EVIDENCE: '举证质证',
  DEBATE: '法庭辩论',
  CLOSING: '最后陈述',
  VERDICT: '判决',
};

const ROLE_LABELS: Record<string, string> = {
  USER: '用户',
  JUDGE: '法官',
  OPPOSING_COUNSEL: '对方律师',
  WITNESS: '证人',
  SYSTEM: '系统',
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildCourtSessionHTML(session: {
  caseType: string;
  caseDescription: string;
  jurisdiction: string;
  userRole: string;
  difficulty: string;
  currentPhase: string;
  messages: Array<{ phase: string; senderRole: string; content: string; createdAt: Date }>;
  evidenceItems: Array<{ name: string; evidenceType: string; description: string; admission: string }>;
  report: {
    overallScore: number;
    overallComment: string;
    legalArgumentScore: number;
    evidenceUseScore: number;
    procedureScore: number;
    adaptabilityScore: number;
    expressionScore: number;
    verdictSummary: string;
  } | null;
}): string {
  const messagesHtml = session.messages
    .map(
      (m) =>
        `<div class="message"><strong>[${PHASE_LABELS[m.phase] ?? m.phase}] ${ROLE_LABELS[m.senderRole] ?? m.senderRole}:</strong><p>${escapeHtml(m.content)}</p></div>`,
    )
    .join('\n');

  const evidenceHtml = session.evidenceItems.length > 0
    ? session.evidenceItems
        .map(
          (e) =>
            `<tr><td>${escapeHtml(e.name)}</td><td>${e.evidenceType}</td><td>${escapeHtml(e.description)}</td><td>${e.admission}</td></tr>`,
        )
        .join('\n')
    : '<tr><td colspan="4">无证据记录</td></tr>';

  const reportHtml = session.report
    ? `<h2>表现评估报告</h2>
       <p>总体评分: ${session.report.overallScore}</p>
       <p>${escapeHtml(session.report.overallComment)}</p>
       <table>
         <tr><th>维度</th><th>评分</th></tr>
         <tr><td>法律论证质量</td><td>${session.report.legalArgumentScore}</td></tr>
         <tr><td>证据运用能力</td><td>${session.report.evidenceUseScore}</td></tr>
         <tr><td>程序规范性</td><td>${session.report.procedureScore}</td></tr>
         <tr><td>应变能力</td><td>${session.report.adaptabilityScore}</td></tr>
         <tr><td>语言表达</td><td>${session.report.expressionScore}</td></tr>
       </table>
       <h3>判决摘要</h3>
       <p>${escapeHtml(session.report.verdictSummary)}</p>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>模拟法庭记录</title>
<style>
  body { font-family: sans-serif; margin: 2em; }
  .message { margin: 0.5em 0; padding: 0.5em; border-left: 3px solid #ccc; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  th { background: #f5f5f5; }
</style></head><body>
<h1>模拟法庭庭审记录</h1>
<h2>案件信息</h2>
<table>
  <tr><th>案件类型</th><td>${session.caseType}</td></tr>
  <tr><th>管辖区</th><td>${session.jurisdiction}</td></tr>
  <tr><th>用户角色</th><td>${session.userRole}</td></tr>
  <tr><th>难度等级</th><td>${session.difficulty}</td></tr>
</table>
<h3>案情描述</h3>
<p>${escapeHtml(session.caseDescription)}</p>
<h2>庭审记录</h2>
${messagesHtml}
<h2>证据清单</h2>
<table>
  <tr><th>名称</th><th>类型</th><th>描述</th><th>采纳状态</th></tr>
  ${evidenceHtml}
</table>
${reportHtml}
</body></html>`;
}
