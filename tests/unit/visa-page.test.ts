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

describe('Visa Consultation Page', () => {
  describe('Component file exists', () => {
    it('should have visa page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/visa/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/visa/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default VisaPage function', () => {
      expect(content).toContain('export default function VisaPage');
    });

    it('should use next-intl translations with visa namespace', () => {
      expect(content).toContain("useTranslations('visa')");
    });

    it('should have nationality input field', () => {
      expect(content).toContain('nationality-input');
    });

    it('should have current visa type selection', () => {
      expect(content).toContain('current-visa-select');
      expect(content).toContain('NONE');
      expect(content).toContain('TOURIST');
      expect(content).toContain('NON_B');
      expect(content).toContain('NON_O');
      expect(content).toContain('ELITE');
    });

    it('should have purpose of stay selection with all purposes', () => {
      expect(content).toContain('purpose-select');
      expect(content).toContain('TOURISM');
      expect(content).toContain('BUSINESS');
      expect(content).toContain('WORK');
      expect(content).toContain('RETIREMENT');
      expect(content).toContain('EDUCATION');
      expect(content).toContain('FAMILY');
      expect(content).toContain('INVESTMENT');
      expect(content).toContain('DIGITAL_NOMAD');
    });

    it('should have duration selection', () => {
      expect(content).toContain('duration-select');
      expect(content).toContain('SHORT');
      expect(content).toContain('MEDIUM');
      expect(content).toContain('LONG');
      expect(content).toContain('EXTENDED');
    });

    it('should have occupation input field', () => {
      expect(content).toContain('occupation-input');
    });

    it('should have budget range selection', () => {
      expect(content).toContain('budget-select');
      expect(content).toContain('LOW');
      expect(content).toContain('PREMIUM');
    });

    it('should have analyze button', () => {
      expect(content).toContain('analyze-btn');
    });

    it('should have visa form', () => {
      expect(content).toContain('visa-form');
    });
  });
});

describe('Visa Recommendation Results Display', () => {
  const filePath = path.resolve(__dirname, '../../src/app/[locale]/visa/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('should have results container', () => {
    expect(content).toContain('visa-results');
  });

  it('should display visa result cards with index', () => {
    expect(content).toContain('visa-result-');
  });

  it('should display match score for each recommendation', () => {
    expect(content).toContain('matchScore');
    expect(content).toContain('match-score-');
    expect(content).toContain('Progress');
  });

  it('should display requirements section', () => {
    expect(content).toContain('requirements-');
    expect(content).toContain('recommendation.requirements.map');
  });

  it('should display required documents section', () => {
    expect(content).toContain('documents-');
    expect(content).toContain('recommendation.documents.map');
  });

  it('should display application process steps', () => {
    expect(content).toContain('process-steps-');
    expect(content).toContain('process-step-');
    expect(content).toContain('Steps');
  });

  it('should display estimated cost with breakdown', () => {
    expect(content).toContain('cost-');
    expect(content).toContain('estimatedCost.amount');
    expect(content).toContain('estimatedCost.currency');
    expect(content).toContain('estimatedCost.breakdown');
  });

  it('should display rejection risks and avoidance advice', () => {
    expect(content).toContain('risks-');
    expect(content).toContain('commonRejectionReasons');
    expect(content).toContain('avoidanceAdvice');
  });

  it('should display processing time when available', () => {
    expect(content).toContain('processing-time-');
    expect(content).toContain('processingTime');
  });

  it('should handle empty results with Empty component', () => {
    expect(content).toContain('no-results');
    expect(content).toContain('Empty');
  });

  it('should include common Thai visa types in mock data', () => {
    expect(content).toContain('Non-Immigrant B');
    expect(content).toContain('Elite');
  });
});

describe('Visa translation keys completeness', () => {
  const requiredKeys = [
    'visa.title',
    'visa.subtitle',
    'visa.form.nationality',
    'visa.form.nationalityPlaceholder',
    'visa.form.currentVisaType',
    'visa.form.currentVisaTypePlaceholder',
    'visa.form.purpose',
    'visa.form.purposePlaceholder',
    'visa.form.duration',
    'visa.form.durationPlaceholder',
    'visa.form.occupation',
    'visa.form.occupationPlaceholder',
    'visa.form.budget',
    'visa.form.budgetPlaceholder',
    'visa.purposes.TOURISM',
    'visa.purposes.BUSINESS',
    'visa.purposes.WORK',
    'visa.purposes.RETIREMENT',
    'visa.purposes.EDUCATION',
    'visa.purposes.FAMILY',
    'visa.purposes.INVESTMENT',
    'visa.purposes.DIGITAL_NOMAD',
    'visa.durations.SHORT',
    'visa.durations.MEDIUM',
    'visa.durations.LONG',
    'visa.durations.EXTENDED',
    'visa.budgets.LOW',
    'visa.budgets.MEDIUM',
    'visa.budgets.HIGH',
    'visa.budgets.PREMIUM',
    'visa.currentVisaTypes.NONE',
    'visa.currentVisaTypes.TOURIST',
    'visa.currentVisaTypes.NON_B',
    'visa.currentVisaTypes.NON_O',
    'visa.currentVisaTypes.EDUCATION',
    'visa.currentVisaTypes.RETIREMENT',
    'visa.currentVisaTypes.ELITE',
    'visa.currentVisaTypes.OTHER',
    'visa.analyze',
    'visa.analyzing',
    'visa.results.title',
    'visa.results.matchScore',
    'visa.results.visaType',
    'visa.results.requirements',
    'visa.results.documents',
    'visa.results.process',
    'visa.results.estimatedDuration',
    'visa.results.estimatedCost',
    'visa.results.costBreakdown',
    'visa.results.rejectionRisks',
    'visa.results.avoidanceAdvice',
    'visa.results.processingTime',
    'visa.results.noResults',
    'visa.visaTypes.TOURIST',
    'visa.visaTypes.NON_B',
    'visa.visaTypes.NON_O',
    'visa.visaTypes.ELITE',
    'visa.visaTypes.BOI',
    'visa.visaTypes.SMART',
    'visa.visaTypes.EDUCATION',
    'visa.visaTypes.RETIREMENT',
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
