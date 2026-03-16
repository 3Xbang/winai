/**
 * Unit tests for AI Paralegal — Case Strength Scorer
 * Requirements: 22.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CASE_SCORING_PROMPT,
  scoreCaseStrength,
  type CaseSubmission,
  type CaseStrengthScore,
} from '@/server/services/ai/paralegal/case-scorer';

// ─── Mock LLM Gateway ───────────────────────────────────────

const mockChat = vi.fn();
const mockParseJSON = vi.fn();

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: () => ({
    chat: mockChat,
    parseJSON: mockParseJSON,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test Data ──────────────────────────────────────────────

const sampleCase: CaseSubmission = {
  caseType: 'contract',
  jurisdiction: 'china',
  facts: '甲方与乙方签订买卖合同，乙方未按期交付货物，造成甲方经济损失50万元。',
  evidence: ['买卖合同原件', '催货函', '损失计算报告'],
  legalBasis: ['《民法典》第577条', '《民法典》第584条'],
};

function makeLLMResult(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    dimensions: {
      evidenceSufficiency: { score: 80, explanation: '证据较为充分' },
      legalBasisStrength: { score: 70, explanation: '法律依据明确' },
      similarCaseTrends: { score: 60, explanation: '类似案例趋势一般' },
      proceduralCompliance: { score: 90, explanation: '程序合规' },
    },
    report: '案件整体强度较好，证据充分，法律依据明确。',
    riskFactors: ['证据链可能存在缺口', '对方可能提出不可抗力抗辩'],
    recommendations: ['补充物流记录', '准备损失鉴定报告'],
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('Case Strength Scorer', () => {
  it('generates case strength score with all 4 dimensions', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await scoreCaseStrength(sampleCase);

    expect(result.dimensions.evidenceSufficiency).toBeDefined();
    expect(result.dimensions.legalBasisStrength).toBeDefined();
    expect(result.dimensions.similarCaseTrends).toBeDefined();
    expect(result.dimensions.proceduralCompliance).toBeDefined();

    expect(result.dimensions.evidenceSufficiency.score).toBe(80);
    expect(result.dimensions.evidenceSufficiency.explanation).toBe('证据较为充分');
    expect(result.dimensions.legalBasisStrength.score).toBe(70);
    expect(result.dimensions.similarCaseTrends.score).toBe(60);
    expect(result.dimensions.proceduralCompliance.score).toBe(90);
  });

  it('overall score is average of 4 dimension scores', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await scoreCaseStrength(sampleCase);

    // (80 + 70 + 60 + 90) / 4 = 75
    expect(result.overall).toBe(75);
  });

  it('all dimension scores are in 0-100 range', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await scoreCaseStrength(sampleCase);

    const dims = result.dimensions;
    for (const dim of [
      dims.evidenceSufficiency,
      dims.legalBasisStrength,
      dims.similarCaseTrends,
      dims.proceduralCompliance,
    ]) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it('report is non-empty string', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await scoreCaseStrength(sampleCase);

    expect(typeof result.report).toBe('string');
    expect(result.report.length).toBeGreaterThan(0);
  });

  it('risk factors and recommendations are arrays', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await scoreCaseStrength(sampleCase);

    expect(Array.isArray(result.riskFactors)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.riskFactors.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
    result.riskFactors.forEach((r) => expect(typeof r).toBe('string'));
    result.recommendations.forEach((r) => expect(typeof r).toBe('string'));
  });

  it('handles LLM failure gracefully (returns default score)', async () => {
    mockChat.mockRejectedValue(new Error('LLM service unavailable'));

    const result = await scoreCaseStrength(sampleCase);

    expect(result.overall).toBe(0);
    expect(result.report).toBe('');
    expect(result.riskFactors).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(result.dimensions.evidenceSufficiency.score).toBe(0);
    expect(result.dimensions.legalBasisStrength.score).toBe(0);
    expect(result.dimensions.similarCaseTrends.score).toBe(0);
    expect(result.dimensions.proceduralCompliance.score).toBe(0);
  });

  it('system prompt contains scoring instructions', () => {
    expect(CASE_SCORING_PROMPT).toContain('evidenceSufficiency');
    expect(CASE_SCORING_PROMPT).toContain('legalBasisStrength');
    expect(CASE_SCORING_PROMPT).toContain('similarCaseTrends');
    expect(CASE_SCORING_PROMPT).toContain('proceduralCompliance');
    expect(CASE_SCORING_PROMPT).toContain('0-100');
    expect(CASE_SCORING_PROMPT).toContain('JSON');
    expect(CASE_SCORING_PROMPT).toContain('riskFactors');
    expect(CASE_SCORING_PROMPT).toContain('recommendations');
    expect(CASE_SCORING_PROMPT).toContain('report');
  });

  it('clamps out-of-range scores to 0-100', async () => {
    const llmResult = makeLLMResult({
      dimensions: {
        evidenceSufficiency: { score: 150, explanation: 'over max' },
        legalBasisStrength: { score: -20, explanation: 'under min' },
        similarCaseTrends: { score: 50, explanation: 'normal' },
        proceduralCompliance: { score: 200, explanation: 'way over' },
      },
    });
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await scoreCaseStrength(sampleCase);

    expect(result.dimensions.evidenceSufficiency.score).toBe(100);
    expect(result.dimensions.legalBasisStrength.score).toBe(0);
    expect(result.dimensions.similarCaseTrends.score).toBe(50);
    expect(result.dimensions.proceduralCompliance.score).toBe(100);
    // overall = (100 + 0 + 50 + 100) / 4 = 62.5 → 63
    expect(result.overall).toBe(63);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });
});
