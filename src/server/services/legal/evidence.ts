/**
 * Evidence Organizer (证据组织器)
 * Handles evidence collection guidance, checklist generation, strength assessment, and gap identification.
 * Provides evidence type classification, probative value assessment, and legality risk annotation.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { LegalIssue } from './case-analyzer';

// ─── Types ──────────────────────────────────────────────────

export type EvidenceType = 'DOCUMENTARY' | 'PHYSICAL' | 'TESTIMONY' | 'ELECTRONIC' | 'EXPERT_OPINION';
export type EvidenceStrength = 'STRONG' | 'MEDIUM' | 'WEAK';
export type GapImportance = 'CRITICAL' | 'IMPORTANT' | 'OPTIONAL';

export interface EvidenceItem {
  description: string;
  type: EvidenceType;
  strength: EvidenceStrength;
  strengthReason: string;
  legalityRisk?: string;
  alternativeCollection?: string;
}

export interface EvidenceAssessment {
  overallStrength: EvidenceStrength;
  items: EvidenceItem[];
  summary: string;
}

export interface EvidenceGap {
  issue: string;
  missingEvidence: string;
  importance: GapImportance;
  suggestion: string;
}

// ─── Constants ──────────────────────────────────────────────

const VALID_EVIDENCE_TYPES: EvidenceType[] = ['DOCUMENTARY', 'PHYSICAL', 'TESTIMONY', 'ELECTRONIC', 'EXPERT_OPINION'];
const VALID_STRENGTHS: EvidenceStrength[] = ['STRONG', 'MEDIUM', 'WEAK'];
const VALID_GAP_IMPORTANCES: GapImportance[] = ['CRITICAL', 'IMPORTANT', 'OPTIONAL'];

export const EVIDENCE_CHECKLIST_SYSTEM_PROMPT = `你是一位精通中国法律和泰国法律的资深证据分析专家。你的任务是根据案件争议焦点，生成需要收集的证据清单。

## 证据类型分类
- DOCUMENTARY（书证）：合同、协议、收据、发票、银行流水、通知函、公证书等书面文件
- PHYSICAL（物证）：实物证据、现场照片、损坏物品等
- TESTIMONY（证人证言）：证人陈述、当事人陈述、专家证人等
- ELECTRONIC（电子数据）：电子邮件、微信/Line聊天记录、短信、录音、录像、系统日志等
- EXPERT_OPINION（专家意见）：鉴定报告、评估报告、审计报告等

## 证明力评估标准
- STRONG（强）：直接证明争议事实，来源可靠，形式合法，难以被推翻
- MEDIUM（中）：间接证明争议事实，或需要与其他证据配合使用
- WEAK（弱）：证明力有限，可能被质疑或推翻

## 合法性风险标注
- 如果证据可能存在合法性问题（如非法取得、侵犯隐私、未经授权录音等），必须标注 legalityRisk
- 当 legalityRisk 非空时，必须同时提供 alternativeCollection（替代取证方式）

## 输出格式（严格 JSON）
{
  "evidenceItems": [
    {
      "description": "证据描述",
      "type": "DOCUMENTARY|PHYSICAL|TESTIMONY|ELECTRONIC|EXPERT_OPINION",
      "strength": "STRONG|MEDIUM|WEAK",
      "strengthReason": "证明力评估理由",
      "legalityRisk": "合法性风险说明（可选，无风险时为空字符串）",
      "alternativeCollection": "替代取证方式（当legalityRisk非空时必填）"
    }
  ]
}

## 重要规则
- 每个证据项必须包含 description、type、strength、strengthReason
- type 必须是五种类型之一
- strength 必须是 STRONG/MEDIUM/WEAK 之一
- 当 legalityRisk 非空时，alternativeCollection 也必须非空
- 至少生成一项证据`;

export const EVIDENCE_CHECKLIST_USER_PROMPT_TEMPLATE = `请根据以下案件争议焦点，生成需要收集的证据清单：

争议焦点：
{{issues}}

请严格按照 JSON 格式输出证据清单。`;

export const EVIDENCE_ASSESSMENT_SYSTEM_PROMPT = `你是一位精通中国法律和泰国法律的资深证据评估专家。你的任务是对已有证据进行整体证明力评估。

## 评估维度
1. 证据链完整性：证据之间是否形成完整的证明链条
2. 关键证据强度：核心证据的证明力是否足够
3. 证据合法性：是否存在合法性风险
4. 证据充分性：证据数量和质量是否足以支持诉讼请求

## 整体评估标准
- STRONG：证据链完整，关键证据证明力强，无合法性风险
- MEDIUM：证据链基本完整，但存在薄弱环节或部分证据证明力不足
- WEAK：证据链不完整，关键证据缺失或证明力不足

## 输出格式（严格 JSON）
{
  "overallStrength": "STRONG|MEDIUM|WEAK",
  "items": [
    {
      "description": "证据描述",
      "type": "DOCUMENTARY|PHYSICAL|TESTIMONY|ELECTRONIC|EXPERT_OPINION",
      "strength": "STRONG|MEDIUM|WEAK",
      "strengthReason": "证明力评估理由",
      "legalityRisk": "合法性风险（可选）",
      "alternativeCollection": "替代取证方式（当legalityRisk非空时必填）"
    }
  ],
  "summary": "整体评估总结"
}

## 重要规则
- overallStrength 必须是 STRONG/MEDIUM/WEAK 之一
- items 数组必须包含对每项输入证据的评估
- summary 必须非空
- 当 legalityRisk 非空时，alternativeCollection 也必须非空`;

export const EVIDENCE_ASSESSMENT_USER_PROMPT_TEMPLATE = `请对以下证据进行整体证明力评估：

证据清单：
{{evidence}}

请严格按照 JSON 格式输出评估结果。`;

export const EVIDENCE_GAPS_SYSTEM_PROMPT = `你是一位精通中国法律和泰国法律的资深证据分析专家。你的任务是识别证据链中的薄弱环节，指出缺失的证据并建议补充方向。

## 分析步骤
1. 对照每个争议焦点，检查现有证据是否充分
2. 识别证据链中的缺口
3. 评估缺失证据的重要性
4. 提供补充证据的具体建议

## 重要性等级
- CRITICAL（关键）：缺失此证据将严重影响案件结果
- IMPORTANT（重要）：缺失此证据会削弱论证力度
- OPTIONAL（可选）：补充此证据可以加强论证但非必需

## 输出格式（严格 JSON）
{
  "gaps": [
    {
      "issue": "对应的争议焦点",
      "missingEvidence": "缺失的证据描述",
      "importance": "CRITICAL|IMPORTANT|OPTIONAL",
      "suggestion": "补充证据的具体建议"
    }
  ]
}

## 重要规则
- 每个 gap 必须关联一个争议焦点
- importance 必须是 CRITICAL/IMPORTANT/OPTIONAL 之一
- suggestion 必须非空
- 至少识别一个证据缺口`;

export const EVIDENCE_GAPS_USER_PROMPT_TEMPLATE = `请分析以下证据与争议焦点之间的缺口：

争议焦点：
{{issues}}

现有证据：
{{evidence}}

请严格按照 JSON 格式输出证据缺口分析结果。`;

// ─── Evidence Organizer ─────────────────────────────────────

export class EvidenceOrganizer {
  private llm = getLLMGateway();

  /**
   * Generate an evidence checklist based on legal issues.
   * Each item includes type classification, strength assessment, and legality risk annotation.
   */
  async generateChecklist(issues: LegalIssue[]): Promise<EvidenceItem[]> {
    const issuesText = issues
      .map((issue, i) => {
        const laws = issue.legalBasis.map(l => `${l.lawName}${l.articleNumber ? ` ${l.articleNumber}` : ''}`).join('、');
        return `${i + 1}. ${issue.issue}\n   法律依据：${laws}\n   分析：${issue.analysis}`;
      })
      .join('\n\n');

    const userPrompt = EVIDENCE_CHECKLIST_USER_PROMPT_TEMPLATE
      .replace('{{issues}}', issuesText);

    const messages: LLMMessage[] = [
      { role: 'system', content: EVIDENCE_CHECKLIST_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 4000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedChecklist(issues);
    }

    try {
      const parsed = this.llm.parseJSON<RawChecklistResponse>(response);
      return this.normalizeEvidenceItems(parsed.evidenceItems);
    } catch {
      return this.buildDegradedChecklist(issues);
    }
  }

  /**
   * Assess the overall strength of a collection of evidence items.
   */
  async assessStrength(evidence: EvidenceItem[]): Promise<EvidenceAssessment> {
    const evidenceText = evidence
      .map((e, i) => `${i + 1}. [${e.type}] ${e.description}\n   证明力：${e.strength}（${e.strengthReason}）${e.legalityRisk ? `\n   合法性风险：${e.legalityRisk}` : ''}`)
      .join('\n\n');

    const userPrompt = EVIDENCE_ASSESSMENT_USER_PROMPT_TEMPLATE
      .replace('{{evidence}}', evidenceText);

    const messages: LLMMessage[] = [
      { role: 'system', content: EVIDENCE_ASSESSMENT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 4000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedAssessment(evidence);
    }

    try {
      const parsed = this.llm.parseJSON<RawAssessmentResponse>(response);
      return this.normalizeAssessment(parsed, evidence);
    } catch {
      return this.buildDegradedAssessment(evidence);
    }
  }

  /**
   * Identify gaps in the evidence relative to the legal issues.
   */
  async identifyGaps(evidence: EvidenceItem[], issues: LegalIssue[]): Promise<EvidenceGap[]> {
    const issuesText = issues
      .map((issue, i) => {
        const laws = issue.legalBasis.map(l => `${l.lawName}${l.articleNumber ? ` ${l.articleNumber}` : ''}`).join('、');
        return `${i + 1}. ${issue.issue}\n   法律依据：${laws}`;
      })
      .join('\n\n');

    const evidenceText = evidence
      .map((e, i) => `${i + 1}. [${e.type}] ${e.description}（证明力：${e.strength}）`)
      .join('\n');

    const userPrompt = EVIDENCE_GAPS_USER_PROMPT_TEMPLATE
      .replace('{{issues}}', issuesText)
      .replace('{{evidence}}', evidenceText);

    const messages: LLMMessage[] = [
      { role: 'system', content: EVIDENCE_GAPS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 4000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedGaps(issues);
    }

    try {
      const parsed = this.llm.parseJSON<RawGapsResponse>(response);
      return this.normalizeGaps(parsed.gaps);
    } catch {
      return this.buildDegradedGaps(issues);
    }
  }

  // ─── Normalization ──────────────────────────────────────

  private normalizeEvidenceItems(rawItems: unknown): EvidenceItem[] {
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return [{
        description: '证据清单待生成',
        type: 'DOCUMENTARY',
        strength: 'MEDIUM',
        strengthReason: '需要进一步分析以确定证据清单',
      }];
    }

    return rawItems
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
      .map(item => this.normalizeOneEvidenceItem(item));
  }

  private normalizeOneEvidenceItem(raw: Record<string, unknown>): EvidenceItem {
    const description = typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim() : '证据描述待补充';

    const type = this.normalizeEvidenceType(raw.type);
    const strength = this.normalizeStrength(raw.strength);

    const strengthReason = typeof raw.strengthReason === 'string' && raw.strengthReason.trim()
      ? raw.strengthReason.trim() : '证明力评估理由待补充';

    const legalityRisk = typeof raw.legalityRisk === 'string' && raw.legalityRisk.trim()
      ? raw.legalityRisk.trim() : undefined;

    let alternativeCollection = typeof raw.alternativeCollection === 'string' && raw.alternativeCollection.trim()
      ? raw.alternativeCollection.trim() : undefined;

    // Enforce: when legalityRisk is non-empty, alternativeCollection must also be non-empty
    if (legalityRisk && !alternativeCollection) {
      alternativeCollection = '建议通过合法途径重新收集该证据，或咨询律师获取替代取证方案。';
    }

    const result: EvidenceItem = { description, type, strength, strengthReason };
    if (legalityRisk) {
      result.legalityRisk = legalityRisk;
      result.alternativeCollection = alternativeCollection;
    }

    return result;
  }

  private normalizeAssessment(raw: RawAssessmentResponse, originalEvidence: EvidenceItem[]): EvidenceAssessment {
    const overallStrength = this.normalizeStrength(raw.overallStrength);

    const items = Array.isArray(raw.items) && raw.items.length > 0
      ? raw.items
          .filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
          .map(item => this.normalizeOneEvidenceItem(item))
      : originalEvidence;

    const summary = typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim() : '证据整体评估待完成，建议咨询专业律师。';

    return { overallStrength, items, summary };
  }

  private normalizeGaps(rawGaps: unknown): EvidenceGap[] {
    if (!Array.isArray(rawGaps) || rawGaps.length === 0) {
      return [{
        issue: '待分析',
        missingEvidence: '证据缺口分析待完成',
        importance: 'IMPORTANT',
        suggestion: '建议咨询专业律师进行证据缺口分析。',
      }];
    }

    return rawGaps
      .filter((gap): gap is Record<string, unknown> => gap !== null && typeof gap === 'object')
      .map(gap => ({
        issue: typeof gap.issue === 'string' && gap.issue.trim()
          ? gap.issue.trim() : '待分析',
        missingEvidence: typeof gap.missingEvidence === 'string' && gap.missingEvidence.trim()
          ? gap.missingEvidence.trim() : '缺失证据待确认',
        importance: this.normalizeGapImportance(gap.importance),
        suggestion: typeof gap.suggestion === 'string' && gap.suggestion.trim()
          ? gap.suggestion.trim() : '建议咨询专业律师。',
      }));
  }

  // ─── Utility Helpers ────────────────────────────────────

  private normalizeEvidenceType(value: unknown): EvidenceType {
    if (typeof value === 'string') {
      const upper = value.toUpperCase() as EvidenceType;
      if (VALID_EVIDENCE_TYPES.includes(upper)) return upper;
    }
    return 'DOCUMENTARY';
  }

  private normalizeStrength(value: unknown): EvidenceStrength {
    if (typeof value === 'string') {
      const upper = value.toUpperCase() as EvidenceStrength;
      if (VALID_STRENGTHS.includes(upper)) return upper;
    }
    return 'MEDIUM';
  }

  private normalizeGapImportance(value: unknown): GapImportance {
    if (typeof value === 'string') {
      const upper = value.toUpperCase() as GapImportance;
      if (VALID_GAP_IMPORTANCES.includes(upper)) return upper;
    }
    return 'IMPORTANT';
  }

  // ─── Degraded Responses ─────────────────────────────────

  private buildDegradedChecklist(issues: LegalIssue[]): EvidenceItem[] {
    return issues.map(issue => ({
      description: `针对"${issue.issue}"的相关证据（AI 服务暂时不可用）`,
      type: 'DOCUMENTARY' as EvidenceType,
      strength: 'MEDIUM' as EvidenceStrength,
      strengthReason: 'AI 服务暂时不可用，无法评估证明力，请稍后重试。',
    }));
  }

  private buildDegradedAssessment(evidence: EvidenceItem[]): EvidenceAssessment {
    return {
      overallStrength: 'MEDIUM',
      items: evidence,
      summary: 'AI 服务暂时不可用，无法完成证据整体评估，请稍后重试或咨询专业律师。',
    };
  }

  private buildDegradedGaps(issues: LegalIssue[]): EvidenceGap[] {
    return issues.map(issue => ({
      issue: issue.issue,
      missingEvidence: 'AI 服务暂时不可用，无法识别证据缺口',
      importance: 'IMPORTANT' as GapImportance,
      suggestion: '请稍后重试或咨询专业律师进行证据缺口分析。',
    }));
  }
}

// ─── Raw Response Types ───────────────────────────────────

interface RawChecklistResponse {
  evidenceItems?: unknown;
}

interface RawAssessmentResponse {
  overallStrength?: unknown;
  items?: unknown;
  summary?: unknown;
}

interface RawGapsResponse {
  gaps?: unknown;
}

// ─── Singleton ──────────────────────────────────────────────

let organizerInstance: EvidenceOrganizer | null = null;

export function getEvidenceOrganizer(): EvidenceOrganizer {
  if (!organizerInstance) {
    organizerInstance = new EvidenceOrganizer();
  }
  return organizerInstance;
}

export function resetEvidenceOrganizer(): void {
  organizerInstance = null;
}
