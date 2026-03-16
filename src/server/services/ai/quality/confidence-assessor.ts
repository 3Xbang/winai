/**
 * Confidence Assessor — LLM self-assessment of response confidence
 * Requirements: 30.3, 30.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface ConfidenceAssessment {
  messageId: string;
  score: number; // 0-100
  needsReview: boolean;
  needsEscalation: boolean;
}

// ─── Consecutive Tracking (production: Redis) ───────────────

const consecutiveLowScores = new Map<string, number>();

// ─── Prompt ─────────────────────────────────────────────────

const CONFIDENCE_PROMPT = `请评估你刚才回复的置信度（0-100分）。
输出 JSON 格式：{ "score": 0-100 }
仅输出 JSON 对象。`;

// ─── Public API ─────────────────────────────────────────────

export async function assessConfidence(
  messageId: string,
  sessionId: string,
  responseContent: string,
): Promise<ConfidenceAssessment> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: CONFIDENCE_PROMPT },
    { role: 'user', content: `回复内容:\n${responseContent}` },
  ];

  let score = 50;
  try {
    const response = await gateway.chat(messages, {
      temperature: 0,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    if (typeof parsed.score === 'number') {
      score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    }
  } catch {
    // Default to 50 on failure
  }

  const needsReview = score < 60;

  // Track consecutive low scores
  let consecutive = consecutiveLowScores.get(sessionId) ?? 0;
  if (score < 50) {
    consecutive += 1;
  } else {
    consecutive = 0;
  }
  consecutiveLowScores.set(sessionId, consecutive);

  const needsEscalation = consecutive >= 2;

  return { messageId, score, needsReview, needsEscalation };
}

export function clearConsecutiveTracking(): void {
  consecutiveLowScores.clear();
}
