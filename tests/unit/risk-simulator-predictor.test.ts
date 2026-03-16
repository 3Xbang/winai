/**
 * Tests for Scenario Simulator & Outcome Predictor
 * Task 27.3 — 场景模拟与结果预测
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: vi.fn(() => mockGateway),
}));

const mockGateway = {
  chat: vi.fn(),
  parseJSON: vi.fn((resp: { content: string }) => JSON.parse(resp.content)),
};

import { simulateScenario } from '@/server/services/ai/risk/simulator';
import { predictOutcome, normalizeProbabilities } from '@/server/services/ai/risk/predictor';
import type { RiskAssessmentResult } from '@/server/services/ai/risk/assessor';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';

// ─── Fixtures ───────────────────────────────────────────────

const baseAssessment: RiskAssessmentResult = {
  dimensions: { legal: 60, financial: 40, compliance: 50, reputation: 30 },
  overallLevel: 'MEDIUM',
  heatMapData: [],
  details: '基线评估',
};

const sampleCase: CaseSubmission = {
  caseType: '合同纠纷',
  jurisdiction: 'china',
  facts: '甲方未按合同约定交付货物',
  evidence: ['合同原件', '催告函'],
  legalBasis: ['合同法第107条'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Simulator Tests ────────────────────────────────────────

describe('simulateScenario', () => {
  it('returns simulated assessment with modified dimensions', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        dimensions: { legal: 80, financial: 55, compliance: 60, reputation: 35 },
        details: '增加证据后法律风险上升',
        impactAnalysis: '新增证据导致法律维度风险显著增加',
      }),
    });

    const result = await simulateScenario(baseAssessment, { newEvidence: true });

    expect(result.baselineAssessment).toBe(baseAssessment);
    expect(result.modifiedParameters).toEqual({ newEvidence: true });
    expect(result.simulatedAssessment.dimensions.legal).toBe(80);
    expect(result.simulatedAssessment.dimensions.financial).toBe(55);
    expect(result.simulatedAssessment.dimensions.legal).toBeGreaterThan(baseAssessment.dimensions.legal);
    expect(result.impactAnalysis).toBeTruthy();
  });

  it('computes correct overallLevel for simulated result', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        dimensions: { legal: 95, financial: 85, compliance: 70, reputation: 60 },
        details: '高风险场景',
        impactAnalysis: '所有维度风险大幅上升',
      }),
    });

    const result = await simulateScenario(baseAssessment, { worstCase: true });
    expect(result.simulatedAssessment.overallLevel).toBe('CRITICAL');
  });

  it('clamps dimension scores to 0-100', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        dimensions: { legal: 150, financial: -10, compliance: 50, reputation: 200 },
        details: '',
        impactAnalysis: '',
      }),
    });

    const result = await simulateScenario(baseAssessment, {});
    expect(result.simulatedAssessment.dimensions.legal).toBe(100);
    expect(result.simulatedAssessment.dimensions.financial).toBe(0);
    expect(result.simulatedAssessment.dimensions.reputation).toBe(100);
  });

  it('falls back to baseline on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('LLM timeout'));

    const result = await simulateScenario(baseAssessment, { test: 1 });
    expect(result.simulatedAssessment.dimensions).toEqual(baseAssessment.dimensions);
    expect(result.impactAnalysis).toBe('');
  });

  it('uses baseline dimension when LLM returns non-numeric value', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        dimensions: { legal: 'high', financial: null, compliance: 70, reputation: undefined },
        details: '',
        impactAnalysis: '',
      }),
    });

    const result = await simulateScenario(baseAssessment, {});
    // Non-numeric values fall back to baseline
    expect(result.simulatedAssessment.dimensions.legal).toBe(baseAssessment.dimensions.legal);
    expect(result.simulatedAssessment.dimensions.financial).toBe(baseAssessment.dimensions.financial);
    expect(result.simulatedAssessment.dimensions.compliance).toBe(70);
    expect(result.simulatedAssessment.dimensions.reputation).toBe(baseAssessment.dimensions.reputation);
  });
});

// ─── Predictor Tests ────────────────────────────────────────

describe('predictOutcome', () => {
  it('returns normalized probabilities from LLM', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        winProbability: 0.6,
        loseProbability: 0.2,
        settleProbability: 0.2,
        predictionBasis: '基于合同法判例分析',
        similarCaseCount: 15,
      }),
    });

    const result = await predictOutcome(sampleCase);
    expect(result.winProbability).toBeCloseTo(0.6, 2);
    expect(result.loseProbability).toBeCloseTo(0.2, 2);
    expect(result.settleProbability).toBeCloseTo(0.2, 2);
    const sum = result.winProbability + result.loseProbability + result.settleProbability;
    expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.01);
    expect(result.predictionBasis).toBe('基于合同法判例分析');
    expect(result.similarCaseCount).toBe(15);
  });

  it('normalizes probabilities that do not sum to 1.0', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        winProbability: 0.5,
        loseProbability: 0.3,
        settleProbability: 0.4,
        predictionBasis: '',
        similarCaseCount: 5,
      }),
    });

    const result = await predictOutcome(sampleCase);
    const sum = result.winProbability + result.loseProbability + result.settleProbability;
    expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.01);
    // Proportions preserved
    expect(result.winProbability).toBeGreaterThan(result.loseProbability);
    expect(result.loseProbability).toBeLessThan(result.settleProbability);
  });

  it('handles all-zero probabilities with equal distribution', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        winProbability: 0,
        loseProbability: 0,
        settleProbability: 0,
        predictionBasis: '',
        similarCaseCount: 0,
      }),
    });

    const result = await predictOutcome(sampleCase);
    expect(result.winProbability).toBeCloseTo(1 / 3, 2);
    expect(result.loseProbability).toBeCloseTo(1 / 3, 2);
    expect(result.settleProbability).toBeCloseTo(1 / 3, 2);
  });

  it('clamps negative probabilities before normalizing', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        winProbability: -0.5,
        loseProbability: 0.8,
        settleProbability: 0.2,
        predictionBasis: '',
        similarCaseCount: 3,
      }),
    });

    const result = await predictOutcome(sampleCase);
    expect(result.winProbability).toBeGreaterThanOrEqual(0);
    expect(result.loseProbability).toBeGreaterThanOrEqual(0);
    expect(result.settleProbability).toBeGreaterThanOrEqual(0);
    const sum = result.winProbability + result.loseProbability + result.settleProbability;
    expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.01);
  });

  it('returns fallback on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('API error'));

    const result = await predictOutcome(sampleCase);
    const sum = result.winProbability + result.loseProbability + result.settleProbability;
    expect(Math.abs(sum - 1.0)).toBeLessThanOrEqual(0.01);
    expect(result.predictionBasis).toBe('');
    expect(result.similarCaseCount).toBe(0);
  });
});

// ─── normalizeProbabilities unit tests ──────────────────────

describe('normalizeProbabilities', () => {
  it('preserves already-normalized values', () => {
    const result = normalizeProbabilities(0.5, 0.3, 0.2);
    expect(result.win).toBeCloseTo(0.5, 5);
    expect(result.lose).toBeCloseTo(0.3, 5);
    expect(result.settle).toBeCloseTo(0.2, 5);
  });

  it('normalizes values that sum > 1', () => {
    const result = normalizeProbabilities(0.6, 0.6, 0.6);
    expect(result.win + result.lose + result.settle).toBeCloseTo(1.0, 5);
    expect(result.win).toBeCloseTo(1 / 3, 5);
  });

  it('handles NaN inputs', () => {
    const result = normalizeProbabilities(NaN, 0.5, 0.5);
    expect(result.win).toBe(0);
    expect(result.lose + result.settle).toBeCloseTo(1.0, 5);
  });
});
