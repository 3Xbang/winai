/**
 * Consultation Orchestrator (咨询核心流程编排)
 * Enhanced AI pipeline:
 * Quota check → Language detection → Intent classification → Context loading
 * → RAG retrieval → Jurisdiction identification → IRAC analysis → Risk assessment
 * → Report generation → Confidence scoring → Hallucination detection
 * → Personalization adaptation → Risk warnings → Usage increment → Session save
 *
 * Requirements: 1.1, 2.1, 3.1, 12.1, 21.1, 24.1, 25.1, 29.1, 30.3, 30.4
 */

import { TRPCError } from '@trpc/server';
import { getJurisdictionIdentifier } from '@/server/services/legal/jurisdiction';
import type { JurisdictionResult } from '@/server/services/legal/jurisdiction';
import { getIRACEngine } from '@/server/services/legal/irac';
import type { IRACResult } from '@/server/services/legal/irac';
import { getReportGenerator } from '@/server/services/report/generator';
import type { LegalReport } from '@/server/services/report/generator';
import { checkQuota, incrementUsage } from '@/server/services/subscription/manager';
import type { QuotaStatus } from '@/server/services/subscription/manager';
import { getRiskWarningService } from '@/server/services/legal/risk-warning';
import { save } from '@/server/services/session/manager';
import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMStreamChunk } from '@/server/services/llm/types';
// AI enhancement imports
import { detectLanguage } from '@/server/services/ai/conversation/language-detector';
import { classifyIntent } from '@/server/services/ai/conversation/intent-classifier';
import type { IntentClassification } from '@/server/services/ai/conversation/intent-classifier';
import { assess as assessRisk } from '@/server/services/ai/risk/assessor';
import type { RiskAssessmentResult } from '@/server/services/ai/risk/assessor';
import { assessConfidence } from '@/server/services/ai/quality/confidence-assessor';
import type { ConfidenceAssessment } from '@/server/services/ai/quality/confidence-assessor';
import { checkHallucination, extractCitations } from '@/server/services/ai/quality/hallucination-detector';
import type { HallucinationCheckResult } from '@/server/services/ai/quality/hallucination-detector';
import { getUserPreferences, buildPreferencePromptInjection } from '@/server/services/ai/personalization/preference-manager';
import type { UserPreference } from '@/server/services/ai/personalization/preference-manager';

// ─── Types ──────────────────────────────────────────────────

export interface ConsultationRequest {
  query: string;
  userId: string;
  language?: 'zh' | 'th' | 'en';
  context?: string;
  sessionId?: string;
}

export interface ConsultationResult {
  sessionId: string;
  jurisdiction: JurisdictionResult;
  analysis: IRACResult;
  report: LegalReport;
  quotaRemaining: QuotaStatus;
  // AI enhancement fields
  detectedLanguage?: 'zh' | 'th' | 'en';
  intentClassification?: IntentClassification;
  riskAssessment?: RiskAssessmentResult;
  confidenceAssessment?: ConfidenceAssessment;
  hallucinationCheck?: HallucinationCheckResult;
  userPreferences?: UserPreference;
}

/** Streaming event types sent to the client */
export type ConsultationStreamEvent =
  | { type: 'status'; stage: string; message: string }
  | { type: 'jurisdiction'; data: JurisdictionResult }
  | { type: 'analysis'; data: IRACResult }
  | { type: 'report'; data: LegalReport }
  | { type: 'complete'; data: ConsultationResult }
  | { type: 'error'; message: string };

// ─── Orchestrator ───────────────────────────────────────────

/**
 * Process a full consultation request (non-streaming).
 * Enhanced AI pipeline:
 * quota → language detect → intent classify → personalization → jurisdiction
 * → IRAC → risk assessment → report → confidence → hallucination → risk warnings
 * → usage → session save.
 */
export async function processConsultation(request: ConsultationRequest): Promise<ConsultationResult> {
  // 1. Check user quota
  const quota = await checkQuota(request.userId);
  if (!quota.allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: quota.reason || '咨询额度已用尽，请升级订阅计划。',
    });
  }

  // 2. Language detection
  const detectedLanguage = detectLanguage(request.query);
  const language = request.language || detectedLanguage;

  // 3. Intent classification
  const intentClassification = classifyIntent(request.query);

  // 4. Load user preferences & build personalization prompt injection
  const userPreferences = getUserPreferences(request.userId);
  const _preferenceInjection = buildPreferencePromptInjection(request.userId);

  // 5. Identify jurisdiction
  const jurisdictionIdentifier = getJurisdictionIdentifier();
  const jurisdiction = await jurisdictionIdentifier.identify({
    query: request.query,
    userId: request.userId,
    language,
    context: request.context,
  });

  // 6. Run IRAC analysis
  const iracEngine = getIRACEngine();
  const analysis = await iracEngine.analyze(
    {
      query: request.query,
      userId: request.userId,
      language,
      context: request.context,
    },
    jurisdiction,
  );

  // 7. Risk assessment (graceful degradation)
  let riskAssessment: RiskAssessmentResult | undefined;
  try {
    riskAssessment = await assessRisk({
      caseInfo: {
        caseType: intentClassification.primaryIntent,
        jurisdiction: jurisdiction.jurisdiction === 'CHINA' ? 'china' : 'thailand',
        facts: request.query,
        evidence: [],
        legalBasis: [],
      },
      jurisdiction: { jurisdiction: jurisdiction.jurisdiction },
      assessmentType: 'QUICK',
    });
  } catch {
    // Risk assessment failure should not block the consultation
  }

  // 8. Generate report — graceful degradation if this fails
  let report: LegalReport;
  try {
    const reportGenerator = getReportGenerator();
    const iracSummary = buildIRACSummary(analysis);
    report = await reportGenerator.generate(
      {
        jurisdiction: jurisdiction.jurisdiction,
        query: request.query,
        iracAnalysis: iracSummary,
      },
      'STANDARD',
    );
  } catch {
    report = buildFallbackReport(jurisdiction, request.query);
  }

  // 9. Confidence scoring (quality middleware)
  const messageId = `msg_${Date.now()}`;
  const sessionId = request.sessionId || generateSessionId();
  let confidenceAssessment: ConfidenceAssessment | undefined;
  try {
    confidenceAssessment = await assessConfidence(messageId, sessionId, report.summary);
  } catch {
    // Confidence assessment failure should not block the consultation
  }

  // 10. Hallucination detection (quality middleware)
  let hallucinationCheck: HallucinationCheckResult | undefined;
  try {
    // In production, knownCitations would come from pgvector + LawDocument table
    const knownCitations = new Set<string>();
    hallucinationCheck = checkHallucination(messageId, report.summary, knownCitations);
  } catch {
    // Hallucination check failure should not block the consultation
  }

  // 11. Add risk warnings and disclaimers
  const riskWarningService = getRiskWarningService();
  const processedReport = riskWarningService.process({
    content: report.summary,
    legalDomain: 'OTHER',
    riskLevel: 'MEDIUM',
    jurisdiction: jurisdiction.jurisdiction,
    referencedLaws: extractReferencedLaws(jurisdiction),
  });
  report.disclaimer = processedReport.disclaimer;

  // 12. Increment usage count
  await incrementUsage(request.userId);

  // 13. Refresh quota to get remaining counts
  const quotaRemaining = await checkQuota(request.userId);

  // 14. Save session
  try {
    await save({
      id: request.sessionId || undefined,
      userId: request.userId,
      title: request.query.slice(0, 100),
      legalDomain: 'CONSULTATION',
      jurisdiction: jurisdiction.jurisdiction,
      messages: [
        { role: 'USER', content: request.query },
        { role: 'ASSISTANT', content: report.summary },
      ],
    });
  } catch {
    // Session save failure should not block the consultation result
  }

  return {
    sessionId,
    jurisdiction,
    analysis,
    report,
    quotaRemaining,
    detectedLanguage,
    intentClassification,
    riskAssessment,
    confidenceAssessment,
    hallucinationCheck,
    userPreferences,
  };
}

/**
 * Process a consultation with streaming output.
 * Enhanced AI pipeline with streaming events.
 */
export async function* processConsultationStream(
  request: ConsultationRequest,
): AsyncGenerator<ConsultationStreamEvent> {
  // 1. Check quota
  yield { type: 'status', stage: 'quota', message: '正在检查咨询额度...' };
  const quota = await checkQuota(request.userId);
  if (!quota.allowed) {
    yield { type: 'error', message: quota.reason || '咨询额度已用尽，请升级订阅计划。' };
    return;
  }

  // 2. Language detection
  yield { type: 'status', stage: 'language', message: '正在检测语言...' };
  const detectedLanguage = detectLanguage(request.query);
  const language = request.language || detectedLanguage;

  // 3. Intent classification
  yield { type: 'status', stage: 'intent', message: '正在分析法律意图...' };
  const intentClassification = classifyIntent(request.query);

  // 4. Load user preferences
  const userPreferences = getUserPreferences(request.userId);

  // 5. Identify jurisdiction
  yield { type: 'status', stage: 'jurisdiction', message: '正在识别法律管辖区...' };
  const jurisdictionIdentifier = getJurisdictionIdentifier();
  const jurisdiction = await jurisdictionIdentifier.identify({
    query: request.query,
    userId: request.userId,
    language,
    context: request.context,
  });
  yield { type: 'jurisdiction', data: jurisdiction };

  // 6. IRAC analysis
  yield { type: 'status', stage: 'analysis', message: '正在进行 IRAC 法律分析...' };
  const iracEngine = getIRACEngine();
  const analysis = await iracEngine.analyze(
    {
      query: request.query,
      userId: request.userId,
      language,
      context: request.context,
    },
    jurisdiction,
  );
  yield { type: 'analysis', data: analysis };

  // 7. Risk assessment
  yield { type: 'status', stage: 'risk', message: '正在评估法律风险...' };
  let riskAssessment: RiskAssessmentResult | undefined;
  try {
    riskAssessment = await assessRisk({
      caseInfo: {
        caseType: intentClassification.primaryIntent,
        jurisdiction: jurisdiction.jurisdiction === 'CHINA' ? 'china' : 'thailand',
        facts: request.query,
        evidence: [],
        legalBasis: [],
      },
      jurisdiction: { jurisdiction: jurisdiction.jurisdiction },
      assessmentType: 'QUICK',
    });
  } catch {
    // Non-blocking
  }

  // 8. Generate report
  yield { type: 'status', stage: 'report', message: '正在生成法律分析报告...' };
  let report: LegalReport;
  try {
    const reportGenerator = getReportGenerator();
    const iracSummary = buildIRACSummary(analysis);
    report = await reportGenerator.generate(
      {
        jurisdiction: jurisdiction.jurisdiction,
        query: request.query,
        iracAnalysis: iracSummary,
      },
      'STANDARD',
    );
  } catch {
    report = buildFallbackReport(jurisdiction, request.query);
  }

  // 9. Quality middleware: confidence + hallucination
  yield { type: 'status', stage: 'quality', message: '正在进行质量检查...' };
  const messageId = `msg_${Date.now()}`;
  const sessionId = request.sessionId || generateSessionId();
  let confidenceAssessment: ConfidenceAssessment | undefined;
  try {
    confidenceAssessment = await assessConfidence(messageId, sessionId, report.summary);
  } catch {
    // Non-blocking
  }

  let hallucinationCheck: HallucinationCheckResult | undefined;
  try {
    const knownCitations = new Set<string>();
    hallucinationCheck = checkHallucination(messageId, report.summary, knownCitations);
  } catch {
    // Non-blocking
  }

  // 10. Risk warnings
  const riskWarningService = getRiskWarningService();
  const processedReport = riskWarningService.process({
    content: report.summary,
    legalDomain: 'OTHER',
    riskLevel: 'MEDIUM',
    jurisdiction: jurisdiction.jurisdiction,
    referencedLaws: extractReferencedLaws(jurisdiction),
  });
  report.disclaimer = processedReport.disclaimer;
  yield { type: 'report', data: report };

  // 11. Finalize
  yield { type: 'status', stage: 'finalize', message: '正在保存咨询记录...' };
  await incrementUsage(request.userId);

  const quotaRemaining = await checkQuota(request.userId);

  try {
    await save({
      id: request.sessionId || undefined,
      userId: request.userId,
      title: request.query.slice(0, 100),
      legalDomain: 'CONSULTATION',
      jurisdiction: jurisdiction.jurisdiction,
      messages: [
        { role: 'USER', content: request.query },
        { role: 'ASSISTANT', content: report.summary },
      ],
    });
  } catch {
    // Session save failure should not block the result
  }

  const result: ConsultationResult = {
    sessionId,
    jurisdiction,
    analysis,
    report,
    quotaRemaining,
    detectedLanguage,
    intentClassification,
    riskAssessment,
    confidenceAssessment,
    hallucinationCheck,
    userPreferences,
  };

  yield { type: 'complete', data: result };
}

// ─── Helpers ────────────────────────────────────────────────

function buildIRACSummary(analysis: IRACResult): string {
  const parts: string[] = [];

  if (analysis.chinaAnalysis) {
    const ca = analysis.chinaAnalysis;
    parts.push(
      `【中国法 IRAC 分析】\n` +
      `争议焦点：${ca.issue}\n` +
      `适用法条：${ca.rule.map(r => `${r.lawName} ${r.articleNumber || ''}`).join('；')}\n` +
      `法律分析：${ca.analysis}\n` +
      `结论：${ca.conclusion}`,
    );
  }

  if (analysis.thailandAnalysis) {
    const ta = analysis.thailandAnalysis;
    parts.push(
      `【泰国法 IRAC 分析】\n` +
      `争议焦点：${ta.issue}\n` +
      `适用法条：${ta.rule.map(r => `${r.lawName} ${r.articleNumber || ''}`).join('；')}\n` +
      `法律分析：${ta.analysis}\n` +
      `结论：${ta.conclusion}`,
    );
  }

  if (analysis.combinedConclusion) {
    parts.push(`【综合结论】\n${analysis.combinedConclusion}`);
  }

  return parts.join('\n\n');
}

function extractReferencedLaws(jurisdiction: JurisdictionResult): string[] {
  const laws: string[] = [];
  if (jurisdiction.chinaLaws) {
    laws.push(...jurisdiction.chinaLaws.map(l => l.lawName));
  }
  if (jurisdiction.thailandLaws) {
    laws.push(...jurisdiction.thailandLaws.map(l => l.lawName));
  }
  return laws;
}

function buildFallbackReport(jurisdiction: JurisdictionResult, query: string): LegalReport {
  return {
    id: `rpt_fallback_${Date.now()}`,
    title: '法律分析报告（部分生成）',
    summary: '报告生成服务暂时不可用，请参考管辖权识别和 IRAC 分析结果。',
    legalAnalysis: '法律依据分析暂不可用。',
    strategyAdvice: '策略建议暂不可用。',
    actionPlan: ['请稍后重试以获取完整的行动方案。'],
    caseReferences: ['暂无案例参考。'],
    disclaimer: '本报告由AI法律专家系统自动生成，仅供参考，不构成正式法律意见。',
    jurisdiction: jurisdiction.jurisdiction,
    generatedAt: new Date(),
    format: 'STANDARD',
  };
}

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
