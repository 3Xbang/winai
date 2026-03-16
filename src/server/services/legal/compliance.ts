/**
 * Compliance Risk Annotator (合规风险标注器)
 * Detects compliance risks in legal analysis outputs and provides alternatives.
 * Every risk MUST include at least one compliant alternative approach.
 *
 * Requirements: 3.5, 11.4
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface ComplianceRisk {
  riskDescription: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  legalBasis: string;
  alternatives: string[]; // Must be non-empty (Requirement 3.5)
}

export interface ComplianceAnnotation {
  hasComplianceRisks: boolean;
  risks: ComplianceRisk[];
  overallComplianceLevel: 'COMPLIANT' | 'MINOR_ISSUES' | 'MAJOR_ISSUES' | 'NON_COMPLIANT';
}

// ─── Constants ──────────────────────────────────────────────

export const COMPLIANCE_SYSTEM_PROMPT = [
  '你是一位精通中国法律和泰国法律的合规风险分析专家。',
  '',
  '## 你的任务',
  '分析给定的法律分析内容，识别其中的合规风险点，并为每个风险提供合规替代方案。',
  '',
  '## 分析维度',
  '1. 法律合规性：是否违反中国或泰国的强制性法律规定',
  '2. 监管合规性：是否符合相关监管机构的要求',
  '3. 程序合规性：是否遵循法定程序和流程要求',
  '4. 跨境合规性：跨境业务是否符合两国的法律要求',
  '',
  '## 风险严重程度标准',
  '- HIGH：违反强制性法律规定，可能导致行政处罚、刑事责任或合同无效',
  '- MEDIUM：存在合规隐患，可能导致纠纷或行政警告',
  '- LOW：存在改进空间，建议优化但不构成直接法律风险',
].join('\n');

export const COMPLIANCE_SYSTEM_PROMPT_PART2 = [
  '',
  '## 整体合规等级判定',
  '- COMPLIANT：未发现合规风险',
  '- MINOR_ISSUES：仅存在 LOW 级别风险',
  '- MAJOR_ISSUES：存在 MEDIUM 级别风险（可能伴有 LOW）',
  '- NON_COMPLIANT：存在至少一个 HIGH 级别风险',
  '',
  '## 关键规则',
  '- 每个风险项必须包含至少一条合规替代方案（alternatives 数组不能为空）',
  '- 替代方案必须具体可操作，不能是笼统的建议',
  '- legalBasis 必须引用具体的法律法规名称',
  '',
  '## 输出格式（严格 JSON）',
  '{',
  '  "hasComplianceRisks": true,',
  '  "risks": [',
  '    {',
  '      "riskDescription": "风险描述",',
  '      "severity": "HIGH",',
  '      "legalBasis": "具体法律法规名称和条款",',
  '      "alternatives": ["合规替代方案1", "合规替代方案2"]',
  '    }',
  '  ],',
  '  "overallComplianceLevel": "NON_COMPLIANT"',
  '}',
  '',
  '如果没有发现合规风险，返回：',
  '{',
  '  "hasComplianceRisks": false,',
  '  "risks": [],',
  '  "overallComplianceLevel": "COMPLIANT"',
  '}',
].join('\n');

export const FULL_COMPLIANCE_SYSTEM_PROMPT = COMPLIANCE_SYSTEM_PROMPT + '\n' + COMPLIANCE_SYSTEM_PROMPT_PART2;

export const COMPLIANCE_USER_PROMPT_TEMPLATE =
  '请分析以下法律分析内容中的合规风险。\n\n' +
  '法域：{{jurisdiction}}\n\n' +
  '法律分析内容：\n{{analysisContent}}\n\n' +
  '请严格按照 JSON 格式输出合规风险分析结果。确保每个风险项都包含至少一条具体的合规替代方案。';

const JURISDICTION_LABELS: Record<string, string> = {
  CHINA: '中国法域',
  THAILAND: '泰国法域',
  DUAL: '中泰双重法域',
};

// ─── Compliance Annotator ───────────────────────────────────

export class ComplianceAnnotator {
  private llm = getLLMGateway();

  /**
   * Annotate legal analysis content with compliance risks.
   * Uses LLM to detect risks and ensure each has alternatives.
   */
  async annotate(
    analysisContent: string,
    jurisdiction: 'CHINA' | 'THAILAND' | 'DUAL',
  ): Promise<ComplianceAnnotation> {
    const jurisdictionLabel = JURISDICTION_LABELS[jurisdiction] ?? '中泰双重法域';

    const userPrompt = COMPLIANCE_USER_PROMPT_TEMPLATE
      .replace('{{jurisdiction}}', jurisdictionLabel)
      .replace('{{analysisContent}}', analysisContent);

    const messages: LLMMessage[] = [
      { role: 'system', content: FULL_COMPLIANCE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 3000,
    });

    // Handle degraded response
    if (response.provider === 'fallback') {
      return this.buildDegradedAnnotation();
    }

    const parsed = this.llm.parseJSON<RawComplianceResponse>(response);
    return this.normalizeAnnotation(parsed);
  }

  /**
   * Normalize and validate the raw LLM response.
   * Enforces the key invariant: every risk must have at least one alternative.
   */
  private normalizeAnnotation(raw: RawComplianceResponse): ComplianceAnnotation {
    const risks = this.normalizeRisks(raw.risks);
    const hasComplianceRisks = risks.length > 0;
    const overallComplianceLevel = this.computeOverallLevel(risks);

    return { hasComplianceRisks, risks, overallComplianceLevel };
  }

  private normalizeRisks(rawRisks: unknown): ComplianceRisk[] {
    if (!Array.isArray(rawRisks)) return [];

    return rawRisks
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
      .map((r) => this.normalizeOneRisk(r))
      .filter((r): r is ComplianceRisk => r !== null);
  }

  private normalizeOneRisk(raw: Record<string, unknown>): ComplianceRisk | null {
    const riskDescription =
      typeof raw.riskDescription === 'string' && raw.riskDescription.trim()
        ? raw.riskDescription.trim()
        : '';

    if (!riskDescription) return null;

    const severity = this.normalizeSeverity(raw.severity);
    const legalBasis =
      typeof raw.legalBasis === 'string' && raw.legalBasis.trim()
        ? raw.legalBasis.trim()
        : '相关法律法规';

    let alternatives = this.normalizeStringArray(raw.alternatives);

    // Key invariant (Requirement 3.5): every risk must have at least one alternative
    if (alternatives.length === 0) {
      alternatives = ['建议咨询专业律师以获取针对此风险的具体合规方案'];
    }

    return { riskDescription, severity, legalBasis, alternatives };
  }

  private normalizeSeverity(value: unknown): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
        return upper as 'HIGH' | 'MEDIUM' | 'LOW';
      }
    }
    return 'MEDIUM'; // Default to MEDIUM when uncertain
  }

  private normalizeStringArray(arr: unknown): string[] {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => s.trim());
  }

  private computeOverallLevel(
    risks: ComplianceRisk[],
  ): ComplianceAnnotation['overallComplianceLevel'] {
    if (risks.length === 0) return 'COMPLIANT';

    const hasHigh = risks.some((r) => r.severity === 'HIGH');
    const hasMedium = risks.some((r) => r.severity === 'MEDIUM');

    if (hasHigh) return 'NON_COMPLIANT';
    if (hasMedium) return 'MAJOR_ISSUES';
    return 'MINOR_ISSUES';
  }

  private buildDegradedAnnotation(): ComplianceAnnotation {
    return {
      hasComplianceRisks: true,
      risks: [
        {
          riskDescription: 'AI 合规分析服务暂时不可用，无法完成自动合规风险检测。',
          severity: 'MEDIUM',
          legalBasis: '系统服务降级',
          alternatives: ['建议咨询专业律师进行人工合规审查'],
        },
      ],
      overallComplianceLevel: 'MAJOR_ISSUES',
    };
  }
}

/** Raw response shape from LLM (before normalization) */
interface RawComplianceResponse {
  hasComplianceRisks?: boolean;
  risks?: Array<{
    riskDescription?: string;
    severity?: string;
    legalBasis?: string;
    alternatives?: string[];
  }>;
  overallComplianceLevel?: string;
}

// ─── Singleton ──────────────────────────────────────────────

let annotatorInstance: ComplianceAnnotator | null = null;

export function getComplianceAnnotator(): ComplianceAnnotator {
  if (!annotatorInstance) {
    annotatorInstance = new ComplianceAnnotator();
  }
  return annotatorInstance;
}

export function resetComplianceAnnotator(): void {
  annotatorInstance = null;
}
