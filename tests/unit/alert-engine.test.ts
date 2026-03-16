/**
 * Tests for Personalized Alert Engine
 * Task 33.5 — 个性化风险预警
 */

import { describe, it, expect } from 'vitest';
import { checkLawUpdates } from '@/server/services/ai/personalization/alert-engine';
import type { UserBusinessProfile, LawUpdate } from '@/server/services/ai/personalization/alert-engine';

const profile: UserBusinessProfile = {
  userId: 'user-1',
  industry: '房地产',
  operatingRegions: ['北京', '曼谷'],
};

const updates: LawUpdate[] = [
  {
    id: 'law-1',
    title: '房地产税法修订',
    affectedIndustries: ['房地产'],
    affectedRegions: ['全国'],
    summary: '房地产税率调整',
    effectiveDate: '2025-01-01',
  },
  {
    id: 'law-2',
    title: '泰国外商投资法修订',
    affectedIndustries: ['制造业'],
    affectedRegions: ['曼谷'],
    summary: '外商投资限制放宽',
    effectiveDate: '2025-03-01',
  },
  {
    id: 'law-3',
    title: '环保法修订',
    affectedIndustries: ['化工'],
    affectedRegions: ['上海'],
    summary: '排放标准提高',
    effectiveDate: '2025-06-01',
  },
];

describe('checkLawUpdates', () => {
  it('generates alerts for industry match', () => {
    const alerts = checkLawUpdates(profile, updates);
    const law1Alert = alerts.find((a) => a.lawUpdateId === 'law-1');
    expect(law1Alert).toBeDefined();
    expect(law1Alert!.matchReason).toContain('行业匹配');
  });

  it('generates alerts for region match', () => {
    const alerts = checkLawUpdates(profile, updates);
    const law2Alert = alerts.find((a) => a.lawUpdateId === 'law-2');
    expect(law2Alert).toBeDefined();
    expect(law2Alert!.matchReason).toContain('地区匹配');
  });

  it('does not generate alerts for non-matching updates', () => {
    const alerts = checkLawUpdates(profile, updates);
    const law3Alert = alerts.find((a) => a.lawUpdateId === 'law-3');
    expect(law3Alert).toBeUndefined();
  });

  it('returns empty for no matching updates', () => {
    const noMatchProfile: UserBusinessProfile = {
      userId: 'user-2',
      industry: '教育',
      operatingRegions: ['深圳'],
    };
    const alerts = checkLawUpdates(noMatchProfile, updates);
    expect(alerts).toHaveLength(0);
  });

  it('includes userId in alerts', () => {
    const alerts = checkLawUpdates(profile, updates);
    for (const alert of alerts) {
      expect(alert.userId).toBe('user-1');
    }
  });
});
