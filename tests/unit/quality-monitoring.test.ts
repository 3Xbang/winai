/**
 * Tests for AI Quality Monitoring System
 * Tasks 34.1, 34.3, 34.5, 34.7, 34.9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: vi.fn(() => mockGateway),
}));

const mockGateway = {
  chat: vi.fn(),
  parseJSON: vi.fn((resp: { content: string }) => JSON.parse(resp.content)),
};

import { submitFeedback, getAverageSatisfaction, clearFeedback } from '@/server/services/ai/quality/feedback-collector';
import { assessConfidence, clearConsecutiveTracking } from '@/server/services/ai/quality/confidence-assessor';
import { triggerHumanEscalation, getEscalations, clearEscalations } from '@/server/services/ai/quality/escalation-manager';
import { checkHallucination, extractCitations } from '@/server/services/ai/quality/hallucination-detector';
import { assignABTest, clearABTests } from '@/server/services/ai/quality/ab-testing';
import { checkSLA, getSLAThreshold } from '@/server/services/ai/quality/sla-monitor';
import { generateMonthlyReport } from '@/server/services/ai/quality/report-generator';

beforeEach(() => {
  vi.clearAllMocks();
  clearFeedback();
  clearConsecutiveTracking();
  clearEscalations();
  clearABTests();
});

// ─── Feedback Tests ─────────────────────────────────────────

describe('Feedback Collector', () => {
  it('submits and retrieves feedback', () => {
    const fb = submitFeedback({ messageId: 'msg-1', userId: 'u-1', rating: 4, feedbackType: 'HELPFUL' });
    expect(fb.rating).toBe(4);
    expect(fb.feedbackType).toBe('HELPFUL');
  });

  it('clamps rating to 1-5', () => {
    const fb1 = submitFeedback({ messageId: 'msg-2', userId: 'u-1', rating: 0, feedbackType: 'UNHELPFUL' });
    const fb2 = submitFeedback({ messageId: 'msg-3', userId: 'u-1', rating: 10, feedbackType: 'HELPFUL' });
    expect(fb1.rating).toBe(1);
    expect(fb2.rating).toBe(5);
  });

  it('calculates average satisfaction', () => {
    submitFeedback({ messageId: 'a', userId: 'u', rating: 4, feedbackType: 'HELPFUL' });
    submitFeedback({ messageId: 'b', userId: 'u', rating: 2, feedbackType: 'UNHELPFUL' });
    expect(getAverageSatisfaction()).toBe(3);
  });
});

// ─── Confidence Tests ───────────────────────────────────────

describe('Confidence Assessor', () => {
  it('marks needsReview when score < 60', async () => {
    mockGateway.chat.mockResolvedValue({ content: JSON.stringify({ score: 45 }) });
    const result = await assessConfidence('msg-1', 'sess-1', 'response');
    expect(result.score).toBe(45);
    expect(result.needsReview).toBe(true);
  });

  it('does not mark review when score >= 60', async () => {
    mockGateway.chat.mockResolvedValue({ content: JSON.stringify({ score: 75 }) });
    const result = await assessConfidence('msg-2', 'sess-2', 'response');
    expect(result.needsReview).toBe(false);
  });

  it('triggers escalation after 2 consecutive low scores', async () => {
    mockGateway.chat.mockResolvedValue({ content: JSON.stringify({ score: 40 }) });
    await assessConfidence('msg-3', 'sess-3', 'response');
    const result = await assessConfidence('msg-4', 'sess-3', 'response');
    expect(result.needsEscalation).toBe(true);
  });

  it('resets consecutive count on good score', async () => {
    mockGateway.chat.mockResolvedValueOnce({ content: JSON.stringify({ score: 40 }) });
    mockGateway.chat.mockResolvedValueOnce({ content: JSON.stringify({ score: 80 }) });
    mockGateway.chat.mockResolvedValueOnce({ content: JSON.stringify({ score: 40 }) });
    await assessConfidence('a', 'sess-4', 'r');
    await assessConfidence('b', 'sess-4', 'r');
    const result = await assessConfidence('c', 'sess-4', 'r');
    expect(result.needsEscalation).toBe(false); // reset after 80
  });
});

// ─── Escalation Tests ───────────────────────────────────────

describe('Escalation Manager', () => {
  it('creates escalation ticket', () => {
    const esc = triggerHumanEscalation('sess-1', '连续低置信度');
    expect(esc.status).toBe('PENDING');
    expect(getEscalations()).toHaveLength(1);
  });
});

// ─── Hallucination Tests ────────────────────────────────────

describe('Hallucination Detector', () => {
  it('extracts law citations from content', () => {
    const citations = extractCitations('根据《合同法》第107条和《民法典》第680条的规定');
    expect(citations).toContain('《合同法》第107条');
    expect(citations).toContain('《民法典》第680条');
  });

  it('detects hallucinated citations', () => {
    const known = new Set(['《合同法》第107条']);
    const result = checkHallucination('msg-1', '根据《合同法》第107条和《虚构法》第999条', known);
    expect(result.hasHallucination).toBe(true);
    expect(result.shouldRegenerate).toBe(true);
    expect(result.unverifiedCitations).toContain('《虚构法》第999条');
    expect(result.verifiedCitations).toContain('《合同法》第107条');
  });

  it('passes when all citations are verified', () => {
    const known = new Set(['《合同法》第107条']);
    const result = checkHallucination('msg-2', '根据《合同法》第107条', known);
    expect(result.hasHallucination).toBe(false);
    expect(result.shouldRegenerate).toBe(false);
  });
});

// ─── A/B Testing Tests ──────────────────────────────────────

describe('A/B Testing', () => {
  it('assigns consistent variant for same user', () => {
    const v1 = assignABTest('user-1', 'prompt-test');
    const v2 = assignABTest('user-1', 'prompt-test');
    expect(v1.variant).toBe(v2.variant);
  });

  it('tracks metrics', () => {
    const result = assignABTest('user-2', 'test-1');
    expect(result.metrics.totalAssignments).toBeGreaterThanOrEqual(1);
  });
});

// ─── SLA Tests ──────────────────────────────────────────────

describe('SLA Monitor', () => {
  it('passes quick mode within 5s', () => {
    expect(checkSLA(3000, 'quick')).toBe(true);
    expect(checkSLA(6000, 'quick')).toBe(false);
  });

  it('passes deep mode within 30s', () => {
    expect(checkSLA(25000, 'deep')).toBe(true);
    expect(checkSLA(35000, 'deep')).toBe(false);
  });

  it('passes document mode within 60s', () => {
    expect(checkSLA(55000, 'document')).toBe(true);
    expect(checkSLA(65000, 'document')).toBe(false);
  });

  it('returns correct thresholds', () => {
    expect(getSLAThreshold('quick')).toBe(5000);
    expect(getSLAThreshold('deep')).toBe(30000);
    expect(getSLAThreshold('document')).toBe(60000);
  });
});

// ─── Report Tests ───────────────────────────────────────────

describe('Monthly Report', () => {
  it('generates report with rates in [0, 1]', () => {
    const report = generateMonthlyReport('2025-01', {
      totalConsultations: 100,
      accurateResponses: 85,
      totalSatisfactionScore: 400,
      hallucinationCount: 5,
      escalationCount: 3,
      slaCompliantCount: 92,
    });

    expect(report.responseAccuracyRate).toBe(0.85);
    expect(report.avgSatisfactionScore).toBe(4);
    expect(report.hallucinationRate).toBe(0.05);
    expect(report.humanEscalationRate).toBe(0.03);
    expect(report.slaComplianceRate).toBe(0.92);
    expect(report.totalConsultations).toBe(100);
  });

  it('clamps rates to [0, 1]', () => {
    const report = generateMonthlyReport('2025-02', {
      totalConsultations: 10,
      accurateResponses: 20, // > total
      totalSatisfactionScore: 50,
      hallucinationCount: 0,
      escalationCount: 0,
      slaCompliantCount: 10,
    });

    expect(report.responseAccuracyRate).toBeLessThanOrEqual(1);
    expect(report.slaComplianceRate).toBeLessThanOrEqual(1);
  });
});
