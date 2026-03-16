/**
 * Statute of Limitations Calculator — Pure rule engine
 * Calculates statute of limitations based on case type and jurisdiction.
 * No AI dependency — deterministic, pure function.
 * Requirements: 22.6
 */

// ─── Types ──────────────────────────────────────────────────

export interface StatuteOfLimitations {
  caseType: string;
  jurisdiction: 'china' | 'thailand';
  limitationYears: number;
  startDate: Date;
  expiryDate: Date;
  remainingDays: number;
  isExpired: boolean;
  reminderDates: Date[]; // 30 days, 7 days, 1 day before expiry
  legalBasis: string;
}

interface StatuteRule {
  years: number;
  legalBasis: string;
}

// ─── Statute Rules Table ────────────────────────────────────

export const STATUTE_RULES: Record<string, Record<string, StatuteRule>> = {
  china: {
    'general-civil': { years: 3, legalBasis: '《民法典》第188条' },
    'personal-injury': { years: 3, legalBasis: '《民法典》第188条' },
    contract: { years: 3, legalBasis: '《民法典》第188条' },
    'labor-dispute': { years: 1, legalBasis: '《劳动争议调解仲裁法》第27条' },
    ip: { years: 3, legalBasis: '《民法典》第188条' },
  },
  thailand: {
    'general-civil': { years: 10, legalBasis: 'Civil and Commercial Code Section 193/30' },
    'personal-injury': { years: 3, legalBasis: 'Civil and Commercial Code Section 448' },
    contract: { years: 10, legalBasis: 'Civil and Commercial Code Section 193/30' },
    'labor-dispute': { years: 2, legalBasis: 'Labor Protection Act Section 123' },
    tort: { years: 1, legalBasis: 'Civil and Commercial Code Section 448' },
  },
};

// Default rules when case type is not found
const DEFAULT_RULES: Record<string, StatuteRule> = {
  china: { years: 3, legalBasis: '《民法典》第188条（普通诉讼时效）' },
  thailand: { years: 10, legalBasis: 'Civil and Commercial Code Section 193/30 (General Prescription)' },
};

// ─── Helper Functions ───────────────────────────────────────

function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function diffDays(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((a.getTime() - b.getTime()) / msPerDay);
}

function calculateReminderDates(expiryDate: Date): Date[] {
  return [
    addDays(expiryDate, -30),
    addDays(expiryDate, -7),
    addDays(expiryDate, -1),
  ];
}

// ─── Main Calculator ────────────────────────────────────────

/**
 * Calculate statute of limitations for a given case type and jurisdiction.
 * Pure rule engine — deterministic, no AI dependency.
 */
export async function calculateStatuteOfLimitations(
  caseType: string,
  jurisdiction: 'china' | 'thailand',
  startDate: Date,
): Promise<StatuteOfLimitations> {
  const jurisdictionRules = STATUTE_RULES[jurisdiction] || {};
  const rule = jurisdictionRules[caseType] || DEFAULT_RULES[jurisdiction] || DEFAULT_RULES['china']!;

  const expiryDate = addYears(startDate, rule.years);
  const now = new Date();
  const remaining = diffDays(expiryDate, now);

  return {
    caseType,
    jurisdiction,
    limitationYears: rule.years,
    startDate,
    expiryDate,
    remainingDays: Math.max(remaining, 0),
    isExpired: now >= expiryDate,
    reminderDates: calculateReminderDates(expiryDate),
    legalBasis: rule.legalBasis,
  };
}
