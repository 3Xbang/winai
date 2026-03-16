/**
 * Tests for Enterprise Knowledge & Recommender
 * Task 33.3 — 企业知识积累与个性化推荐
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getEnterpriseKnowledge,
  accumulateKnowledge,
  clearKnowledge,
} from '@/server/services/ai/personalization/enterprise-knowledge';
import {
  recordConsultation,
  getRecommendations,
  clearHistory,
} from '@/server/services/ai/personalization/recommender';

beforeEach(() => {
  clearKnowledge();
  clearHistory();
});

describe('Enterprise Knowledge', () => {
  it('returns null for unknown enterprise', () => {
    expect(getEnterpriseKnowledge('unknown')).toBeNull();
  });

  it('accumulates knowledge from consultations', () => {
    accumulateKnowledge('ent-1', { topic: '劳动纠纷', keyFindings: ['加班费争议'], conclusion: '建议协商解决' });
    const knowledge = getEnterpriseKnowledge('ent-1');
    expect(knowledge).not.toBeNull();
    expect(knowledge!.commonIssues).toContain('劳动纠纷');
    expect(knowledge!.historicalConclusions).toContain('建议协商解决');
  });

  it('does not duplicate topics', () => {
    accumulateKnowledge('ent-2', { topic: '合同审查', keyFindings: [], conclusion: '合规' });
    accumulateKnowledge('ent-2', { topic: '合同审查', keyFindings: [], conclusion: '需修改' });
    const knowledge = getEnterpriseKnowledge('ent-2');
    expect(knowledge!.commonIssues.filter((i) => i === '合同审查')).toHaveLength(1);
    expect(knowledge!.historicalConclusions).toHaveLength(2);
  });
});

describe('Recommender', () => {
  it('returns empty for user with no history', () => {
    expect(getRecommendations('new-user')).toEqual([]);
  });

  it('returns recommendations based on history', () => {
    recordConsultation('user-1', '劳动法');
    const recs = getRecommendations('user-1');
    expect(recs.length).toBeGreaterThanOrEqual(1);
    expect(recs[0].type).toBe('article');
    expect(recs[0].relevanceScore).toBeGreaterThan(0);
  });

  it('uses most recent topic for recommendations', () => {
    recordConsultation('user-2', '合同法');
    recordConsultation('user-2', '知识产权');
    const recs = getRecommendations('user-2');
    expect(recs[0].title).toContain('知识产权');
  });
});
