import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  return keyPath.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const locales = ['zh', 'en', 'th'];
const translations = locales.reduce(
  (acc, locale) => {
    const filePath = path.resolve(__dirname, `../../messages/${locale}.json`);
    acc[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return acc;
  },
  {} as Record<string, Record<string, unknown>>
);

describe('Contract Landing Page', () => {
  describe('Component file exists', () => {
    it('should have contract landing page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/contract/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/contract/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default ContractPage function', () => {
      expect(content).toContain('export default function ContractPage');
    });

    it('should use next-intl translations with contract namespace', () => {
      expect(content).toContain("useTranslations('contract')");
    });

    it('should have links to draft and review sub-pages', () => {
      expect(content).toContain('/contract/draft');
      expect(content).toContain('/contract/review');
    });

    it('should have draft and review cards', () => {
      expect(content).toContain('draft-card');
      expect(content).toContain('review-card');
    });
  });
});

describe('Contract Draft Page', () => {
  describe('Component file exists', () => {
    it('should have contract draft page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/contract/draft/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/contract/draft/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default ContractDraftPage function', () => {
      expect(content).toContain('export default function ContractDraftPage');
    });

    it('should use next-intl translations with contract.draft namespace', () => {
      expect(content).toContain("useTranslations('contract.draft')");
    });

    it('should have contract type selection', () => {
      expect(content).toContain('contract-type-select');
      expect(content).toContain('EMPLOYMENT');
      expect(content).toContain('SALE');
      expect(content).toContain('SERVICE');
      expect(content).toContain('LEASE');
      expect(content).toContain('PARTNERSHIP');
      expect(content).toContain('OTHER');
    });

    it('should have party A and party B information fields', () => {
      expect(content).toContain('party-a-name');
      expect(content).toContain('party-b-name');
      expect(content).toContain('partyAName');
      expect(content).toContain('partyBName');
    });

    it('should have key terms inputs (governing law, dispute resolution)', () => {
      expect(content).toContain('governing-law');
      expect(content).toContain('dispute-resolution');
    });

    it('should have language selection checkboxes', () => {
      expect(content).toContain('language-checkboxes');
      expect(content).toContain("'zh'");
      expect(content).toContain("'en'");
      expect(content).toContain("'th'");
    });

    it('should have special clauses text area', () => {
      expect(content).toContain('special-clauses');
    });

    it('should have generate button', () => {
      expect(content).toContain('generate-btn');
    });

    it('should have result display area', () => {
      expect(content).toContain('draft-result');
    });

    it('should have copy text functionality', () => {
      expect(content).toContain('copy-btn');
      expect(content).toContain('handleCopy');
    });

    it('should have back navigation to contract landing page', () => {
      expect(content).toContain('/contract');
      expect(content).toContain('ArrowLeftOutlined');
    });
  });
});

describe('Contract Review Page', () => {
  describe('Component file exists', () => {
    it('should have contract review page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/contract/review/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/contract/review/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default ContractReviewPage function', () => {
      expect(content).toContain('export default function ContractReviewPage');
    });

    it('should use next-intl translations with contract.review namespace', () => {
      expect(content).toContain("useTranslations('contract.review')");
    });

    it('should have text paste area for contract input', () => {
      expect(content).toContain('contract-text-input');
      expect(content).toContain('TextArea');
    });

    it('should have file upload option using FileUpload component', () => {
      expect(content).toContain('FileUpload');
      expect(content).toContain('uploadFile');
    });

    it('should have tabs for paste text and upload file', () => {
      expect(content).toContain('input-tabs');
      expect(content).toContain('Tabs');
    });

    it('should have review button', () => {
      expect(content).toContain('review-btn');
    });

    it('should display overall risk level', () => {
      expect(content).toContain('overall-risk');
      expect(content).toContain('overallRiskLevel');
    });

    it('should implement risk color coding (HIGH=red, MEDIUM=orange, LOW=green)', () => {
      expect(content).toContain('red');
      expect(content).toContain('orange');
      expect(content).toContain('green');
      expect(content).toContain("HIGH: { color: 'text-red-600'");
      expect(content).toContain("MEDIUM: { color: 'text-orange-500'");
      expect(content).toContain("LOW: { color: 'text-green-600'");
    });

    it('should display risk items with clause reference, level, description, legal basis, suggestion', () => {
      expect(content).toContain('risk-item-');
      expect(content).toContain('clauseIndex');
      expect(content).toContain('riskLevel');
      expect(content).toContain('riskDescription');
      expect(content).toContain('legalBasis');
      expect(content).toContain('suggestedRevision');
    });

    it('should display review report', () => {
      expect(content).toContain('reviewReport');
    });

    it('should have risk count summary', () => {
      expect(content).toContain('riskCounts');
      expect(content).toContain('high');
      expect(content).toContain('medium');
      expect(content).toContain('low');
    });

    it('should have back navigation to contract landing page', () => {
      expect(content).toContain('/contract');
      expect(content).toContain('ArrowLeftOutlined');
    });
  });
});

describe('Contract translation keys completeness', () => {
  const requiredKeys = [
    'contract.title',
    'contract.subtitle',
    'contract.draftTitle',
    'contract.draftDescription',
    'contract.reviewTitle',
    'contract.reviewDescription',
    'contract.goToDraft',
    'contract.goToReview',
    'contract.draft.title',
    'contract.draft.contractType',
    'contract.draft.selectType',
    'contract.draft.types.EMPLOYMENT',
    'contract.draft.types.SALE',
    'contract.draft.types.SERVICE',
    'contract.draft.types.LEASE',
    'contract.draft.types.PARTNERSHIP',
    'contract.draft.types.OTHER',
    'contract.draft.partyInfo',
    'contract.draft.partyA',
    'contract.draft.partyB',
    'contract.draft.partyName',
    'contract.draft.partyRole',
    'contract.draft.partyNationality',
    'contract.draft.partyAddress',
    'contract.draft.keyTerms',
    'contract.draft.governingLaw',
    'contract.draft.disputeResolution',
    'contract.draft.language',
    'contract.draft.specialClauses',
    'contract.draft.generate',
    'contract.draft.generating',
    'contract.draft.result',
    'contract.draft.copyText',
    'contract.draft.copied',
    'contract.review.title',
    'contract.review.inputMethod',
    'contract.review.pasteText',
    'contract.review.uploadFile',
    'contract.review.contractText',
    'contract.review.contractTextPlaceholder',
    'contract.review.startReview',
    'contract.review.reviewing',
    'contract.review.results',
    'contract.review.overallRisk',
    'contract.review.riskItems',
    'contract.review.riskHigh',
    'contract.review.riskMedium',
    'contract.review.riskLow',
    'contract.review.clause',
    'contract.review.riskLevel',
    'contract.review.description',
    'contract.review.legalBasis',
    'contract.review.suggestion',
    'contract.review.reviewReport',
  ];

  for (const key of requiredKeys) {
    it(`should have translation key "${key}" in all locales`, () => {
      for (const locale of locales) {
        const trans = translations[locale] as Record<string, unknown>;
        const value = getNestedValue(trans, key);
        expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
        expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
        expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
      }
    });
  }
});
