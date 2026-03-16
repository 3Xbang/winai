/**
 * Enhanced Contract Analyzer — Clause-level risk scoring & missing clause detection
 * Requirements: 26.1, 26.2
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface ClauseScores {
  legalCompliance: number;  // 0-100
  fairness: number;         // 0-100
  enforceability: number;   // 0-100
  completeness: number;     // 0-100
}

export interface ClauseRiskScore {
  clauseIndex: number;
  clauseText: string;
  scores: ClauseScores;
  overallScore: number;
}

export interface LawReference {
  lawName: string;
  article: string;
}

export interface MissingClause {
  clauseType: string;
  importance: 'CRITICAL' | 'IMPORTANT' | 'RECOMMENDED';
  recommendedText: string;
  legalBasis: LawReference[];
}

// ─── System Prompts ─────────────────────────────────────────

const CLAUSE_SCORING_PROMPT = `你是一位合同风险评估专家。请逐条分析合同条款，从四个维度评分（0-100）。

输出 JSON 格式：
{
  "clauses": [
    {
      "clauseIndex": 条款序号,
      "clauseText": "条款内容摘要",
      "scores": {
        "legalCompliance": 0-100,
        "fairness": 0-100,
        "enforceability": 0-100,
        "completeness": 0-100
      }
    }
  ]
}

仅输出 JSON 对象。`;

const MISSING_CLAUSE_PROMPT = `你是一位合同完整性审查专家。请检查合同是否缺少以下关键条款：
- 违约责任条款
- 不可抗力条款
- 争议解决条款
- 保密条款
- 知识产权归属条款
- 终止/解除条款

输出 JSON 格式：
{
  "missingClauses": [
    {
      "clauseType": "缺失条款类型",
      "importance": "CRITICAL|IMPORTANT|RECOMMENDED",
      "recommendedText": "建议补充的条款文本",
      "legalBasis": [{ "lawName": "法律名称", "article": "条款编号" }]
    }
  ]
}

仅输出 JSON 对象。`;

// ─── Helpers ────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

const VALID_IMPORTANCE = new Set(['CRITICAL', 'IMPORTANT', 'RECOMMENDED']);

function parseClause(raw: Record<string, unknown>): ClauseRiskScore {
  const scores = raw.scores as Record<string, unknown> | undefined;
  const s: ClauseScores = {
    legalCompliance: clamp(typeof scores?.legalCompliance === 'number' ? scores.legalCompliance : 0, 0, 100),
    fairness: clamp(typeof scores?.fairness === 'number' ? scores.fairness : 0, 0, 100),
    enforceability: clamp(typeof scores?.enforceability === 'number' ? scores.enforceability : 0, 0, 100),
    completeness: clamp(typeof scores?.completeness === 'number' ? scores.completeness : 0, 0, 100),
  };
  const overallScore = clamp(
    Math.round((s.legalCompliance + s.fairness + s.enforceability + s.completeness) / 4),
    0, 100,
  );
  return {
    clauseIndex: typeof raw.clauseIndex === 'number' ? raw.clauseIndex : 0,
    clauseText: typeof raw.clauseText === 'string' ? raw.clauseText : '',
    scores: s,
    overallScore,
  };
}

function parseMissing(raw: Record<string, unknown>): MissingClause {
  const importance = typeof raw.importance === 'string' && VALID_IMPORTANCE.has(raw.importance)
    ? (raw.importance as MissingClause['importance'])
    : 'RECOMMENDED';
  const legalBasis = Array.isArray(raw.legalBasis)
    ? (raw.legalBasis as Record<string, unknown>[]).map((lb) => ({
        lawName: typeof lb.lawName === 'string' ? lb.lawName : '',
        article: typeof lb.article === 'string' ? lb.article : '',
      }))
    : [];
  return {
    clauseType: typeof raw.clauseType === 'string' ? raw.clauseType : '',
    importance,
    recommendedText: typeof raw.recommendedText === 'string' ? raw.recommendedText : '',
    legalBasis,
  };
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Score each clause in a contract across 4 dimensions.
 */
export async function scoreClauseRisks(
  contractText: string,
  jurisdiction: string,
): Promise<ClauseRiskScore[]> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: CLAUSE_SCORING_PROMPT },
    { role: 'user', content: `法域: ${jurisdiction}\n\n合同内容:\n${contractText}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const clauses = Array.isArray(parsed.clauses) ? parsed.clauses as Record<string, unknown>[] : [];
    return clauses.map(parseClause);
  } catch {
    return [];
  }
}

/**
 * Detect missing clauses in a contract.
 */
export async function detectMissingClauses(
  contractText: string,
  contractType: string,
): Promise<MissingClause[]> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- contractType used in prompt
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: MISSING_CLAUSE_PROMPT },
    { role: 'user', content: `合同类型: ${contractType}\n\n合同内容:\n${contractText}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const missing = Array.isArray(parsed.missingClauses) ? parsed.missingClauses as Record<string, unknown>[] : [];
    return missing.map(parseMissing);
  } catch {
    return [];
  }
}


// ─── Unfair Terms Types ─────────────────────────────────────

export type UnfairnessLevel = 'MINOR' | 'MODERATE' | 'SEVERE';

export interface UnfairTerm {
  clauseIndex: number;
  clauseText: string;
  unfairnessLevel: UnfairnessLevel;
  explanation: string;
  balancedAlternative: string;
}

export interface LawCrossReference {
  clauseIndex: number;
  clauseText: string;
  relatedLaws: LawReference[];
  complianceStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'UNCERTAIN';
  analysis: string;
}

// ─── Unfair Terms Prompt ────────────────────────────────────

const UNFAIR_TERMS_PROMPT = `你是一位合同公平性审查专家。请分析合同中的不公平条款，评估权利义务对称性。

输出 JSON 格式：
{
  "unfairTerms": [
    {
      "clauseIndex": 条款序号,
      "clauseText": "条款内容",
      "unfairnessLevel": "MINOR|MODERATE|SEVERE",
      "explanation": "不公平原因说明",
      "balancedAlternative": "建议的公平替代条款"
    }
  ]
}

仅输出 JSON 对象。`;

const CROSS_REFERENCE_PROMPT = `你是一位法律合规审查专家。请将合同条款与相关强制性法规进行交叉验证。

输出 JSON 格式：
{
  "references": [
    {
      "clauseIndex": 条款序号,
      "clauseText": "条款内容",
      "relatedLaws": [{ "lawName": "法律名称", "article": "条款编号" }],
      "complianceStatus": "COMPLIANT|NON_COMPLIANT|UNCERTAIN",
      "analysis": "合规分析说明"
    }
  ]
}

仅输出 JSON 对象。`;

// ─── Unfair Terms Helpers ───────────────────────────────────

const VALID_UNFAIRNESS = new Set<string>(['MINOR', 'MODERATE', 'SEVERE']);
const VALID_COMPLIANCE = new Set<string>(['COMPLIANT', 'NON_COMPLIANT', 'UNCERTAIN']);

function parseUnfairTerm(raw: Record<string, unknown>): UnfairTerm {
  return {
    clauseIndex: typeof raw.clauseIndex === 'number' ? raw.clauseIndex : 0,
    clauseText: typeof raw.clauseText === 'string' ? raw.clauseText : '',
    unfairnessLevel: typeof raw.unfairnessLevel === 'string' && VALID_UNFAIRNESS.has(raw.unfairnessLevel)
      ? (raw.unfairnessLevel as UnfairnessLevel)
      : 'MINOR',
    explanation: typeof raw.explanation === 'string' ? raw.explanation : '',
    balancedAlternative: typeof raw.balancedAlternative === 'string' ? raw.balancedAlternative : '',
  };
}

function parseCrossRef(raw: Record<string, unknown>): LawCrossReference {
  const relatedLaws = Array.isArray(raw.relatedLaws)
    ? (raw.relatedLaws as Record<string, unknown>[]).map((lb) => ({
        lawName: typeof lb.lawName === 'string' ? lb.lawName : '',
        article: typeof lb.article === 'string' ? lb.article : '',
      }))
    : [];
  return {
    clauseIndex: typeof raw.clauseIndex === 'number' ? raw.clauseIndex : 0,
    clauseText: typeof raw.clauseText === 'string' ? raw.clauseText : '',
    relatedLaws,
    complianceStatus: typeof raw.complianceStatus === 'string' && VALID_COMPLIANCE.has(raw.complianceStatus)
      ? (raw.complianceStatus as LawCrossReference['complianceStatus'])
      : 'UNCERTAIN',
    analysis: typeof raw.analysis === 'string' ? raw.analysis : '',
  };
}

// ─── Unfair Terms & Cross-Reference API ─────────────────────

/**
 * Detect unfair terms in a contract. Requirements: 26.3
 */
export async function detectUnfairTerms(
  contractText: string,
): Promise<UnfairTerm[]> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: UNFAIR_TERMS_PROMPT },
    { role: 'user', content: contractText },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const terms = Array.isArray(parsed.unfairTerms) ? parsed.unfairTerms as Record<string, unknown>[] : [];
    return terms.map(parseUnfairTerm);
  } catch {
    return [];
  }
}

/**
 * Cross-reference contract clauses with mandatory laws. Requirements: 26.4
 */
export async function crossReferenceWithLaw(
  contractText: string,
  jurisdiction: string,
): Promise<LawCrossReference[]> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: CROSS_REFERENCE_PROMPT },
    { role: 'user', content: `法域: ${jurisdiction}\n\n合同内容:\n${contractText}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const refs = Array.isArray(parsed.references) ? parsed.references as Record<string, unknown>[] : [];
    return refs.map(parseCrossRef);
  } catch {
    return [];
  }
}


// ─── Contract Comparison & Negotiation Types ────────────────

export interface ClauseChange {
  clauseIndex: number;
  oldText?: string;
  newText?: string;
  changeType: 'ADDED' | 'DELETED' | 'MODIFIED';
  legalImpact: string;
  riskChange: 'INCREASED' | 'DECREASED' | 'NEUTRAL';
}

export interface ContractComparison {
  additions: ClauseChange[];
  deletions: ClauseChange[];
  modifications: ClauseChange[];
  legalImpactSummary: string;
}

export interface NegotiationAdvice {
  clauseIndex: number;
  suggestedPosition: string;
  acceptableConcessions: string[];
  bottomLine: string;
}

// ─── Comparison & Negotiation Prompts ───────────────────────

const COMPARE_PROMPT = `你是一位合同对比分析专家。请对比两个版本的合同，找出新增、删除和修改的条款。

输出 JSON 格式：
{
  "additions": [{ "clauseIndex": 序号, "newText": "新增内容", "changeType": "ADDED", "legalImpact": "法律影响", "riskChange": "INCREASED|DECREASED|NEUTRAL" }],
  "deletions": [{ "clauseIndex": 序号, "oldText": "删除内容", "changeType": "DELETED", "legalImpact": "法律影响", "riskChange": "INCREASED|DECREASED|NEUTRAL" }],
  "modifications": [{ "clauseIndex": 序号, "oldText": "原文", "newText": "修改后", "changeType": "MODIFIED", "legalImpact": "法律影响", "riskChange": "INCREASED|DECREASED|NEUTRAL" }],
  "legalImpactSummary": "总体法律影响摘要"
}

仅输出 JSON 对象。`;

const NEGOTIATION_PROMPT = `你是一位合同谈判策略专家。请根据合同条款和客户立场，生成谈判建议。

输出 JSON 格式：
{
  "advice": [
    {
      "clauseIndex": 条款序号,
      "suggestedPosition": "建议谈判立场",
      "acceptableConcessions": ["可接受的让步1", "可接受的让步2"],
      "bottomLine": "底线条款"
    }
  ]
}

仅输出 JSON 对象。`;

// ─── Comparison & Negotiation Helpers ───────────────────────

const VALID_CHANGE_TYPE = new Set(['ADDED', 'DELETED', 'MODIFIED']);
const VALID_RISK_CHANGE = new Set(['INCREASED', 'DECREASED', 'NEUTRAL']);

function parseChange(raw: Record<string, unknown>): ClauseChange {
  return {
    clauseIndex: typeof raw.clauseIndex === 'number' ? raw.clauseIndex : 0,
    oldText: typeof raw.oldText === 'string' ? raw.oldText : undefined,
    newText: typeof raw.newText === 'string' ? raw.newText : undefined,
    changeType: typeof raw.changeType === 'string' && VALID_CHANGE_TYPE.has(raw.changeType)
      ? (raw.changeType as ClauseChange['changeType'])
      : 'MODIFIED',
    legalImpact: typeof raw.legalImpact === 'string' ? raw.legalImpact : '',
    riskChange: typeof raw.riskChange === 'string' && VALID_RISK_CHANGE.has(raw.riskChange)
      ? (raw.riskChange as ClauseChange['riskChange'])
      : 'NEUTRAL',
  };
}

function parseAdvice(raw: Record<string, unknown>): NegotiationAdvice {
  const concessions = Array.isArray(raw.acceptableConcessions)
    ? (raw.acceptableConcessions as unknown[]).filter((c): c is string => typeof c === 'string')
    : [];
  return {
    clauseIndex: typeof raw.clauseIndex === 'number' ? raw.clauseIndex : 0,
    suggestedPosition: typeof raw.suggestedPosition === 'string' ? raw.suggestedPosition : '',
    acceptableConcessions: concessions,
    bottomLine: typeof raw.bottomLine === 'string' ? raw.bottomLine : '',
  };
}

// ─── Comparison & Negotiation API ───────────────────────────

/**
 * Compare two contract versions and analyze legal impact. Requirements: 26.5
 */
export async function compareContracts(
  version1: string,
  version2: string,
): Promise<ContractComparison> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: COMPARE_PROMPT },
    { role: 'user', content: `版本1:\n${version1}\n\n版本2:\n${version2}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.2,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const toChanges = (arr: unknown) =>
      Array.isArray(arr) ? (arr as Record<string, unknown>[]).map(parseChange) : [];

    return {
      additions: toChanges(parsed.additions),
      deletions: toChanges(parsed.deletions),
      modifications: toChanges(parsed.modifications),
      legalImpactSummary: typeof parsed.legalImpactSummary === 'string' ? parsed.legalImpactSummary : '',
    };
  } catch {
    return { additions: [], deletions: [], modifications: [], legalImpactSummary: '' };
  }
}

/**
 * Generate negotiation advice for contract clauses. Requirements: 26.7
 */
export async function getNegotiationAdvice(
  contractText: string,
  clientSide: string,
): Promise<NegotiationAdvice[]> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: NEGOTIATION_PROMPT },
    { role: 'user', content: `客户立场: ${clientSide}\n\n合同内容:\n${contractText}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
    });
    const parsed = gateway.parseJSON<Record<string, unknown>>(response);
    const advice = Array.isArray(parsed.advice) ? parsed.advice as Record<string, unknown>[] : [];
    return advice.map(parseAdvice);
  } catch {
    return [];
  }
}
