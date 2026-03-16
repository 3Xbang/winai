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

describe('Case Analysis Page', () => {
  describe('Component file exists', () => {
    it('should have case analysis page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/case-analysis/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/case-analysis/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default CaseAnalysisPage function', () => {
      expect(content).toContain('export default function CaseAnalysisPage');
    });

    it('should use next-intl translations with caseAnalysis namespace', () => {
      expect(content).toContain("useTranslations('caseAnalysis')");
    });

    it('should have case type selection with all types', () => {
      expect(content).toContain('case-type-select');
      expect(content).toContain('CIVIL');
      expect(content).toContain('CRIMINAL');
      expect(content).toContain('ADMINISTRATIVE');
    });

    it('should have jurisdiction selection', () => {
      expect(content).toContain('jurisdiction-select');
      expect(content).toContain('CHINA');
      expect(content).toContain('THAILAND');
      expect(content).toContain('DUAL');
    });

    it('should have party information fields', () => {
      expect(content).toContain('party-name-1');
      expect(content).toContain('party-role-1');
      expect(content).toContain('party-name-2');
      expect(content).toContain('party-role-2');
    });

    it('should have case description textarea', () => {
      expect(content).toContain('case-description');
      expect(content).toContain('TextArea');
    });

    it('should have key facts and key dates inputs', () => {
      expect(content).toContain('key-facts');
      expect(content).toContain('key-dates');
    });

    it('should have analyze button', () => {
      expect(content).toContain('analyze-btn');
    });

    it('should have case form', () => {
      expect(content).toContain('case-form');
    });
  });
});

describe('Case Analysis Results Display', () => {
  const filePath = path.resolve(__dirname, '../../src/app/[locale]/case-analysis/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('should have analysis results container', () => {
    expect(content).toContain('analysis-results');
  });

  it('should display timeline using Ant Design Timeline component', () => {
    expect(content).toContain('Timeline');
    expect(content).toContain('timeline-card');
    expect(content).toContain('timeline-event');
  });

  it('should display timeline events in chronological order', () => {
    expect(content).toContain('timeline-component');
    expect(content).toContain('event.date');
    expect(content).toContain('event.event');
    expect(content).toContain('legalSignificance');
  });

  it('should display legal issues/dispute focus points', () => {
    expect(content).toContain('issues-card');
    expect(content).toContain('issue-item-');
    expect(content).toContain('legalBasis');
  });

  it('should display law references for each issue', () => {
    expect(content).toContain('basis.lawName');
    expect(content).toContain('basis.articleNumber');
    expect(content).toContain('basis.description');
  });

  it('should display three-perspective strategy (plaintiff, defendant, judge)', () => {
    expect(content).toContain('strategy-${strategy.perspective.toLowerCase()}');
    expect(content).toContain('plaintiffPerspective');
    expect(content).toContain('defendantPerspective');
    expect(content).toContain('judgePerspective');
  });

  it('should display key arguments for each perspective', () => {
    expect(content).toContain('keyArguments');
    expect(content).toContain('strategy.keyArguments.map');
  });

  it('should display overall strategy with recommendation and next steps', () => {
    expect(content).toContain('overall-strategy');
    expect(content).toContain('recommendation');
    expect(content).toContain('nextSteps');
  });

  it('should display risk level with color coding', () => {
    expect(content).toContain('riskLevel');
    expect(content).toContain("'red'");
    expect(content).toContain("'green'");
    expect(content).toContain("'orange'");
  });

  it('should have result tabs for timeline, issues, and strategies', () => {
    expect(content).toContain('result-tabs');
    expect(content).toContain('Tabs');
  });
});

describe('Evidence Page', () => {
  describe('Component file exists', () => {
    it('should have evidence page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/evidence/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/evidence/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default EvidencePage function', () => {
      expect(content).toContain('export default function EvidencePage');
    });

    it('should use next-intl translations with evidence namespace', () => {
      expect(content).toContain("useTranslations('evidence')");
    });

    it('should have evidence checklist display', () => {
      expect(content).toContain('checklist-card');
      expect(content).toContain('checklist-item-');
    });

    it('should display evidence type and priority for each item', () => {
      expect(content).toContain('evidenceTypes');
      expect(content).toContain('priority');
      expect(content).toContain('collectionSuggestion');
    });

    it('should implement priority color coding (ESSENTIAL=red, IMPORTANT=orange, SUPPLEMENTARY=blue)', () => {
      expect(content).toContain("ESSENTIAL: { color: 'text-red-600', tagColor: 'red' }");
      expect(content).toContain("IMPORTANT: { color: 'text-orange-500', tagColor: 'orange' }");
      expect(content).toContain("SUPPLEMENTARY: { color: 'text-blue-500', tagColor: 'blue' }");
    });

    it('should have evidence strength assessment section', () => {
      expect(content).toContain('assessment-card');
      expect(content).toContain('assessment-item-');
      expect(content).toContain('overallStrength');
    });

    it('should display strength with color coding (STRONG=green, MEDIUM=orange, WEAK=red)', () => {
      expect(content).toContain("STRONG: { icon:");
      expect(content).toContain("tagColor: 'green'");
      expect(content).toContain("MEDIUM: { icon:");
      expect(content).toContain("WEAK: { icon:");
    });

    it('should display legality risk and alternative collection when present', () => {
      expect(content).toContain('legalityRisk');
      expect(content).toContain('alternativeCollection');
    });

    it('should have evidence gaps section', () => {
      expect(content).toContain('gaps-card');
      expect(content).toContain('gap-item-');
    });

    it('should display gap importance with color coding', () => {
      expect(content).toContain("gap.importance === 'CRITICAL'");
      expect(content).toContain("gap.importance === 'IMPORTANT'");
    });

    it('should have link back to case analysis', () => {
      expect(content).toContain('/case-analysis');
    });

    it('should have generate checklist button', () => {
      expect(content).toContain('load-evidence-btn');
    });
  });
});

describe('Case Analysis and Evidence translation keys completeness', () => {
  const requiredKeys = [
    'caseAnalysis.title',
    'caseAnalysis.caseType',
    'caseAnalysis.selectCaseType',
    'caseAnalysis.caseTypes.CIVIL',
    'caseAnalysis.caseTypes.CRIMINAL',
    'caseAnalysis.caseTypes.ADMINISTRATIVE',
    'caseAnalysis.caseTypes.OTHER',
    'caseAnalysis.jurisdiction',
    'caseAnalysis.selectJurisdiction',
    'caseAnalysis.jurisdictions.CHINA',
    'caseAnalysis.jurisdictions.THAILAND',
    'caseAnalysis.jurisdictions.DUAL',
    'caseAnalysis.partyInfo',
    'caseAnalysis.partyName',
    'caseAnalysis.partyRole',
    'caseAnalysis.partyRoles.PLAINTIFF',
    'caseAnalysis.partyRoles.DEFENDANT',
    'caseAnalysis.partyRoles.THIRD_PARTY',
    'caseAnalysis.partyRoles.OTHER',
    'caseAnalysis.caseDescription',
    'caseAnalysis.enterDescription',
    'caseAnalysis.descriptionPlaceholder',
    'caseAnalysis.keyFacts',
    'caseAnalysis.keyFactsPlaceholder',
    'caseAnalysis.keyDates',
    'caseAnalysis.keyDatesPlaceholder',
    'caseAnalysis.additionalContext',
    'caseAnalysis.startAnalysis',
    'caseAnalysis.analyzing',
    'caseAnalysis.timeline',
    'caseAnalysis.legalSignificance',
    'caseAnalysis.disputeFocus',
    'caseAnalysis.issue',
    'caseAnalysis.legalBasis',
    'caseAnalysis.analysis',
    'caseAnalysis.strategies',
    'caseAnalysis.plaintiffPerspective',
    'caseAnalysis.defendantPerspective',
    'caseAnalysis.judgePerspective',
    'caseAnalysis.keyArguments',
    'caseAnalysis.riskAssessment',
    'caseAnalysis.overallStrategy',
    'caseAnalysis.recommendation',
    'caseAnalysis.riskLevel',
    'caseAnalysis.riskLevels.HIGH',
    'caseAnalysis.riskLevels.MEDIUM',
    'caseAnalysis.riskLevels.LOW',
    'caseAnalysis.nextSteps',
    'evidence.title',
    'evidence.backToCaseAnalysis',
    'evidence.generateChecklist',
    'evidence.loading',
    'evidence.checklist',
    'evidence.priorities.ESSENTIAL',
    'evidence.priorities.IMPORTANT',
    'evidence.priorities.SUPPLEMENTARY',
    'evidence.evidenceTypes.DOCUMENTARY',
    'evidence.evidenceTypes.PHYSICAL',
    'evidence.evidenceTypes.TESTIMONY',
    'evidence.evidenceTypes.ELECTRONIC',
    'evidence.evidenceTypes.EXPERT_OPINION',
    'evidence.collectionSuggestion',
    'evidence.strengthAssessment',
    'evidence.overallStrength',
    'evidence.strengths.STRONG',
    'evidence.strengths.MEDIUM',
    'evidence.strengths.WEAK',
    'evidence.legalityRisk',
    'evidence.alternativeCollection',
    'evidence.evidenceGaps',
    'evidence.noGaps',
    'evidence.gapImportance.CRITICAL',
    'evidence.gapImportance.IMPORTANT',
    'evidence.gapImportance.OPTIONAL',
    'evidence.relatedIssue',
    'evidence.suggestion',
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
