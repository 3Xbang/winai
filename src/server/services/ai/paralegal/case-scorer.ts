/**
 * Case Strength Scorer — AI-powered case strength evaluation
 * Uses LLM Gateway to evaluate case strength across 4 dimensions.
 * Requirements: 22.7
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface CaseSubmission {
  caseType: string;
  jurisdiction: 'china' | 'thailand';
  facts: string;
  evidence: string[];
  legalBasis: string[];
}

export interface DimensionScore {
  score: number; // 0-100
  explanation: string;
}

export interface CaseStrengthScore {
  overall: number; // 0-100
  dimensions: {
    evidenceSufficiency: DimensionScore;
    legalBasisStrength: DimensionScore;
    similarCaseTrends: DimensionScore;
    proceduralCompliance: DimensionScore;
  };
  report: string;
  riskFactors: string[];
  recommendations: string[];
}

// ─── Default Score ──────────────────────────────────────────

const DEFAULT_DIMENSION: DimensionScore = { score: 0, explanation: '' };

const DEFAULT_SCORE: CaseStrengthScore = {
  overall: 0,
  dimensions: {
    evidenceSufficiency: { ...DEFAULT_DIMENSION },
    legalBasisStrength: { ...DEFAULT_DIMENSION },
    similarCaseTrends: { ...DEFAULT_DIMENSION },
    proceduralCompliance: { ...DEFAULT_DIMENSION },
  },
  report: '',
  riskFactors: [],
  recommendations: [],
};

// ─── System Prompt ──────────────────────────────────────────

export const CASE_SCORING_PROMPT = `你是一位资深法律案件评估专家。请根据用户提供的案件信息，从以下四个维度对案件强度进行量化评分（0-100分），并生成评分说明报告。

四个评分维度：
1. evidenceSufficiency（证据充分性）：评估现有证据是否充分支持案件主张
2. legalBasisStrength（法律依据强度）：评估法律依据的适用性和说服力
3. similarCaseTrends（类似案例裁判趋势）：评估类似案例的裁判趋势是否有利
4. proceduralCompliance（程序合规性）：评估案件程序是否合规，是否存在程序瑕疵

输出要求：
- 以 JSON 对象格式输出
- 包含以下字段：
  - "dimensions": 对象，包含四个维度的评分：
    - "evidenceSufficiency": { "score": 0-100, "explanation": "评分说明" }
    - "legalBasisStrength": { "score": 0-100, "explanation": "评分说明" }
    - "similarCaseTrends": { "score": 0-100, "explanation": "评分说明" }
    - "proceduralCompliance": { "score": 0-100, "explanation": "评分说明" }
  - "report": 综合评估报告（详细说明案件整体强度和关键发现）
  - "riskFactors": 风险因素数组（列出案件面临的主要风险）
  - "recommendations": 建议数组（列出改善案件强度的具体建议）

评分标准：
- 0-20: 非常弱
- 21-40: 较弱
- 41-60: 一般
- 61-80: 较强
- 81-100: 非常强

请确保每个维度的评分都有充分的说明理由，仅输出 JSON 对象，不要输出其他内容。

Evaluate case strength across 4 dimensions with scores 0-100. Output as a JSON object with dimensions, report, riskFactors, and recommendations.`;

// ─── Helper ─────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// ─── Case Strength Scoring ──────────────────────────────────

/**
 * Score case strength across 4 dimensions using LLM.
 * Returns CaseStrengthScore with overall as weighted average (equal 25% each).
 * On LLM failure, returns default score with overall=0 and empty report.
 */
export async function scoreCaseStrength(
  caseInfo: CaseSubmission,
): Promise<CaseStrengthScore> {
  const gateway = getLLMGateway();

  const userContent = [
    `案件类型/Case Type: ${caseInfo.caseType}`,
    `法域/Jurisdiction: ${caseInfo.jurisdiction === 'china' ? '中国' : '泰国/Thailand'}`,
    `案件事实/Facts:\n${caseInfo.facts}`,
    `证据/Evidence:\n${caseInfo.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
    `法律依据/Legal Basis:\n${caseInfo.legalBasis.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
  ].join('\n\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: CASE_SCORING_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    const parsed = gateway.parseJSON<Record<string, unknown>>(response);

    const dims = parsed.dimensions as Record<string, Record<string, unknown>> | undefined;

    const evidenceSufficiency = parseDimension(dims?.evidenceSufficiency);
    const legalBasisStrength = parseDimension(dims?.legalBasisStrength);
    const similarCaseTrends = parseDimension(dims?.similarCaseTrends);
    const proceduralCompliance = parseDimension(dims?.proceduralCompliance);

    const overall = clamp(
      Math.round(
        (evidenceSufficiency.score +
          legalBasisStrength.score +
          similarCaseTrends.score +
          proceduralCompliance.score) /
          4,
      ),
      0,
      100,
    );

    const report = typeof parsed.report === 'string' ? parsed.report : '';
    const riskFactors = Array.isArray(parsed.riskFactors)
      ? (parsed.riskFactors as unknown[]).filter((r): r is string => typeof r === 'string')
      : [];
    const recommendations = Array.isArray(parsed.recommendations)
      ? (parsed.recommendations as unknown[]).filter((r): r is string => typeof r === 'string')
      : [];

    return {
      overall,
      dimensions: {
        evidenceSufficiency,
        legalBasisStrength,
        similarCaseTrends,
        proceduralCompliance,
      },
      report,
      riskFactors,
      recommendations,
    };
  } catch {
    return { ...DEFAULT_SCORE };
  }
}

function parseDimension(raw: Record<string, unknown> | undefined): DimensionScore {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DIMENSION };
  }
  return {
    score: clamp(typeof raw.score === 'number' ? raw.score : 0, 0, 100),
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
  };
}
