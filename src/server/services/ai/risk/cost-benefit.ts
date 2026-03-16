/**
 * Cost-Benefit Analyzer — Litigation/Settlement/Mediation path analysis via LLM
 * Provides structured cost, time, probability and outcome for each resolution path.
 * Requirements: 25.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';

// ─── Types ──────────────────────────────────────────────────

export interface ResolutionPath {
  cost: number;
  time: string;
  probability: number;
  potentialOutcome: string;
}

export interface CostBenefitAnalysis {
  litigation: ResolutionPath;
  settlement: ResolutionPath;
  mediation: ResolutionPath;
  recommendation: string;
}

// ─── System Prompt ──────────────────────────────────────────

const COST_BENEFIT_PROMPT = `你是一位法律成本效益分析专家。请根据案件信息，分析三种解决路径的成本效益。

输出 JSON 格式：
{
  "litigation": { "cost": 数字(元), "time": "预计时间", "probability": 0-1, "potentialOutcome": "可能结果" },
  "settlement": { "cost": 数字(元), "time": "预计时间", "probability": 0-1, "potentialOutcome": "可能结果" },
  "mediation": { "cost": 数字(元), "time": "预计时间", "probability": 0-1, "potentialOutcome": "可能结果" },
  "recommendation": "综合建议"
}

仅输出 JSON 对象。`;

// ─── Helpers ────────────────────────────────────────────────

const DEFAULT_PATH: ResolutionPath = { cost: 0, time: '', probability: 0, potentialOutcome: '' };

function parsePath(raw: Record<string, unknown> | undefined): ResolutionPath {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PATH };
  return {
    cost: typeof raw.cost === 'number' && raw.cost >= 0 ? raw.cost : 0,
    time: typeof raw.time === 'string' ? raw.time : '',
    probability: typeof raw.probability === 'number'
      ? Math.max(0, Math.min(1, raw.probability))
      : 0,
    potentialOutcome: typeof raw.potentialOutcome === 'string' ? raw.potentialOutcome : '',
  };
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Analyze cost-benefit for litigation, settlement, and mediation paths.
 */
export async function analyzeCostBenefit(
  caseInfo: CaseSubmission,
): Promise<CostBenefitAnalysis> {
  const gateway = getLLMGateway();

  const userContent = [
    `案件类型: ${caseInfo.caseType}`,
    `法域: ${caseInfo.jurisdiction === 'china' ? '中国' : '泰国'}`,
    `案件事实:\n${caseInfo.facts}`,
    `证据:\n${caseInfo.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
    `法律依据:\n${caseInfo.legalBasis.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
  ].join('\n\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: COST_BENEFIT_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    const parsed = gateway.parseJSON<Record<string, unknown>>(response);

    return {
      litigation: parsePath(parsed.litigation as Record<string, unknown> | undefined),
      settlement: parsePath(parsed.settlement as Record<string, unknown> | undefined),
      mediation: parsePath(parsed.mediation as Record<string, unknown> | undefined),
      recommendation: typeof parsed.recommendation === 'string' ? parsed.recommendation : '',
    };
  } catch {
    return {
      litigation: { ...DEFAULT_PATH },
      settlement: { ...DEFAULT_PATH },
      mediation: { ...DEFAULT_PATH },
      recommendation: '',
    };
  }
}
