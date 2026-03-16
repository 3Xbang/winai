/**
 * Evidence Checklist Generator — AI-powered evidence checklist generation
 * Uses LLM Gateway to generate prioritized evidence checklists for case analysis.
 * Requirements: 22.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export type EvidencePriority = 'ESSENTIAL' | 'IMPORTANT' | 'SUPPLEMENTARY';

export interface CaseAnalysisResult {
  caseType: string;
  jurisdiction: 'china' | 'thailand';
  facts: string;
  parties: string[];
}

export interface EvidenceChecklistItem {
  name: string;
  description: string;
  priority: EvidencePriority;
  evidenceType: string; // e.g., 'documentary', 'testimonial', 'physical', 'digital'
  collectionSuggestion: string;
  isObtained: boolean;
}

// ─── Valid Values ───────────────────────────────────────────

const VALID_PRIORITIES: EvidencePriority[] = ['ESSENTIAL', 'IMPORTANT', 'SUPPLEMENTARY'];

// ─── System Prompt ──────────────────────────────────────────

export const EVIDENCE_CHECKLIST_PROMPT = `你是一位资深法律证据分析专家。请根据用户提供的案件分析结果，生成一份完整的证据收集清单。

输出要求：
- 以 JSON 数组格式输出，每个元素为一个证据项对象
- 每个证据项包含以下字段：
  - "name": 证据名称（简明扼要）
  - "description": 证据描述（说明该证据的内容和作用）
  - "priority": 优先级，取值为 "ESSENTIAL"（必要）、"IMPORTANT"（重要）、"SUPPLEMENTARY"（补充）
  - "evidenceType": 证据类型，取值为 "documentary"（书证）、"testimonial"（证人证言）、"physical"（物证）、"digital"（电子数据）
  - "collectionSuggestion": 获取建议（说明如何收集该证据）
  - "isObtained": 是否已获取，默认为 false

优先级标注规则：
- ESSENTIAL：对案件胜败起决定性作用的核心证据
- IMPORTANT：能显著增强案件说服力的重要证据
- SUPPLEMENTARY：起辅助证明作用的补充证据

请确保：
- 证据清单覆盖案件的所有关键争议焦点
- 每项证据都有明确的获取建议
- 证据类型分类准确
- 仅输出 JSON 数组，不要输出其他内容

Generate an evidence checklist based on the case analysis. Output as a JSON array of evidence items with priority, type, and collection suggestions.`;

// ─── Evidence Checklist Generation ──────────────────────────

/**
 * Generate an evidence checklist from case analysis using LLM.
 * Returns EvidenceChecklistItem[] or empty array on failure.
 */
export async function generateEvidenceChecklist(
  caseAnalysis: CaseAnalysisResult,
): Promise<EvidenceChecklistItem[]> {
  const gateway = getLLMGateway();

  const userContent = [
    `案件类型/Case Type: ${caseAnalysis.caseType}`,
    `法域/Jurisdiction: ${caseAnalysis.jurisdiction === 'china' ? '中国' : '泰国/Thailand'}`,
    `当事人/Parties: ${caseAnalysis.parties.join(', ')}`,
    `案件事实/Facts:\n${caseAnalysis.facts}`,
  ].join('\n\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: EVIDENCE_CHECKLIST_PROMPT },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });

    const parsed = gateway.parseJSON<EvidenceChecklistItem[] | { checklist: EvidenceChecklistItem[] }>(response);

    const items = Array.isArray(parsed) ? parsed : (parsed as { checklist: EvidenceChecklistItem[] }).checklist;

    if (!Array.isArray(items)) {
      return [];
    }

    // Validate and normalize each item
    return items.map((item) => ({
      name: item.name || '',
      description: item.description || '',
      priority: VALID_PRIORITIES.includes(item.priority) ? item.priority : 'SUPPLEMENTARY',
      evidenceType: item.evidenceType || 'documentary',
      collectionSuggestion: item.collectionSuggestion || '',
      isObtained: typeof item.isObtained === 'boolean' ? item.isObtained : false,
    }));
  } catch {
    return [];
  }
}
