import { describe, it, expect, beforeEach } from 'vitest';
import {
  RiskWarningService,
  getRiskWarningService,
  resetRiskWarningService,
  DEFAULT_DISCLAIMER,
  HIGH_RISK_WARNING,
  CRIMINAL_LAWYER_ADVICE,
  LAW_CHANGE_NOTICE_TEMPLATE,
  type ConsultationResponse,
  type LegalDomain,
  type RiskLevel,
} from '@/server/services/legal/risk-warning';

// ─── Helpers ────────────────────────────────────────────────

function makeResponse(overrides: Partial<ConsultationResponse> = {}): ConsultationResponse {
  return {
    content: '根据中国公司法，在上海注册有限责任公司需要满足注册资本要求。',
    legalDomain: 'CORPORATE',
    riskLevel: 'LOW',
    jurisdiction: 'CHINA',
    ...overrides,
  };
}

describe('RiskWarningService', () => {
  let service: RiskWarningService;

  beforeEach(() => {
    resetRiskWarningService();
    service = new RiskWarningService();
  });

  // ─── 1. Disclaimer always present (Req 13.2) ──────────────

  describe('disclaimer insertion', () => {
    it('should always include a disclaimer in the processed response', () => {
      const result = service.process(makeResponse());

      expect(result.disclaimer).toBeTruthy();
      expect(result.disclaimer).toBe(DEFAULT_DISCLAIMER);
    });

    it('should include disclaimer in annotated content', () => {
      const result = service.process(makeResponse());

      expect(result.annotatedContent).toContain(DEFAULT_DISCLAIMER);
    });

    it('should include disclaimer for every risk level', () => {
      const levels: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH'];
      for (const riskLevel of levels) {
        const result = service.process(makeResponse({ riskLevel }));
        expect(result.disclaimer).toBe(DEFAULT_DISCLAIMER);
        expect(result.annotatedContent).toContain(DEFAULT_DISCLAIMER);
      }
    });

    it('should include disclaimer for every legal domain', () => {
      const domains: LegalDomain[] = [
        'CRIMINAL', 'CIVIL', 'CORPORATE', 'CONTRACT',
        'VISA', 'TAX', 'IP', 'LABOR', 'TRADE', 'OTHER',
      ];
      for (const legalDomain of domains) {
        const result = service.process(makeResponse({ legalDomain }));
        expect(result.disclaimer).toBe(DEFAULT_DISCLAIMER);
      }
    });

    it('should mention that output does not replace professional lawyer advice', () => {
      const result = service.process(makeResponse());
      expect(result.disclaimer).toContain('不替代专业律师意见');
    });
  });

  // ─── 2. High-risk warning (Req 13.1) ──────────────────────

  describe('high-risk warning', () => {
    it('should insert a prominent risk warning for HIGH risk level', () => {
      const result = service.process(makeResponse({ riskLevel: 'HIGH' }));

      const highRiskWarning = result.warnings.find((w) => w.type === 'HIGH_RISK');
      expect(highRiskWarning).toBeDefined();
      expect(highRiskWarning!.message).toBe(HIGH_RISK_WARNING);
    });

    it('should include high-risk warning in annotated content', () => {
      const result = service.process(makeResponse({ riskLevel: 'HIGH' }));

      expect(result.annotatedContent).toContain('⚠️');
      expect(result.annotatedContent).toContain('重要风险警示');
    });

    it('should NOT insert high-risk warning for MEDIUM risk level', () => {
      const result = service.process(makeResponse({ riskLevel: 'MEDIUM' }));

      const highRiskWarning = result.warnings.find((w) => w.type === 'HIGH_RISK');
      expect(highRiskWarning).toBeUndefined();
    });

    it('should NOT insert high-risk warning for LOW risk level', () => {
      const result = service.process(makeResponse({ riskLevel: 'LOW' }));

      const highRiskWarning = result.warnings.find((w) => w.type === 'HIGH_RISK');
      expect(highRiskWarning).toBeUndefined();
    });
  });

  // ─── 3. Criminal case lawyer advice (Req 13.3) ────────────

  describe('criminal case lawyer recommendation', () => {
    it('should insert lawyer recommendation for CRIMINAL domain', () => {
      const result = service.process(makeResponse({ legalDomain: 'CRIMINAL' }));

      expect(result.hasCriminalLawyerAdvice).toBe(true);
      const criminalWarning = result.warnings.find((w) => w.type === 'CRIMINAL_LAWYER');
      expect(criminalWarning).toBeDefined();
      expect(criminalWarning!.message).toBe(CRIMINAL_LAWYER_ADVICE);
    });

    it('should include criminal lawyer advice in annotated content', () => {
      const result = service.process(makeResponse({ legalDomain: 'CRIMINAL' }));

      expect(result.annotatedContent).toContain('聘请专业刑事辩护律师');
    });

    it('should NOT insert criminal lawyer advice for non-criminal domains', () => {
      const nonCriminalDomains: LegalDomain[] = [
        'CIVIL', 'CORPORATE', 'CONTRACT', 'VISA', 'TAX', 'IP', 'LABOR', 'TRADE', 'OTHER',
      ];
      for (const legalDomain of nonCriminalDomains) {
        const result = service.process(makeResponse({ legalDomain }));
        expect(result.hasCriminalLawyerAdvice).toBe(false);
        const criminalWarning = result.warnings.find((w) => w.type === 'CRIMINAL_LAWYER');
        expect(criminalWarning).toBeUndefined();
      }
    });

    it('should include both high-risk warning and criminal lawyer advice for high-risk criminal case', () => {
      const result = service.process(makeResponse({
        legalDomain: 'CRIMINAL',
        riskLevel: 'HIGH',
      }));

      expect(result.hasCriminalLawyerAdvice).toBe(true);
      expect(result.warnings.some((w) => w.type === 'HIGH_RISK')).toBe(true);
      expect(result.warnings.some((w) => w.type === 'CRIMINAL_LAWYER')).toBe(true);
    });
  });

  // ─── 4. Law change notice (Req 13.4) ──────────────────────

  describe('law change notice', () => {
    it('should insert law change notice when referenced laws are provided', () => {
      const result = service.process(makeResponse({
        referencedLaws: ['《公司法》', '《民法典》'],
      }));

      expect(result.hasLawChangeNotice).toBe(true);
      const lawChangeWarning = result.warnings.find((w) => w.type === 'LAW_CHANGE');
      expect(lawChangeWarning).toBeDefined();
      expect(lawChangeWarning!.message).toContain('《公司法》');
      expect(lawChangeWarning!.message).toContain('《民法典》');
    });

    it('should include law change notice in annotated content', () => {
      const result = service.process(makeResponse({
        referencedLaws: ['《刑法》'],
      }));

      expect(result.annotatedContent).toContain('法规变更提示');
      expect(result.annotatedContent).toContain('《刑法》');
    });

    it('should NOT insert law change notice when no referenced laws', () => {
      const result = service.process(makeResponse());

      expect(result.hasLawChangeNotice).toBe(false);
      const lawChangeWarning = result.warnings.find((w) => w.type === 'LAW_CHANGE');
      expect(lawChangeWarning).toBeUndefined();
    });

    it('should NOT insert law change notice for empty referenced laws array', () => {
      const result = service.process(makeResponse({ referencedLaws: [] }));

      expect(result.hasLawChangeNotice).toBe(false);
    });

    it('should filter out empty strings from referenced laws', () => {
      const result = service.process(makeResponse({
        referencedLaws: ['《公司法》', '', '  ', '《劳动法》'],
      }));

      expect(result.hasLawChangeNotice).toBe(true);
      const lawChangeWarning = result.warnings.find((w) => w.type === 'LAW_CHANGE');
      expect(lawChangeWarning!.message).toContain('《公司法》');
      expect(lawChangeWarning!.message).toContain('《劳动法》');
    });

    it('should return no notice when all referenced laws are empty strings', () => {
      const result = service.process(makeResponse({
        referencedLaws: ['', '  ', '\t'],
      }));

      expect(result.hasLawChangeNotice).toBe(false);
    });
  });

  // ─── 5. Annotated content structure ────────────────────────

  describe('annotated content structure', () => {
    it('should place warnings before content and disclaimer at the end', () => {
      const result = service.process(makeResponse({
        riskLevel: 'HIGH',
        legalDomain: 'CRIMINAL',
        referencedLaws: ['《刑法》'],
      }));

      const content = result.annotatedContent;
      const warningPos = content.indexOf('⚠️');
      const originalPos = content.indexOf(result.originalContent);
      const disclaimerPos = content.indexOf(DEFAULT_DISCLAIMER);

      // Warnings come first
      expect(warningPos).toBeLessThan(originalPos);
      // Disclaimer comes last
      expect(disclaimerPos).toBeGreaterThan(originalPos);
    });

    it('should preserve original content in annotated output', () => {
      const originalContent = '这是一段法律分析内容。';
      const result = service.process(makeResponse({ content: originalContent }));

      expect(result.annotatedContent).toContain(originalContent);
      expect(result.originalContent).toBe(originalContent);
    });

    it('should have no warnings for low-risk non-criminal case without referenced laws', () => {
      const result = service.process(makeResponse({
        riskLevel: 'LOW',
        legalDomain: 'CORPORATE',
      }));

      expect(result.warnings).toHaveLength(0);
      expect(result.hasCriminalLawyerAdvice).toBe(false);
      expect(result.hasLawChangeNotice).toBe(false);
      // Should still have disclaimer
      expect(result.annotatedContent).toContain(DEFAULT_DISCLAIMER);
    });
  });

  // ─── 6. Utility methods ───────────────────────────────────

  describe('utility methods', () => {
    it('getDisclaimer() should return the default disclaimer', () => {
      expect(service.getDisclaimer()).toBe(DEFAULT_DISCLAIMER);
    });

    it('isHighRisk() should return true only for HIGH', () => {
      expect(service.isHighRisk('HIGH')).toBe(true);
      expect(service.isHighRisk('MEDIUM')).toBe(false);
      expect(service.isHighRisk('LOW')).toBe(false);
    });

    it('isCriminalCase() should return true only for CRIMINAL', () => {
      expect(service.isCriminalCase('CRIMINAL')).toBe(true);
      expect(service.isCriminalCase('CIVIL')).toBe(false);
      expect(service.isCriminalCase('CORPORATE')).toBe(false);
    });

    it('buildLawChangeNotice() should return null for undefined input', () => {
      expect(service.buildLawChangeNotice(undefined)).toBeNull();
    });

    it('buildLawChangeNotice() should return null for empty array', () => {
      expect(service.buildLawChangeNotice([])).toBeNull();
    });

    it('buildLawChangeNotice() should format law names correctly', () => {
      const notice = service.buildLawChangeNotice(['《民法典》', '《公司法》', '《劳动法》']);
      expect(notice).toContain('《民法典》、《公司法》、《劳动法》');
    });
  });

  // ─── 7. Singleton pattern ─────────────────────────────────

  describe('singleton pattern', () => {
    it('getRiskWarningService should return the same instance', () => {
      const a = getRiskWarningService();
      const b = getRiskWarningService();
      expect(a).toBe(b);
    });

    it('resetRiskWarningService should clear the singleton', () => {
      const a = getRiskWarningService();
      resetRiskWarningService();
      const b = getRiskWarningService();
      expect(a).not.toBe(b);
    });
  });

  // ─── 8. Combined scenarios ────────────────────────────────

  describe('combined scenarios', () => {
    it('should handle all warnings together: high-risk criminal case with law references', () => {
      const result = service.process(makeResponse({
        riskLevel: 'HIGH',
        legalDomain: 'CRIMINAL',
        referencedLaws: ['《刑法》', '《刑事诉讼法》'],
      }));

      expect(result.warnings).toHaveLength(3);
      expect(result.warnings.some((w) => w.type === 'HIGH_RISK')).toBe(true);
      expect(result.warnings.some((w) => w.type === 'CRIMINAL_LAWYER')).toBe(true);
      expect(result.warnings.some((w) => w.type === 'LAW_CHANGE')).toBe(true);
      expect(result.hasCriminalLawyerAdvice).toBe(true);
      expect(result.hasLawChangeNotice).toBe(true);
      expect(result.disclaimer).toBe(DEFAULT_DISCLAIMER);
    });

    it('should handle medium-risk civil case with law references', () => {
      const result = service.process(makeResponse({
        riskLevel: 'MEDIUM',
        legalDomain: 'CIVIL',
        referencedLaws: ['《民法典》'],
      }));

      // Only law change notice, no high-risk or criminal warnings
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]!.type).toBe('LAW_CHANGE');
      expect(result.hasCriminalLawyerAdvice).toBe(false);
      expect(result.hasLawChangeNotice).toBe(true);
    });

    it('should handle DUAL jurisdiction correctly', () => {
      const result = service.process(makeResponse({
        jurisdiction: 'DUAL',
        riskLevel: 'HIGH',
        referencedLaws: ['《公司法》', 'Foreign Business Act'],
      }));

      expect(result.warnings.some((w) => w.type === 'HIGH_RISK')).toBe(true);
      const lawChange = result.warnings.find((w) => w.type === 'LAW_CHANGE');
      expect(lawChange!.message).toContain('《公司法》');
      expect(lawChange!.message).toContain('Foreign Business Act');
    });
  });
});
