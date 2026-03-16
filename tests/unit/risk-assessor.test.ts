/**
 * Unit tests for AI Risk Assessor
 * Requirements: 25.1, 25.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assess,
  computeOverallLevel,
  RISK_ASSESSMENT_PROMPT,
  type RiskAssessmentRequest,
  type RiskDimensions,
} from '@/server/services/ai/risk/assessor';

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

const sampleRequest: RiskAssessmentRequest = {
  caseInfo: {
    caseType: 'contract',
    jurisdiction: 'china',
    facts: '合同纠纷案件事实',
    evidence: ['合同原件'],
    legalBasis: ['《民法典》第577条'],
  },
  jurisdiction: { jurisdiction: 'CHINA' },
  assessmentType: 'FULL',
};

function makeLLMResult(overrides: Record<string, unknown> = {}) {
  return {
    dimensions: { legal: 65, financial: 45, compliance: 25, reputation: 30 },
    subScores: {
      legal: { '法律适用风险': 70, '管辖权风险': 60, '诉讼时效风险': 65 },
      financial: { '直接损失风险': 50, '间接损失风险': 40, '执行风险': 45 },
      compliance: { '行政处罚风险': 20, '监管合规风险': 30, '跨境合规风险': 25 },
      reputation: { '公众舆论风险': 35, '商业信誉风险': 25, '行业声誉风险': 30 },
    },
    details: '综合风险评估：法律风险较高，财务风险中等。',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('Risk Assessor', () => {
  it('returns assessment with all 4 dimensions in 0-100 range', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await assess(sampleRequest);

    expect(result.dimensions.legal).toBe(65);
    expect(result.dimensions.financial).toBe(45);
    expect(result.dimensions.compliance).toBe(25);
    expect(result.dimensions.reputation).toBe(30);

    for (const key of ['legal', 'financial', 'compliance', 'reputation'] as const) {
      expect(result.dimensions[key]).toBeGreaterThanOrEqual(0);
      expect(result.dimensions[key]).toBeLessThanOrEqual(100);
    }
  });

  it('computes overallLevel consistent with dimension scores', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await assess(sampleRequest);

    // legal=65, financial=45, compliance=25, reputation=30 → MEDIUM
    expect(result.overallLevel).toBe('MEDIUM');
  });

  it('generates heat map data points', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await assess(sampleRequest);

    // 4 dimensions × 3 sub-categories = 12 data points
    expect(result.heatMapData).toHaveLength(12);
    for (const point of result.heatMapData) {
      expect(point.dimension).toBeTruthy();
      expect(point.subCategory).toBeTruthy();
      expect(point.score).toBeGreaterThanOrEqual(0);
      expect(point.score).toBeLessThanOrEqual(100);
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(point.severity);
    }
  });

  it('details is a non-empty string', async () => {
    const llmResult = makeLLMResult();
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await assess(sampleRequest);
    expect(result.details).toBeTruthy();
  });

  it('handles LLM failure gracefully', async () => {
    mockChat.mockRejectedValue(new Error('LLM unavailable'));

    const result = await assess(sampleRequest);

    expect(result.dimensions.legal).toBe(0);
    expect(result.dimensions.financial).toBe(0);
    expect(result.overallLevel).toBe('LOW');
    expect(result.heatMapData).toEqual([]);
    expect(result.details).toBe('');
  });

  it('clamps out-of-range dimension scores', async () => {
    const llmResult = makeLLMResult({
      dimensions: { legal: 150, financial: -10, compliance: 50, reputation: 200 },
    });
    mockChat.mockResolvedValue({ content: JSON.stringify(llmResult) });
    mockParseJSON.mockReturnValue(llmResult);

    const result = await assess(sampleRequest);

    expect(result.dimensions.legal).toBe(100);
    expect(result.dimensions.financial).toBe(0);
    expect(result.dimensions.compliance).toBe(50);
    expect(result.dimensions.reputation).toBe(100);
  });

  it('system prompt contains 4 dimension names', () => {
    expect(RISK_ASSESSMENT_PROMPT).toContain('legal');
    expect(RISK_ASSESSMENT_PROMPT).toContain('financial');
    expect(RISK_ASSESSMENT_PROMPT).toContain('compliance');
    expect(RISK_ASSESSMENT_PROMPT).toContain('reputation');
    expect(RISK_ASSESSMENT_PROMPT).toContain('0-100');
    expect(RISK_ASSESSMENT_PROMPT).toContain('JSON');
  });
});

describe('computeOverallLevel', () => {
  it('returns LOW when all dimensions < 30', () => {
    const dims: RiskDimensions = { legal: 20, financial: 10, compliance: 25, reputation: 15 };
    expect(computeOverallLevel(dims)).toBe('LOW');
  });

  it('returns HIGH when any dimension > 80', () => {
    const dims: RiskDimensions = { legal: 85, financial: 30, compliance: 20, reputation: 10 };
    expect(computeOverallLevel(dims)).toBe('HIGH');
  });

  it('returns CRITICAL when any dimension > 90', () => {
    const dims: RiskDimensions = { legal: 95, financial: 30, compliance: 20, reputation: 10 };
    expect(computeOverallLevel(dims)).toBe('CRITICAL');
  });

  it('returns MEDIUM for moderate scores', () => {
    const dims: RiskDimensions = { legal: 50, financial: 40, compliance: 60, reputation: 35 };
    expect(computeOverallLevel(dims)).toBe('MEDIUM');
  });

  it('returns MEDIUM when some dimensions >= 30 but none > 80', () => {
    const dims: RiskDimensions = { legal: 30, financial: 50, compliance: 70, reputation: 60 };
    expect(computeOverallLevel(dims)).toBe('MEDIUM');
  });
});
