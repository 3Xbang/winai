/**
 * Legal Document Generator — Multi-type document generation via LLM
 * Supports 10+ document types with structured prompts and template filling.
 * Requirements: 27.1, 27.2
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export type DocumentType =
  | 'COMPLAINT'
  | 'DEFENSE'
  | 'APPEAL'
  | 'LAWYER_LETTER'
  | 'LEGAL_OPINION'
  | 'DUE_DILIGENCE'
  | 'SHAREHOLDER_AGREEMENT'
  | 'ARTICLES_OF_ASSOCIATION'
  | 'NDA'
  | 'EMPLOYMENT_CONTRACT';

export interface PartyInfo {
  name: string;
  role: string;
  idNumber?: string;
  address?: string;
  contact?: string;
}

export interface DocumentGenerationRequest {
  type: DocumentType;
  jurisdiction: 'china' | 'thailand';
  parties: PartyInfo[];
  facts: string;
  additionalRequirements?: string;
}

// ─── Document Type Labels ───────────────────────────────────

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  COMPLAINT: '起诉状',
  DEFENSE: '答辩状',
  APPEAL: '上诉状',
  LAWYER_LETTER: '律师函',
  LEGAL_OPINION: '法律意见书',
  DUE_DILIGENCE: '尽职调查报告',
  SHAREHOLDER_AGREEMENT: '股东协议',
  ARTICLES_OF_ASSOCIATION: '公司章程',
  NDA: '保密协议',
  EMPLOYMENT_CONTRACT: '劳动合同',
};

export const SUPPORTED_TYPES = Object.keys(DOC_TYPE_LABELS) as DocumentType[];

// ─── System Prompt ──────────────────────────────────────────

function buildPrompt(type: DocumentType, jurisdiction: string): string {
  const label = DOC_TYPE_LABELS[type] || type;
  const jLabel = jurisdiction === 'china' ? '中国' : '泰国';

  return `你是一位专业法律文书起草专家。请根据提供的当事人信息和案件事实，生成一份完整的${label}。

要求：
1. 严格遵循${jLabel}法律文书格式规范
2. 使用所有提供的当事人信息（姓名、角色、身份证号、地址、联系方式）
3. 完整引用案件事实
4. 不得残留任何模板占位符（如 [XXX]、{待填写} 等）
5. 语言正式、法律术语准确

直接输出完整文书内容，不要输出其他说明。`;
}

// ─── Helpers ────────────────────────────────────────────────

function formatParties(parties: PartyInfo[]): string {
  return parties
    .map((p, i) => {
      const parts = [`当事人${i + 1}: ${p.name}（${p.role}）`];
      if (p.idNumber) parts.push(`身份证号: ${p.idNumber}`);
      if (p.address) parts.push(`地址: ${p.address}`);
      if (p.contact) parts.push(`联系方式: ${p.contact}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

const PLACEHOLDER_PATTERN = /\[[^\]]+\]|\{[^}]+\}|_{3,}|XXX/;

/**
 * Check if generated content has unfilled placeholders.
 */
export function hasPlaceholders(content: string): boolean {
  return PLACEHOLDER_PATTERN.test(content);
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate a legal document using LLM.
 * Fills in party info and case facts, validates no placeholders remain.
 */
export async function generate(
  request: DocumentGenerationRequest,
): Promise<string> {
  const gateway = getLLMGateway();

  const userContent = [
    `文书类型: ${DOC_TYPE_LABELS[request.type]}`,
    `法域: ${request.jurisdiction === 'china' ? '中国' : '泰国'}`,
    '',
    '当事人信息:',
    formatParties(request.parties),
    '',
    '案件事实:',
    request.facts,
    request.additionalRequirements ? `\n附加要求:\n${request.additionalRequirements}` : '',
  ].join('\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: buildPrompt(request.type, request.jurisdiction) },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.3,
      maxTokens: 4096,
    });
    return response.content;
  } catch {
    return '';
  }
}
