/**
 * Risk Warning & Disclaimer Service (风险警示与免责声明服务)
 * Automatically inserts disclaimers, risk warnings, criminal case lawyer
 * recommendations, and legal regulation change notices into consultation responses.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */

// ─── Types ──────────────────────────────────────────────────

/** The legal domain / category of a consultation */
export type LegalDomain =
  | 'CRIMINAL'
  | 'CIVIL'
  | 'CORPORATE'
  | 'CONTRACT'
  | 'VISA'
  | 'TAX'
  | 'IP'
  | 'LABOR'
  | 'TRADE'
  | 'OTHER';

/** Risk level of the legal advice */
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/** Input for the risk warning processor */
export interface ConsultationResponse {
  content: string;
  legalDomain: LegalDomain;
  riskLevel: RiskLevel;
  jurisdiction: 'CHINA' | 'THAILAND' | 'DUAL';
  /** Optional list of law names referenced in the response */
  referencedLaws?: string[];
}

/** A single risk warning annotation */
export interface RiskWarning {
  type: 'HIGH_RISK' | 'CRIMINAL_LAWYER' | 'LAW_CHANGE';
  message: string;
}

/** The processed result with all warnings and disclaimers inserted */
export interface ProcessedResponse {
  /** Original content */
  originalContent: string;
  /** The disclaimer text */
  disclaimer: string;
  /** Risk warnings (empty array if none) */
  warnings: RiskWarning[];
  /** Whether a criminal-case lawyer recommendation was inserted */
  hasCriminalLawyerAdvice: boolean;
  /** Whether a law change notice was inserted */
  hasLawChangeNotice: boolean;
  /** The full response with all annotations inserted */
  annotatedContent: string;
}

// ─── Constants ──────────────────────────────────────────────

/** Standard disclaimer — always appended to every consultation response (Req 13.2) */
export const DEFAULT_DISCLAIMER =
  '【免责声明】本回复由AI法律专家系统自动生成，仅供参考，不构成正式法律意见，不替代专业律师意见。' +
  '如需处理具体法律事务，请咨询持牌律师获取专业法律服务。';

/** Prominent risk warning for high-risk legal advice (Req 13.1) */
export const HIGH_RISK_WARNING =
  '⚠️【重要风险警示】以下法律建议涉及重大法律风险，请务必谨慎对待。' +
  '建议在采取任何行动前咨询专业律师，以避免可能的法律后果。';

/** Criminal case lawyer recommendation (Req 13.3) */
export const CRIMINAL_LAWYER_ADVICE =
  '⚠️【强烈建议】本咨询涉及刑事案件相关事宜。刑事案件关系到人身自由和重大权益，' +
  '强烈建议您立即聘请专业刑事辩护律师处理，切勿仅依赖AI系统的分析结果。';

/** Law change notice template (Req 13.4) */
export const LAW_CHANGE_NOTICE_TEMPLATE =
  '⚠️【法规变更提示】本回复引用的法律法规可能已发生修订或更新。' +
  '请核实以下法律的最新版本：{{laws}}。建议查阅官方法律数据库获取最新规定。';

/** Generic law change notice when no specific laws are referenced */
export const GENERIC_LAW_CHANGE_NOTICE =
  '⚠️【法规变更提示】法律法规可能已发生变更，本回复中引用的法律条文以发布时的版本为准。' +
  '请核实最新法律规定，建议查阅官方法律数据库或咨询专业律师。';

// ─── Section Markers ────────────────────────────────────────

const SECTION_SEPARATOR = '\n\n---\n\n';

// ─── Risk Warning Service ───────────────────────────────────

export class RiskWarningService {
  /**
   * Process a consultation response and insert all applicable
   * disclaimers, risk warnings, and notices.
   */
  process(response: ConsultationResponse): ProcessedResponse {
    const warnings: RiskWarning[] = [];

    // 1. Always generate disclaimer (Req 13.2)
    const disclaimer = DEFAULT_DISCLAIMER;

    // 2. High-risk warning (Req 13.1)
    if (this.isHighRisk(response.riskLevel)) {
      warnings.push({
        type: 'HIGH_RISK',
        message: HIGH_RISK_WARNING,
      });
    }

    // 3. Criminal case lawyer advice (Req 13.3)
    const hasCriminalLawyerAdvice = this.isCriminalCase(response.legalDomain);
    if (hasCriminalLawyerAdvice) {
      warnings.push({
        type: 'CRIMINAL_LAWYER',
        message: CRIMINAL_LAWYER_ADVICE,
      });
    }

    // 4. Law change notice (Req 13.4)
    const lawChangeNotice = this.buildLawChangeNotice(response.referencedLaws);
    const hasLawChangeNotice = lawChangeNotice !== null;
    if (lawChangeNotice) {
      warnings.push({
        type: 'LAW_CHANGE',
        message: lawChangeNotice,
      });
    }

    // 5. Build annotated content
    const annotatedContent = this.buildAnnotatedContent(
      response.content,
      disclaimer,
      warnings,
    );

    return {
      originalContent: response.content,
      disclaimer,
      warnings,
      hasCriminalLawyerAdvice,
      hasLawChangeNotice,
      annotatedContent,
    };
  }

  /**
   * Generate only the disclaimer text.
   * Useful when you just need the disclaimer without full processing.
   */
  getDisclaimer(): string {
    return DEFAULT_DISCLAIMER;
  }

  /**
   * Check if a given risk level qualifies as high risk.
   */
  isHighRisk(riskLevel: RiskLevel): boolean {
    return riskLevel === 'HIGH';
  }

  /**
   * Check if the legal domain is a criminal case.
   */
  isCriminalCase(domain: LegalDomain): boolean {
    return domain === 'CRIMINAL';
  }

  /**
   * Build a law change notice based on referenced laws.
   * Returns null if no notice is needed (no referenced laws).
   */
  buildLawChangeNotice(referencedLaws?: string[]): string | null {
    if (!referencedLaws || referencedLaws.length === 0) {
      return null;
    }

    const validLaws = referencedLaws
      .filter((law) => typeof law === 'string' && law.trim().length > 0)
      .map((law) => law.trim());

    if (validLaws.length === 0) {
      return null;
    }

    return LAW_CHANGE_NOTICE_TEMPLATE.replace('{{laws}}', validLaws.join('、'));
  }

  /**
   * Build the full annotated content with all warnings and disclaimer.
   * Warnings appear before the content, disclaimer at the end.
   */
  private buildAnnotatedContent(
    content: string,
    disclaimer: string,
    warnings: RiskWarning[],
  ): string {
    const parts: string[] = [];

    // Warnings go at the top (prominent placement)
    if (warnings.length > 0) {
      const warningBlock = warnings.map((w) => w.message).join('\n\n');
      parts.push(warningBlock);
    }

    // Original content
    parts.push(content);

    // Disclaimer always at the end
    parts.push(disclaimer);

    return parts.join(SECTION_SEPARATOR);
  }
}

// ─── Singleton ──────────────────────────────────────────────

let serviceInstance: RiskWarningService | null = null;

export function getRiskWarningService(): RiskWarningService {
  if (!serviceInstance) {
    serviceInstance = new RiskWarningService();
  }
  return serviceInstance;
}

export function resetRiskWarningService(): void {
  serviceInstance = null;
}
