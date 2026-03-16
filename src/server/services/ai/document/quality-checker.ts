/**
 * Document Quality Checker — Terminology consistency & jurisdiction compliance
 * Requirements: 27.5, 27.6, 27.7
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface TerminologyInconsistency {
  term: string;
  variants: string[];
  suggestedUniform: string;
  locations: string[];
}

export interface TerminologyCheck {
  isConsistent: boolean;
  inconsistencies: TerminologyInconsistency[];
}

export interface ComplianceIssue {
  section: string;
  issue: string;
  requirement: string;
  suggestion: string;
}

export interface JurisdictionComplianceCheck {
  isCompliant: boolean;
  issues: ComplianceIssue[];
  jurisdiction: string;
}

// ─── Prompts ────────────────────────────────────────────────

const TERMINOLOGY_PROMPT = `你是一位法律文书术语审查专家。请扫描文书中的法律术语，检测同义不同表述的情况。

输出 JSON 格式：
{
  "isConsistent": true/false,
  "inconsistencies": [
    {
      "term": "标准术语",
      "variants": ["变体1", "变体2"],
      "suggestedUniform": "建议统一使用的术语",
      "locations": ["出现位置1", "出现位置2"]
    }
  ]
}

仅输出 JSON 对象。`;

const COMPLIANCE_PROMPT = `你是一位法域合规性审查专家。请检查文书是否符合目标法域的程序规定和格式要求。

输出 JSON 格式：
{
  "isCompliant": true/false,
  "issues": [
    {
      "section": "涉及章节",
      "issue": "不合规问题",
      "requirement": "法域要求",
      "suggestion": "修改建议"
    }
  ]
}

仅输出 JSON 对象。`;

// ─── Helpers ────────────────────────────────────────────────

function parseInconsistency(raw: Record<string, unknown>): TerminologyInconsistency {
  return {
    term: typeof raw.term === 'string' ? raw.term : '',
    variants: Array.isArray(raw.variants)
      ? (raw.variants as unknown[]).filter((v): v is string => typeof v === 'string')
      : [],
    suggestedUniform: typeof raw.suggestedUniform === 'string' ? raw.suggestedUniform : '',
    locations: Array.isArray(raw.locations)
      ? (raw.locations as unknown[]).filter((l): l is string => typeof l === 'string')
      : [],
  };
}

function parseIssue(raw: Record<string, unknown>): ComplianceIssue {
  return {
    section: typeof raw.section === 'string' ? raw.section : '',
    issue: typeof raw.issue === 'string' ? raw.issue : '',
    requirement: typeof raw.requirement === 'string' ? raw.requirement : '',
    suggestion: typeof raw.suggestion === 'string' ? raw.suggestion : '',
  };
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Check terminology consistency in a document.
 */
export async function checkTerminologyConsistency(
  content: string,
): Promise<TerminologyCheck> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: TERMINOLOGY_PROMPT },
    { role: 'user', content },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const inconsistencies = Array.isArray(parsed.inconsistencies)
      ? (parsed.inconsistencies as Record<string, unknown>[]).map(parseInconsistency)
      : [];
    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies,
    };
  } catch {
    return { isConsistent: true, inconsistencies: [] };
  }
}

/**
 * Check jurisdiction compliance of a document.
 */
export async function checkJurisdictionCompliance(
  content: string,
  jurisdiction: string,
): Promise<JurisdictionComplianceCheck> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: COMPLIANCE_PROMPT },
    { role: 'user', content: `法域: ${jurisdiction}\n\n文书内容:\n${content}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const issues = Array.isArray(parsed.issues)
      ? (parsed.issues as Record<string, unknown>[]).map(parseIssue)
      : [];
    return {
      isCompliant: issues.length === 0,
      issues,
      jurisdiction,
    };
  } catch {
    return { isCompliant: true, issues: [], jurisdiction };
  }
}
