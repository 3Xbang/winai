/**
 * Outcome Predictor — Case outcome probability prediction via LLM
 * Predicts win/lose/settle probabilities with normalization (sum = 1.0 ±0.01).
 * Requirements: 25.4
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';

// ─── Types ──────────────────────────────────────────────────

export interface OutcomePrediction {
  winProbability: number;    // 0-1
  loseProbability: number;   // 0-1
  settleProbability: number; // 0-1
  predictionBasis: string;
  similarCaseCount: number;
}

// ─── System Prompt ──────────────────────────────────────────

const PREDICTION_PROMPT = `你是一位法律案件结果预测专家。请根据案件信息预测案件可能的结果概率。

输出 JSON 格式：
{
  "winProbability": 0-1,
  "loseProbability": 0-1,
  "settleProbability": 0-1,
  "predictionBasis": "预测依据说明",
  "similarCaseCount": 数字
}

要求：
- winProbability + loseProbability + settleProbability 之和必须等于 1.0
- 每个概率值在 0 到 1 之间
- similarCaseCount 为参考的类似案例数量

仅输出 JSON 对象。`;

// ─── Helpers ────────────────────────────────────────────────

function clampProb(value: number): number {
  if (typeof value !== 'number' || isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Normalize three probabilities so they sum to 1.0.
 * Handles edge case where all are zero by defaulting to equal distribution.
 */
export function normalizeProbabilities(
  win: number,
  lose: number,
  settle: number,
): { win: number; lose: number; settle: number } {
  const w = clampProb(win);
  const l = clampProb(lose);
  const s = clampProb(settle);
  const total = w + l + s;

  if (total === 0) {
    return { win: 1 / 3, lose: 1 / 3, settle: 1 / 3 };
  }

  return {
    win: w / total,
    lose: l / total,
    settle: s / total,
  };
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Predict case outcome probabilities using LLM.
 * Probabilities are normalized so win + lose + settle = 1.0 (±0.01 float tolerance).
 */
export async function predictOutcome(
  caseInfo: CaseSubmission,
): Promise<OutcomePrediction> {
  const gateway = getLLMGateway();

  const userContent = [
    `案件类型: ${caseInfo.caseType}`,
    `法域: ${caseInfo.jurisdiction === 'china' ? '中国' : '泰国'}`,
    `案件事实:\n${caseInfo.facts}`,
    `证据:\n${caseInfo.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
    `法律依据:\n${caseInfo.legalBasis.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
  ].join('\n\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: PREDICTION_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    const parsed = gateway.parseJSON<Record<string, unknown>>(response);

    const rawWin = typeof parsed.winProbability === 'number' ? parsed.winProbability : 0;
    const rawLose = typeof parsed.loseProbability === 'number' ? parsed.loseProbability : 0;
    const rawSettle = typeof parsed.settleProbability === 'number' ? parsed.settleProbability : 0;

    const normalized = normalizeProbabilities(rawWin, rawLose, rawSettle);

    const predictionBasis = typeof parsed.predictionBasis === 'string' ? parsed.predictionBasis : '';
    const similarCaseCount = typeof parsed.similarCaseCount === 'number' && parsed.similarCaseCount >= 0
      ? Math.round(parsed.similarCaseCount)
      : 0;

    return {
      winProbability: normalized.win,
      loseProbability: normalized.lose,
      settleProbability: normalized.settle,
      predictionBasis,
      similarCaseCount,
    };
  } catch {
    const fallback = normalizeProbabilities(0, 0, 0);
    return {
      winProbability: fallback.win,
      loseProbability: fallback.lose,
      settleProbability: fallback.settle,
      predictionBasis: '',
      similarCaseCount: 0,
    };
  }
}
