/**
 * Smart QA — Quick answer & deep analysis modes
 * Quick mode: FAQ matching + concise LLM response (target <5s)
 * Deep mode: Multi-step pipeline (facts → law → analysis → strategy → action)
 * Requirements: 28.1, 28.2
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface QuickQARequest {
  question: string;
  jurisdiction?: 'china' | 'thailand';
  language?: string;
}

export interface DeepAnalysisRequest {
  question: string;
  jurisdiction: 'china' | 'thailand';
  facts?: string;
  evidence?: string[];
}

export interface DeepAnalysisResult {
  factExtraction: string;
  lawApplication: string;
  riskAssessment: string;
  strategySuggestion: string;
  actionPlan: string[];
}

// ─── Prompts ────────────────────────────────────────────────

const QUICK_QA_PROMPT = `你是一位法律咨询助手。请简洁准确地回答用户的法律问题。
回答要求：简明扼要，直接给出答案和关键法条引用。`;

const DEEP_ANALYSIS_PROMPT = `你是一位资深法律分析专家。请对用户的法律问题进行深度分析，按以下五个步骤输出。

输出 JSON 格式：
{
  "factExtraction": "事实提取与整理",
  "lawApplication": "适用法律检索与分析",
  "riskAssessment": "风险评估",
  "strategySuggestion": "策略建议",
  "actionPlan": ["行动方案步骤1", "行动方案步骤2", ...]
}

仅输出 JSON 对象。`;

// ─── Public API ─────────────────────────────────────────────

/**
 * Quick answer mode — concise response targeting <5s.
 */
export async function quickAnswer(request: QuickQARequest): Promise<string> {
  const gateway = getLLMGateway();

  const jLabel = request.jurisdiction === 'thailand' ? '泰国' : '中国';
  const messages: LLMMessage[] = [
    { role: 'system', content: QUICK_QA_PROMPT },
    { role: 'user', content: `法域: ${jLabel}\n\n问题: ${request.question}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.3,
      maxTokens: 512,
    });
    return response.content;
  } catch {
    return '';
  }
}

/**
 * Deep analysis mode — multi-step pipeline targeting <30s.
 */
export async function deepAnalysis(request: DeepAnalysisRequest): Promise<DeepAnalysisResult> {
  const gateway = getLLMGateway();

  const parts = [
    `法域: ${request.jurisdiction === 'thailand' ? '泰国' : '中国'}`,
    `问题: ${request.question}`,
  ];
  if (request.facts) parts.push(`案件事实:\n${request.facts}`);
  if (request.evidence?.length) {
    parts.push(`证据:\n${request.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`);
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: DEEP_ANALYSIS_PROMPT },
    { role: 'user', content: parts.join('\n\n') },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);

    return {
      factExtraction: typeof parsed.factExtraction === 'string' ? parsed.factExtraction : '',
      lawApplication: typeof parsed.lawApplication === 'string' ? parsed.lawApplication : '',
      riskAssessment: typeof parsed.riskAssessment === 'string' ? parsed.riskAssessment : '',
      strategySuggestion: typeof parsed.strategySuggestion === 'string' ? parsed.strategySuggestion : '',
      actionPlan: Array.isArray(parsed.actionPlan)
        ? (parsed.actionPlan as unknown[]).filter((a): a is string => typeof a === 'string')
        : [],
    };
  } catch {
    return { factExtraction: '', lawApplication: '', riskAssessment: '', strategySuggestion: '', actionPlan: [] };
  }
}
