/**
 * AI Risk Assessor — Multi-dimensional legal risk assessment with heat map data
 * Uses LLM Gateway for structured risk scoring across 4 dimensions.
 * Requirements: 25.1, 25.2
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';

// ─── Types ──────────────────────────────────────────────────

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RiskAssessmentRequest {
  caseInfo: CaseSubmission;
  jurisdiction: { jurisdiction: string };
  assessmentType: 'FULL' | 'QUICK';
}

export interface RiskDimensions {
  legal: number;      // 0-100
  financial: number;  // 0-100
  compliance: number; // 0-100
  reputation: number; // 0-100
}

export interface HeatMapDataPoint {
  dimension: string;
  subCategory: string;
  score: number;
  severity: RiskLevel;
}

export interface RiskAssessmentResult {
  dimensions: RiskDimensions;
  overallLevel: RiskLevel;
  heatMapData: HeatMapDataPoint[];
  details: string;
}

// ─── Constants ──────────────────────────────────────────────

const DIMENSION_KEYS: (keyof RiskDimensions)[] = ['legal', 'financial', 'compliance', 'reputation'];

const SUB_CATEGORIES: Record<keyof RiskDimensions, string[]> = {
  legal: ['法律适用风险', '管辖权风险', '诉讼时效风险'],
  financial: ['直接损失风险', '间接损失风险', '执行风险'],
  compliance: ['行政处罚风险', '监管合规风险', '跨境合规风险'],
  reputation: ['公众舆论风险', '商业信誉风险', '行业声誉风险'],
};

// ─── System Prompt ──────────────────────────────────────────

export const RISK_ASSESSMENT_PROMPT = `你是一位资深法律风险评估专家。请根据案件信息，从以下四个维度进行风险量化评分（0-100分，分数越高风险越大）。

四个评分维度：
1. legal（法律风险）：法律适用不确定性、管辖权争议、诉讼时效等
2. financial（财务风险）：直接经济损失、间接损失、执行难度等
3. compliance（合规风险）：行政处罚、监管合规、跨境合规等
4. reputation（声誉风险）：公众舆论、商业信誉、行业声誉等

同时为每个维度的子类别提供细分评分。

输出 JSON 格式：
{
  "dimensions": {
    "legal": 0-100,
    "financial": 0-100,
    "compliance": 0-100,
    "reputation": 0-100
  },
  "subScores": {
    "legal": { "法律适用风险": 0-100, "管辖权风险": 0-100, "诉讼时效风险": 0-100 },
    "financial": { "直接损失风险": 0-100, "间接损失风险": 0-100, "执行风险": 0-100 },
    "compliance": { "行政处罚风险": 0-100, "监管合规风险": 0-100, "跨境合规风险": 0-100 },
    "reputation": { "公众舆论风险": 0-100, "商业信誉风险": 0-100, "行业声誉风险": 0-100 }
  },
  "details": "综合风险评估报告"
}

仅输出 JSON 对象。`;

// ─── Helpers ────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

/**
 * Compute overall risk level from dimension scores.
 * - All dimensions < 30 → LOW
 * - Any dimension > 80 → at least HIGH
 * - Any dimension > 90 → CRITICAL
 * - Otherwise MEDIUM
 */
export function computeOverallLevel(dims: RiskDimensions): RiskLevel {
  const scores = DIMENSION_KEYS.map((k) => dims[k]);
  const maxScore = Math.max(...scores);

  if (maxScore > 90) return 'CRITICAL';
  if (maxScore > 80) return 'HIGH';
  if (scores.every((s) => s < 30)) return 'LOW';
  return 'MEDIUM';
}

function scoreSeverity(score: number): RiskLevel {
  if (score > 90) return 'CRITICAL';
  if (score > 70) return 'HIGH';
  if (score > 40) return 'MEDIUM';
  return 'LOW';
}

function buildHeatMapData(
  dims: RiskDimensions,
  subScores: Record<string, Record<string, number>> | undefined,
): HeatMapDataPoint[] {
  const points: HeatMapDataPoint[] = [];

  for (const dim of DIMENSION_KEYS) {
    const subs = SUB_CATEGORIES[dim];
    const rawSubs = subScores?.[dim];

    for (const sub of subs) {
      const score = clamp(
        typeof rawSubs?.[sub] === 'number' ? rawSubs[sub] : dims[dim],
        0,
        100,
      );
      points.push({
        dimension: dim,
        subCategory: sub,
        score,
        severity: scoreSeverity(score),
      });
    }
  }

  return points;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Assess risk across 4 dimensions using LLM.
 * Returns RiskAssessmentResult with overallLevel computed from dimension scores.
 */
export async function assess(
  request: RiskAssessmentRequest,
): Promise<RiskAssessmentResult> {
  const gateway = getLLMGateway();
  const { caseInfo, jurisdiction } = request;

  const userContent = [
    `案件类型: ${caseInfo.caseType}`,
    `法域: ${caseInfo.jurisdiction === 'china' ? '中国' : '泰国'}`,
    `管辖权: ${jurisdiction.jurisdiction}`,
    `案件事实:\n${caseInfo.facts}`,
    `证据:\n${caseInfo.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
    `法律依据:\n${caseInfo.legalBasis.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
  ].join('\n\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: RISK_ASSESSMENT_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const rawDims = parsed.dimensions as Record<string, unknown> | undefined;

    const dimensions: RiskDimensions = {
      legal: clamp(typeof rawDims?.legal === 'number' ? rawDims.legal : 0, 0, 100),
      financial: clamp(typeof rawDims?.financial === 'number' ? rawDims.financial : 0, 0, 100),
      compliance: clamp(typeof rawDims?.compliance === 'number' ? rawDims.compliance : 0, 0, 100),
      reputation: clamp(typeof rawDims?.reputation === 'number' ? rawDims.reputation : 0, 0, 100),
    };

    const overallLevel = computeOverallLevel(dimensions);
    const subScores = parsed.subScores as Record<string, Record<string, number>> | undefined;
    const heatMapData = buildHeatMapData(dimensions, subScores);
    const details = typeof parsed.details === 'string' ? parsed.details : '';

    return { dimensions, overallLevel, heatMapData, details };
  } catch {
    return {
      dimensions: { legal: 0, financial: 0, compliance: 0, reputation: 0 },
      overallLevel: 'LOW',
      heatMapData: [],
      details: '',
    };
  }
}
