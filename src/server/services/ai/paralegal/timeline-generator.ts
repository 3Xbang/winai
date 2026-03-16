/**
 * Timeline Generator — AI-powered case timeline extraction
 * Uses LLM Gateway to extract chronological events from case descriptions.
 * Requirements: 22.3
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface TimelineNode {
  date: string;           // ISO date or descriptive date
  description: string;    // What happened
  legalSignificance: string; // Why it matters legally
  category: 'filing' | 'hearing' | 'deadline' | 'event' | 'agreement' | 'breach' | 'other';
}

// ─── System Prompt ──────────────────────────────────────────

export const TIMELINE_SYSTEM_PROMPT = `你是一位资深法律案件时间线分析专家。请从用户提供的案件描述中提取所有关键时间节点，生成按时间升序排列的案件时间线。

输出要求：
- 以 JSON 数组格式输出，每个元素为一个时间节点对象
- 每个节点包含以下字段：
  - "date": 日期（ISO 格式如 "2024-01-15"，或描述性日期如 "2023年初"）
  - "description": 事件描述（简明扼要）
  - "legalSignificance": 法律意义标注（说明该事件在法律上的重要性）
  - "category": 事件类别，取值为 "filing"（立案/起诉）、"hearing"（庭审）、"deadline"（截止日期）、"event"（一般事件）、"agreement"（协议/合同）、"breach"（违约/违法）、"other"（其他）
- 按日期升序排列
- 仅输出 JSON 数组，不要输出其他内容

Extract all key timeline events from the case description. Output as a JSON array of timeline nodes sorted by date ascending.`;

// ─── Timeline Generation ────────────────────────────────────

/**
 * Generate a chronological timeline from a case description using LLM.
 * Returns sorted TimelineNode[] or empty array on failure.
 */
export async function generateTimeline(caseDescription: string): Promise<TimelineNode[]> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: TIMELINE_SYSTEM_PROMPT },
    { role: 'user', content: caseDescription },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    const parsed = gateway.parseJSON<TimelineNode[] | { timeline: TimelineNode[] }>(response);

    // Handle both direct array and wrapped object responses
    const nodes = Array.isArray(parsed) ? parsed : (parsed as { timeline: TimelineNode[] }).timeline;

    if (!Array.isArray(nodes)) {
      return [];
    }

    // Sort by date ascending
    return nodes.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateA.localeCompare(dateB);
    });
  } catch {
    // Return empty array on any parsing or LLM failure
    return [];
  }
}
