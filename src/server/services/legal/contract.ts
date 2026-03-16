/**
 * Contract Analyzer (合同分析器)
 * Handles contract drafting and review with risk identification.
 * Supports multiple contract types, multi-language output, and clause-level analysis.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import { getPromptEngine } from '@/server/services/llm/prompt-engine';
import type { LLMMessage } from '@/server/services/llm/types';
import type { LawReference, JurisdictionResult } from './jurisdiction';

// ─── Types ──────────────────────────────────────────────────

export interface PartyInfo {
  name: string;
  role: string; // e.g. '甲方', '乙方', 'Party A', 'Party B'
  nationality?: string;
  idNumber?: string;
  address?: string;
}

export interface ContractDraftRequest {
  contractType: 'LEASE' | 'SALE' | 'PARTNERSHIP' | 'EMPLOYMENT' | 'SERVICE' | 'OTHER';
  parties: PartyInfo[];
  keyTerms: Record<string, string>;
  languages: ('zh' | 'en' | 'th')[];
  jurisdiction: JurisdictionResult;
}

export interface ContractRisk {
  clauseIndex: number;
  clauseText: string;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  riskDescription: string;
  legalBasis: LawReference[];
  suggestedRevision: string;
}

export interface ClauseRevision {
  clauseIndex: number;
  originalText: string;
  revisedText: string;
  reason: string;
}

export interface ContractReviewResult {
  risks: ContractRisk[];
  overallRiskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  reviewReport: string;
  suggestedRevisions: ClauseRevision[];
}

// ─── Constants ──────────────────────────────────────────────

const CONTRACT_TYPE_LABELS: Record<ContractDraftRequest['contractType'], { zh: string; en: string; th: string }> = {
  LEASE: { zh: '租赁合同', en: 'Lease Agreement', th: 'สัญญาเช่า' },
  SALE: { zh: '买卖合同', en: 'Sale Agreement', th: 'สัญญาซื้อขาย' },
  PARTNERSHIP: { zh: '合伙协议', en: 'Partnership Agreement', th: 'สัญญาหุ้นส่วน' },
  EMPLOYMENT: { zh: '劳动合同', en: 'Employment Contract', th: 'สัญญาจ้างแรงงาน' },
  SERVICE: { zh: '服务合同', en: 'Service Agreement', th: 'สัญญาบริการ' },
  OTHER: { zh: '合同', en: 'Agreement', th: 'สัญญา' },
};

export const CONTRACT_DRAFT_SYSTEM_PROMPT = `你是一位精通中国和泰国合同法的资深合同起草律师。请根据用户提供的信息起草专业合同。

## 合同起草规则

1. **合同结构**：合同必须包含以下核心部分：
   - 合同标题
   - 当事人信息
   - 定义与解释条款
   - 核心权利义务条款（根据合同类型）
   - 价款/对价条款
   - 违约责任条款
   - 不可抗力条款
   - 保密条款（如适用）
   - **适用法律条款**（必须明确约定适用的法律）
   - **争议解决条款**（必须明确约定争议解决方式：仲裁或诉讼，以及管辖法院/仲裁机构）
   - 通知条款
   - 一般条款（修改、转让、完整协议等）
   - 签署栏

2. **法域要求**：
   - CHINA 管辖：引用中国法律（如《民法典》合同编、《劳动合同法》等）
   - THAILAND 管辖：引用泰国法律（如 Civil and Commercial Code、Labor Protection Act 等）
   - DUAL 管辖：同时考虑两国法律要求，明确约定适用法律和争议解决机制

3. **多语言输出**：
   - 当请求多种语言时，按语言顺序依次输出完整合同文本
   - 每种语言版本之间用 "===LANGUAGE_SEPARATOR===" 分隔
   - 各语言版本内容应保持一致

4. **跨境交易特别要求**：
   - 必须明确约定适用法律
   - 必须明确约定争议解决机制（仲裁优先推荐）
   - 考虑汇率、税务、合规等跨境特殊条款

请直接输出合同文本，不要输出 JSON 格式。`;

export const CONTRACT_DRAFT_USER_PROMPT_TEMPLATE = `请起草以下合同：

合同类型：{{contractType}}
当事人信息：
{{parties}}

关键条款要求：
{{keyTerms}}

输出语言：{{languages}}
管辖区：{{jurisdiction}}
{{jurisdictionLaws}}

请严格按照上述要求起草完整的合同文本。合同必须包含适用法律条款和争议解决条款。`;

export const CONTRACT_REVIEW_SYSTEM_PROMPT = `你是一位精通中国和泰国合同法的资深合同审查律师。请逐条分析合同条款，识别法律风险并提供修改建议。

## 审查规则

1. **逐条分析**：对合同中的每个重要条款进行独立分析
2. **风险等级**：
   - HIGH（高风险）：条款违反强制性法律规定、严重损害一方权益、可能导致合同无效
   - MEDIUM（中风险）：条款存在法律漏洞、表述不够严谨、可能引发争议
   - LOW（低风险）：条款基本合规但可以优化、存在轻微瑕疵
3. **法律依据**：HIGH 风险项必须引用具体的法律条文作为依据
4. **修改建议**：每个风险项必须提供具体的修改建议和替代条款文本

## 输出格式（严格 JSON）
{
  "risks": [
    {
      "clauseIndex": 1,
      "clauseText": "原始条款文本",
      "riskLevel": "HIGH" | "MEDIUM" | "LOW",
      "riskDescription": "风险描述",
      "legalBasis": [
        {
          "lawName": "法律名称",
          "articleNumber": "条款编号",
          "description": "法条内容摘要"
        }
      ],
      "suggestedRevision": "建议修改后的条款文本"
    }
  ],
  "overallRiskLevel": "HIGH" | "MEDIUM" | "LOW",
  "reviewReport": "合同审查综合报告，包含风险摘要和整体评价",
  "suggestedRevisions": [
    {
      "clauseIndex": 1,
      "originalText": "原始条款文本",
      "revisedText": "修改后的条款文本",
      "reason": "修改理由"
    }
  ]
}

## 重要规则
- risks 数组不得为空（至少识别一个风险点或改进建议）
- HIGH 风险项的 legalBasis 必须至少包含一条法律引用
- overallRiskLevel 取所有风险项中最高的等级
- reviewReport 必须非空，包含风险摘要
- suggestedRevisions 应包含所有需要修改的条款`;

export const CONTRACT_REVIEW_USER_PROMPT_TEMPLATE = `请审查以下合同文本，识别法律风险并提供修改建议。

管辖区：{{jurisdiction}}
{{jurisdictionLaws}}

合同文本：
{{contractText}}

请严格按照 JSON 格式输出审查结果。`;

// ─── Contract Analyzer ─────────────────────────────────────

export class ContractAnalyzer {
  private llm = getLLMGateway();
  private promptEngine = getPromptEngine();

  /**
   * Draft a contract based on the provided request.
   * Supports 6 contract types, multi-language output, and jurisdiction-specific clauses.
   */
  async draft(request: ContractDraftRequest): Promise<string> {
    const contractTypeLabel = this.formatContractType(request.contractType, request.languages);
    const partiesText = this.formatParties(request.parties);
    const keyTermsText = this.formatKeyTerms(request.keyTerms);
    const languagesText = this.formatLanguages(request.languages);
    const jurisdictionText = this.formatJurisdiction(request.jurisdiction);
    const jurisdictionLawsText = this.formatJurisdictionLaws(request.jurisdiction);

    const userPrompt = CONTRACT_DRAFT_USER_PROMPT_TEMPLATE
      .replace('{{contractType}}', contractTypeLabel)
      .replace('{{parties}}', partiesText)
      .replace('{{keyTerms}}', keyTermsText)
      .replace('{{languages}}', languagesText)
      .replace('{{jurisdiction}}', jurisdictionText)
      .replace('{{jurisdictionLaws}}', jurisdictionLawsText);

    const messages: LLMMessage[] = [
      { role: 'system', content: CONTRACT_DRAFT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.4,
      maxTokens: 8000,
    });

    // Handle degraded response
    if (response.provider === 'fallback' || !response.content.trim()) {
      return this.buildDegradedDraft(request);
    }

    return response.content.trim();
  }

  /**
   * Review a contract text and identify risks.
   * Returns clause-level risk analysis with legal basis and revision suggestions.
   */
  async review(contractText: string, jurisdiction: JurisdictionResult): Promise<ContractReviewResult> {
    const jurisdictionText = this.formatJurisdiction(jurisdiction);
    const jurisdictionLawsText = this.formatJurisdictionLaws(jurisdiction);

    const userPrompt = CONTRACT_REVIEW_USER_PROMPT_TEMPLATE
      .replace('{{jurisdiction}}', jurisdictionText)
      .replace('{{jurisdictionLaws}}', jurisdictionLawsText)
      .replace('{{contractText}}', contractText);

    const messages: LLMMessage[] = [
      { role: 'system', content: CONTRACT_REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 6000,
    });

    // Handle degraded response
    if (response.provider === 'fallback') {
      return this.buildDegradedReview();
    }

    try {
      const parsed = this.llm.parseJSON<RawContractReviewResponse>(response);
      return this.normalizeReviewResult(parsed);
    } catch {
      return this.buildDegradedReview();
    }
  }

  // ─── Formatting Helpers ─────────────────────────────────

  private formatContractType(type: ContractDraftRequest['contractType'], languages: ('zh' | 'en' | 'th')[]): string {
    const labels = CONTRACT_TYPE_LABELS[type];
    return languages.map(lang => labels[lang]).join(' / ');
  }

  private formatParties(parties: PartyInfo[]): string {
    return parties.map((p, i) => {
      const lines = [`${p.role || `当事人${i + 1}`}: ${p.name}`];
      if (p.nationality) lines.push(`  国籍: ${p.nationality}`);
      if (p.idNumber) lines.push(`  证件号: ${p.idNumber}`);
      if (p.address) lines.push(`  地址: ${p.address}`);
      return lines.join('\n');
    }).join('\n');
  }

  private formatKeyTerms(keyTerms: Record<string, string>): string {
    return Object.entries(keyTerms)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join('\n');
  }

  private formatLanguages(languages: ('zh' | 'en' | 'th')[]): string {
    const langNames: Record<string, string> = { zh: '中文', en: 'English', th: 'ภาษาไทย' };
    return languages.map(l => langNames[l]).join('、');
  }

  private formatJurisdiction(jurisdiction: JurisdictionResult): string {
    const labels: Record<string, string> = {
      CHINA: '中国法',
      THAILAND: '泰国法',
      DUAL: '中国法与泰国法（双重管辖）',
    };
    return labels[jurisdiction.jurisdiction] || '双重管辖';
  }

  private formatJurisdictionLaws(jurisdiction: JurisdictionResult): string {
    const parts: string[] = [];
    if (jurisdiction.chinaLaws && jurisdiction.chinaLaws.length > 0) {
      parts.push('适用的中国法律：' + jurisdiction.chinaLaws.map(l =>
        `${l.lawName}${l.articleNumber ? ` ${l.articleNumber}` : ''}`
      ).join('、'));
    }
    if (jurisdiction.thailandLaws && jurisdiction.thailandLaws.length > 0) {
      parts.push('适用的泰国法律：' + jurisdiction.thailandLaws.map(l =>
        `${l.lawName}${l.articleNumber ? ` ${l.articleNumber}` : ''}`
      ).join('、'));
    }
    return parts.join('\n');
  }

  // ─── Normalization ──────────────────────────────────────

  private normalizeReviewResult(raw: RawContractReviewResponse): ContractReviewResult {
    const risks = this.normalizeRisks(raw.risks);
    const overallRiskLevel = this.normalizeRiskLevel(raw.overallRiskLevel, risks);
    const reviewReport = typeof raw.reviewReport === 'string' && raw.reviewReport.trim()
      ? raw.reviewReport.trim()
      : '合同审查报告生成中，请稍后重试。';
    const suggestedRevisions = this.normalizeRevisions(raw.suggestedRevisions);

    return { risks, overallRiskLevel, reviewReport, suggestedRevisions };
  }

  private normalizeRisks(rawRisks: unknown): ContractRisk[] {
    if (!Array.isArray(rawRisks) || rawRisks.length === 0) {
      return [{
        clauseIndex: 0,
        clauseText: '整体合同',
        riskLevel: 'LOW',
        riskDescription: '未发现明显风险，建议进一步人工审查。',
        legalBasis: [],
        suggestedRevision: '建议请专业律师进行详细审查。',
      }];
    }

    return rawRisks
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
      .map(r => {
        const riskLevel = this.parseRiskLevel(r.riskLevel);
        const legalBasis = this.normalizeLawReferences(r.legalBasis);

        // Enforce: HIGH risk must have at least one legal basis
        if (riskLevel === 'HIGH' && legalBasis.length === 0) {
          legalBasis.push({
            lawName: '相关法律',
            articleNumber: '待确定',
            description: '高风险条款需要进一步确认具体法律依据',
          });
        }

        return {
          clauseIndex: typeof r.clauseIndex === 'number' ? r.clauseIndex : 0,
          clauseText: typeof r.clauseText === 'string' && r.clauseText.trim()
            ? r.clauseText.trim() : '条款文本待确认',
          riskLevel,
          riskDescription: typeof r.riskDescription === 'string' && r.riskDescription.trim()
            ? r.riskDescription.trim() : '风险描述待补充',
          legalBasis,
          suggestedRevision: typeof r.suggestedRevision === 'string' && r.suggestedRevision.trim()
            ? r.suggestedRevision.trim() : '建议请专业律师审查此条款。',
        };
      });
  }

  private parseRiskLevel(value: unknown): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
        return upper;
      }
    }
    return 'MEDIUM';
  }

  private normalizeRiskLevel(
    rawLevel: unknown,
    risks: ContractRisk[],
  ): 'HIGH' | 'MEDIUM' | 'LOW' {
    // Overall risk level should be the highest among all risks
    const hasHigh = risks.some(r => r.riskLevel === 'HIGH');
    const hasMedium = risks.some(r => r.riskLevel === 'MEDIUM');

    if (hasHigh) return 'HIGH';
    if (hasMedium) return 'MEDIUM';

    // If raw value is valid, use it; otherwise derive from risks
    if (typeof rawLevel === 'string') {
      const upper = rawLevel.toUpperCase();
      if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
        return upper;
      }
    }
    return 'LOW';
  }

  private normalizeLawReferences(refs: unknown): LawReference[] {
    if (!Array.isArray(refs)) return [];
    return refs
      .filter((ref): ref is Record<string, unknown> => ref !== null && typeof ref === 'object')
      .map(ref => ({
        lawName: typeof ref.lawName === 'string' && ref.lawName.trim()
          ? ref.lawName.trim() : '相关法律',
        articleNumber: typeof ref.articleNumber === 'string' && ref.articleNumber.trim()
          ? ref.articleNumber.trim() : undefined,
        description: typeof ref.description === 'string' ? ref.description.trim() : '',
      }));
  }

  private normalizeRevisions(rawRevisions: unknown): ClauseRevision[] {
    if (!Array.isArray(rawRevisions)) return [];
    return rawRevisions
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
      .map(r => ({
        clauseIndex: typeof r.clauseIndex === 'number' ? r.clauseIndex : 0,
        originalText: typeof r.originalText === 'string' ? r.originalText.trim() : '',
        revisedText: typeof r.revisedText === 'string' ? r.revisedText.trim() : '',
        reason: typeof r.reason === 'string' ? r.reason.trim() : '',
      }));
  }

  // ─── Degraded Responses ─────────────────────────────────

  private buildDegradedDraft(request: ContractDraftRequest): string {
    const typeLabel = CONTRACT_TYPE_LABELS[request.contractType].zh;
    return `【合同草案 - AI 服务降级通知】

抱歉，AI 服务暂时不可用，无法生成完整的${typeLabel}。

请稍后重试，或联系专业律师协助起草合同。

合同类型：${typeLabel}
当事人：${request.parties.map(p => p.name).join('、')}
管辖区：${request.jurisdiction.jurisdiction}

免责声明：本系统生成的合同仅供参考，不构成正式法律意见。建议在签署前咨询专业律师。`;
  }

  private buildDegradedReview(): ContractReviewResult {
    return {
      risks: [{
        clauseIndex: 0,
        clauseText: '整体合同',
        riskLevel: 'MEDIUM',
        riskDescription: 'AI 服务暂时不可用，无法完成详细的合同审查。建议稍后重试或咨询专业律师。',
        legalBasis: [],
        suggestedRevision: '请稍后重试以获取详细的合同审查结果。',
      }],
      overallRiskLevel: 'MEDIUM',
      reviewReport: 'AI 服务暂时不可用，合同审查报告无法生成。请稍后重试或咨询专业律师进行人工审查。',
      suggestedRevisions: [],
    };
  }
}

/** Raw response shape from LLM (before normalization) */
interface RawContractReviewResponse {
  risks?: Array<{
    clauseIndex?: number;
    clauseText?: string;
    riskLevel?: string;
    riskDescription?: string;
    legalBasis?: Array<{ lawName?: string; articleNumber?: string; description?: string }>;
    suggestedRevision?: string;
  }>;
  overallRiskLevel?: string;
  reviewReport?: string;
  suggestedRevisions?: Array<{
    clauseIndex?: number;
    originalText?: string;
    revisedText?: string;
    reason?: string;
  }>;
}

// ─── Singleton ──────────────────────────────────────────────

let analyzerInstance: ContractAnalyzer | null = null;

export function getContractAnalyzer(): ContractAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new ContractAnalyzer();
  }
  return analyzerInstance;
}

export function resetContractAnalyzer(): void {
  analyzerInstance = null;
}
