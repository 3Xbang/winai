/**
 * Scenario Simulator — Modify risk parameters and re-assess via LLM
 * Compares baseline vs simulated assessment to produce impact analysis.
 * Requirements: 25.3
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { RiskAssessmentResult, RiskDimensions } from './assessor';
import { computeOverallLevel } from './assessor';

// ─── Types ──────────────────────────────────────────────────

export interface ScenarioSimulation {
  baselineAssessment: RiskAssessmentResult;
  modifiedParameters: Record<string, unknown>;
  simulatedAssessment: RiskAssessmentResult;
  impactAnalysis: string;
}

// ─── System Prompt ──────────────────────────────────────────

const SIMULATION_PROMPT = `你是一位法律风险场景模拟专家。给定一个基线风险评估结果和一组修改参数，请重新评估风险。

输出 JSON 格式：
{
  "dimensions": {
    "legal": 0-100,
    "financial": 0-100,
    "compliance": 0-100,
    "reputation": 0-100
  },
  "details": "模拟场景下的风险评估说明",
  "impactAnalysis": "参数变化对风险的影响分析"
}

仅输出 JSON 对象。`;

// ─── Helpers ────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Simulate a scenario by modifying parameters and re-assessing risk via LLM.
 * Returns both baseline and simulated assessments with impact analysis.
 */
export async function simulateScenario(
  baseAssessment: RiskAssessmentResult,
  modifiedParams: Record<string, unknown>,
): Promise<ScenarioSimulation> {
  const gateway = getLLMGateway();

  const userContent = [
    '基线风险评估结果：',
    JSON.stringify(baseAssessment.dimensions, null, 2),
    `基线风险等级: ${baseAssessment.overallLevel}`,
    '',
    '修改参数：',
    JSON.stringify(modifiedParams, null, 2),
    '',
    '请根据修改参数重新评估风险维度评分，并分析参数变化对风险的影响。',
  ].join('\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: SIMULATION_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
    });

    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const rawDims = parsed.dimensions as Record<string, unknown> | undefined;

    const dimensions: RiskDimensions = {
      legal: clamp(typeof rawDims?.legal === 'number' ? rawDims.legal : baseAssessment.dimensions.legal, 0, 100),
      financial: clamp(typeof rawDims?.financial === 'number' ? rawDims.financial : baseAssessment.dimensions.financial, 0, 100),
      compliance: clamp(typeof rawDims?.compliance === 'number' ? rawDims.compliance : baseAssessment.dimensions.compliance, 0, 100),
      reputation: clamp(typeof rawDims?.reputation === 'number' ? rawDims.reputation : baseAssessment.dimensions.reputation, 0, 100),
    };

    const overallLevel = computeOverallLevel(dimensions);
    const details = typeof parsed.details === 'string' ? parsed.details : '';
    const impactAnalysis = typeof parsed.impactAnalysis === 'string' ? parsed.impactAnalysis : '';

    return {
      baselineAssessment: baseAssessment,
      modifiedParameters: modifiedParams,
      simulatedAssessment: { dimensions, overallLevel, heatMapData: [], details },
      impactAnalysis,
    };
  } catch {
    // Graceful degradation: return baseline as simulated
    return {
      baselineAssessment: baseAssessment,
      modifiedParameters: modifiedParams,
      simulatedAssessment: { ...baseAssessment },
      impactAnalysis: '',
    };
  }
}
