import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ReferralManager,
  generateReferralCode,
  buildReferralUrl,
  extractReferralCode,
  isValidReferralCode,
} from '../../src/server/services/referral/manager';

// ============================================================
// Referral Code Generation Tests
// ============================================================

describe('Referral Code Generation', () => {
  it('should generate a code of exactly 8 characters', () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
  });

  it('should generate uppercase alphanumeric codes', () => {
    for (let i = 0; i < 20; i++) {
      const code = generateReferralCode();
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it('should generate unique codes across multiple calls', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateReferralCode());
    }
    // With 8 chars of base64url, collision in 100 codes is extremely unlikely
    expect(codes.size).toBe(100);
  });
});

// ============================================================
// Referral URL Tests
// ============================================================

describe('Referral URL Utilities', () => {
  it('should build a valid referral URL with code', () => {
    const url = buildReferralUrl('ABC12345', 'https://example.com');
    expect(url).toBe('https://example.com/register?ref=ABC12345');
  });

  it('should extract referral code from URL', () => {
    const code = extractReferralCode('https://example.com/register?ref=XYZ99999');
    expect(code).toBe('XYZ99999');
  });

  it('should return null when no ref param exists', () => {
    const code = extractReferralCode('https://example.com/register');
    expect(code).toBeNull();
  });

  it('should return null for invalid URL', () => {
    const code = extractReferralCode('');
    expect(code).toBeNull();
  });

  it('should handle relative URLs with ref param', () => {
    const code = extractReferralCode('/register?ref=TEST1234');
    expect(code).toBe('TEST1234');
  });
});

// ============================================================
// Referral Code Validation Tests
// ============================================================

describe('Referral Code Validation', () => {
  it('should accept valid 8-char uppercase alphanumeric codes', () => {
    expect(isValidReferralCode('ABCD1234')).toBe(true);
    expect(isValidReferralCode('12345678')).toBe(true);
    expect(isValidReferralCode('ZZZZZZZZ')).toBe(true);
  });

  it('should reject codes with wrong length', () => {
    expect(isValidReferralCode('ABC')).toBe(false);
    expect(isValidReferralCode('ABCDEFGHI')).toBe(false);
    expect(isValidReferralCode('')).toBe(false);
  });

  it('should reject codes with lowercase letters', () => {
    expect(isValidReferralCode('abcd1234')).toBe(false);
  });

  it('should reject codes with special characters', () => {
    expect(isValidReferralCode('ABC-1234')).toBe(false);
    expect(isValidReferralCode('ABC_1234')).toBe(false);
  });
});

// ============================================================
// ReferralManager Tests
// ============================================================

describe('ReferralManager', () => {
  let manager: ReferralManager;

  beforeEach(() => {
    manager = new ReferralManager();
  });

  describe('getOrCreateReferralCode', () => {
    it('should create a referral code for a new user', () => {
      const result = manager.getOrCreateReferralCode('user-1');
      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.code).toHaveLength(8);
      expect(result.usageCount).toBe(0);
    });

    it('should return the same code for the same user', () => {
      const first = manager.getOrCreateReferralCode('user-1');
      const second = manager.getOrCreateReferralCode('user-1');
      expect(first.code).toBe(second.code);
      expect(first.id).toBe(second.id);
    });

    it('should generate different codes for different users', () => {
      const code1 = manager.getOrCreateReferralCode('user-1');
      const code2 = manager.getOrCreateReferralCode('user-2');
      expect(code1.code).not.toBe(code2.code);
    });
  });

  describe('findByCode', () => {
    it('should find an existing referral code', () => {
      const created = manager.getOrCreateReferralCode('user-1');
      const found = manager.findByCode(created.code);
      expect(found).toBeDefined();
      expect(found!.userId).toBe('user-1');
    });

    it('should return null for non-existent code', () => {
      expect(manager.findByCode('NOTEXIST')).toBeNull();
    });
  });

  describe('recordReferral', () => {
    it('should record a valid referral', () => {
      const rc = manager.getOrCreateReferralCode('user-1');
      const referral = manager.recordReferral(rc.code, 'user-2');
      expect(referral).toBeDefined();
      expect(referral!.referredUserId).toBe('user-2');
      expect(referral!.rewardGranted).toBe(false);
    });

    it('should increment usage count on referral', () => {
      const rc = manager.getOrCreateReferralCode('user-1');
      manager.recordReferral(rc.code, 'user-2');
      const updated = manager.findByCode(rc.code);
      expect(updated!.usageCount).toBe(1);
    });

    it('should prevent self-referral', () => {
      const rc = manager.getOrCreateReferralCode('user-1');
      const result = manager.recordReferral(rc.code, 'user-1');
      expect(result).toBeNull();
    });

    it('should prevent duplicate referral for same user', () => {
      const rc = manager.getOrCreateReferralCode('user-1');
      manager.recordReferral(rc.code, 'user-2');
      const duplicate = manager.recordReferral(rc.code, 'user-2');
      expect(duplicate).toBeNull();
    });

    it('should return null for invalid code', () => {
      const result = manager.recordReferral('INVALID1', 'user-2');
      expect(result).toBeNull();
    });
  });

  describe('Referral Reward Logic', () => {
    it('should grant credits to both referrer and referee', () => {
      const rc = manager.getOrCreateReferralCode('referrer');
      const result = manager.processReferral(rc.code, 'referee');

      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.referrerUserId).toBe('referrer');
      expect(result!.referredUserId).toBe('referee');
      expect(result!.creditsAwarded).toBe(manager.getRewardCredits());

      // Both parties should have credits
      expect(manager.getUserCredits('referrer')).toBe(manager.getRewardCredits());
      expect(manager.getUserCredits('referee')).toBe(manager.getRewardCredits());
    });

    it('should accumulate credits for multiple referrals', () => {
      const rc = manager.getOrCreateReferralCode('referrer');
      manager.processReferral(rc.code, 'user-a');
      manager.processReferral(rc.code, 'user-b');
      manager.processReferral(rc.code, 'user-c');

      const credits = manager.getRewardCredits();
      expect(manager.getUserCredits('referrer')).toBe(credits * 3);
      expect(manager.getUserCredits('user-a')).toBe(credits);
      expect(manager.getUserCredits('user-b')).toBe(credits);
      expect(manager.getUserCredits('user-c')).toBe(credits);
    });

    it('should not grant reward for self-referral', () => {
      const rc = manager.getOrCreateReferralCode('user-1');
      const result = manager.processReferral(rc.code, 'user-1');
      expect(result).toBeNull();
      expect(manager.getUserCredits('user-1')).toBe(0);
    });

    it('should not grant duplicate rewards', () => {
      const rc = manager.getOrCreateReferralCode('referrer');
      const referral = manager.recordReferral(rc.code, 'referee');
      manager.grantReward(referral!.id);
      const duplicate = manager.grantReward(referral!.id);
      expect(duplicate).toBeNull();
      // Credits should only be awarded once
      expect(manager.getUserCredits('referrer')).toBe(manager.getRewardCredits());
    });
  });

  describe('getReferralStats', () => {
    it('should return stats for a user with referrals', () => {
      const rc = manager.getOrCreateReferralCode('user-1');
      manager.processReferral(rc.code, 'user-2');
      manager.processReferral(rc.code, 'user-3');

      const stats = manager.getReferralStats('user-1');
      expect(stats).toBeDefined();
      expect(stats!.code).toBe(rc.code);
      expect(stats!.totalReferrals).toBe(2);
      expect(stats!.rewardsGranted).toBe(2);
      expect(stats!.shareUrl).toContain(rc.code);
    });

    it('should return null for user without referral code', () => {
      expect(manager.getReferralStats('unknown')).toBeNull();
    });

    it('should return zero stats for new referral code', () => {
      manager.getOrCreateReferralCode('user-1');
      const stats = manager.getReferralStats('user-1');
      expect(stats!.totalReferrals).toBe(0);
      expect(stats!.rewardsGranted).toBe(0);
    });
  });

  describe('Referral Tracking', () => {
    it('should track referral via URL parameter extraction', () => {
      const rc = manager.getOrCreateReferralCode('user-1');
      const url = buildReferralUrl(rc.code);
      const extractedCode = extractReferralCode(url);

      expect(extractedCode).toBe(rc.code);

      const found = manager.findByCode(extractedCode!);
      expect(found).toBeDefined();
      expect(found!.userId).toBe('user-1');
    });

    it('should complete full referral flow via URL tracking', () => {
      // Step 1: User generates referral code
      const rc = manager.getOrCreateReferralCode('referrer');

      // Step 2: Build share URL
      const shareUrl = buildReferralUrl(rc.code);

      // Step 3: New user visits URL, extract code
      const code = extractReferralCode(shareUrl);
      expect(code).toBe(rc.code);

      // Step 4: New user registers, process referral
      const result = manager.processReferral(code!, 'new-user');
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);

      // Step 5: Verify both parties got credits
      expect(manager.getUserCredits('referrer')).toBeGreaterThan(0);
      expect(manager.getUserCredits('new-user')).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// Testimonial Display Filtering Tests
// ============================================================

describe('Testimonial Display Filtering', () => {
  interface TestimonialRecord {
    id: string;
    userName: string;
    content: string;
    rating: number;
    isApproved: boolean;
  }

  const ALL_TESTIMONIALS: TestimonialRecord[] = [
    { id: '1', userName: 'User A', content: 'Great service!', rating: 5, isApproved: true },
    { id: '2', userName: 'User B', content: 'Pending review', rating: 4, isApproved: false },
    { id: '3', userName: 'User C', content: 'Very helpful', rating: 5, isApproved: true },
    { id: '4', userName: 'User D', content: 'Rejected', rating: 1, isApproved: false },
    { id: '5', userName: 'User E', content: 'Excellent!', rating: 4, isApproved: true },
  ];

  function getApprovedTestimonials(testimonials: TestimonialRecord[]): TestimonialRecord[] {
    return testimonials.filter((t) => t.isApproved);
  }

  it('should only return approved testimonials', () => {
    const approved = getApprovedTestimonials(ALL_TESTIMONIALS);
    expect(approved).toHaveLength(3);
    expect(approved.every((t) => t.isApproved)).toBe(true);
  });

  it('should not include unapproved testimonials', () => {
    const approved = getApprovedTestimonials(ALL_TESTIMONIALS);
    const ids = approved.map((t) => t.id);
    expect(ids).not.toContain('2');
    expect(ids).not.toContain('4');
  });

  it('should return empty array when no testimonials are approved', () => {
    const noneApproved: TestimonialRecord[] = [
      { id: '1', userName: 'A', content: 'test', rating: 3, isApproved: false },
      { id: '2', userName: 'B', content: 'test', rating: 2, isApproved: false },
    ];
    expect(getApprovedTestimonials(noneApproved)).toHaveLength(0);
  });

  it('should preserve testimonial data integrity after filtering', () => {
    const approved = getApprovedTestimonials(ALL_TESTIMONIALS);
    for (const t of approved) {
      expect(t.userName).toBeDefined();
      expect(t.content).toBeDefined();
      expect(t.rating).toBeGreaterThanOrEqual(1);
      expect(t.rating).toBeLessThanOrEqual(5);
    }
  });

  it('should return all testimonials when all are approved', () => {
    const allApproved: TestimonialRecord[] = [
      { id: '1', userName: 'A', content: 'test', rating: 5, isApproved: true },
      { id: '2', userName: 'B', content: 'test', rating: 4, isApproved: true },
    ];
    expect(getApprovedTestimonials(allApproved)).toHaveLength(2);
  });
});

// ============================================================
// i18n Translation Keys Tests
// ============================================================

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

describe('Testimonials i18n translation keys', () => {
  const testimonialKeys = [
    'testimonials.title',
    'testimonials.subtitle',
    'testimonials.reviewCount',
    'testimonials.noReviews',
  ];

  for (const key of testimonialKeys) {
    it(`should have "${key}" in all locales`, () => {
      for (const locale of locales) {
        const localeData = translations[locale] as Record<string, unknown>;
        const value = getNestedValue(localeData, key);
        expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
        expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
        expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
      }
    });
  }
});

describe('Referral i18n translation keys', () => {
  const referralKeys = [
    'referral.title',
    'referral.subtitle',
    'referral.yourCode',
    'referral.shareLink',
    'referral.copyCode',
    'referral.copyLink',
    'referral.codeCopied',
    'referral.linkCopied',
    'referral.stats.totalReferrals',
    'referral.stats.rewardsGranted',
    'referral.stats.creditsEarned',
    'referral.howItWorks.title',
    'referral.howItWorks.step1',
    'referral.howItWorks.step2',
    'referral.howItWorks.step3',
    'referral.history',
    'referral.table.user',
    'referral.table.date',
    'referral.table.status',
    'referral.table.credits',
    'referral.table.completed',
    'referral.table.pending',
  ];

  for (const key of referralKeys) {
    it(`should have "${key}" in all locales`, () => {
      for (const locale of locales) {
        const localeData = translations[locale] as Record<string, unknown>;
        const value = getNestedValue(localeData, key);
        expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
        expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
        expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
      }
    });
  }
});

// ============================================================
// Page File Existence Tests
// ============================================================

describe('Page files exist', () => {
  it('should have testimonials page', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/testimonials/page.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should have referral page', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/referral/page.tsx');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('should have referral manager service', () => {
    const filePath = path.resolve(__dirname, '../../src/server/services/referral/manager.ts');
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

describe('Testimonials page structure', () => {
  const filePath = path.resolve(__dirname, '../../src/app/[locale]/testimonials/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('should be a client component', () => {
    expect(content).toContain("'use client'");
  });

  it('should use next-intl translations with testimonials namespace', () => {
    expect(content).toContain("useTranslations('testimonials')");
  });

  it('should display star ratings', () => {
    expect(content).toContain('Rate');
    expect(content).toContain('rating');
  });

  it('should display user info', () => {
    expect(content).toContain('userName');
    expect(content).toContain('Avatar');
  });

  it('should display review content', () => {
    expect(content).toContain('testimonial-content-');
  });

  it('should have testimonials grid', () => {
    expect(content).toContain('testimonials-grid');
  });
});

describe('Referral page structure', () => {
  const filePath = path.resolve(__dirname, '../../src/app/[locale]/referral/page.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');

  it('should be a client component', () => {
    expect(content).toContain("'use client'");
  });

  it('should use next-intl translations with referral namespace', () => {
    expect(content).toContain("useTranslations('referral')");
  });

  it('should display referral code', () => {
    expect(content).toContain('referral-code-input');
  });

  it('should display share link', () => {
    expect(content).toContain('referral-link-input');
  });

  it('should have copy buttons', () => {
    expect(content).toContain('copy-code-btn');
    expect(content).toContain('copy-link-btn');
  });

  it('should display referral stats', () => {
    expect(content).toContain('referral-stats');
    expect(content).toContain('stat-total-referrals');
    expect(content).toContain('stat-rewards-granted');
    expect(content).toContain('stat-credits-earned');
  });

  it('should have referral history table', () => {
    expect(content).toContain('referral-table');
  });
});
