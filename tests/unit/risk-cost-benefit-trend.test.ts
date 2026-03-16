/**
 * Tests for Cost-Benefit Analyzer & Risk Trend Tracker
 * Task 27.6 — 成本效益分析与风险趋势追踪
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: vi.fn(() => mockGateway),
}));

const mockGateway = {
  chat: vi.fn(),
  parseJSON: vi.fn((resp: { content: string }) => JSON.parse(resp.content)),
};

import { analyzeCostBenefit } from '@/server/services/ai/risk/cost-benefit';
import { trackRiskTrend } from '@/server/services/ai/risk/trend-tracker';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';
import type { RiskTrendDataPoint } from '@/server/services/ai/risk/trend-tracker';

const sampleCase: CaseSubmission = {
  caseType: '劳动纠纷',
  jurisdiction: 'thailand',
  facts: '雇主未支付加班费',
  evidence: ['劳动合同', '工资单'],
  legalBasis: ['泰国劳动保护法'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Cost-Benefit Tests ─────────────────────────────────────

describe('analyzeCostBenefit', () => {
  it('returns three resolution paths from LLM', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        litigation: { cost: 50000, time: '6-12个月', probability: 0.7, potentialOutcome: '胜诉获赔' },
        settlement: { cost: 20000, time: '1-3个月', probability: 0.8, potentialOutcome: '和解获赔80%' },
        mediation: { cost: 10000, time: '1-2个月', probability: 0.6, potentialOutcome: '调解获赔60%' },
        recommendation: '建议优先尝试调解',
      }),
    });

    const result = await analyzeCostBenefit(sampleCase);
    expect(result.litigation.cost).toBe(50000);
    expect(result.settlement.time).toBe('1-3个月');
    expect(result.mediation.probability).toBe(0.6);
    expect(result.recommendation).toBe('建议优先尝试调解');
  });

  it('clamps probability to [0, 1]', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        litigation: { cost: 100, time: '1月', probability: 1.5, potentialOutcome: 'ok' },
        settlement: { cost: 100, time: '1月', probability: -0.3, potentialOutcome: 'ok' },
        mediation: { cost: 100, time: '1月', probability: 0.5, potentialOutcome: 'ok' },
        recommendation: '',
      }),
    });

    const result = await analyzeCostBenefit(sampleCase);
    expect(result.litigation.probability).toBe(1);
    expect(result.settlement.probability).toBe(0);
    expect(result.mediation.probability).toBe(0.5);
  });

  it('returns defaults on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('timeout'));

    const result = await analyzeCostBenefit(sampleCase);
    expect(result.litigation.cost).toBe(0);
    expect(result.settlement.cost).toBe(0);
    expect(result.mediation.cost).toBe(0);
    expect(result.recommendation).toBe('');
  });

  it('handles missing path fields gracefully', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        litigation: { cost: 5000 },
        settlement: null,
        mediation: { time: '2周' },
        recommendation: '建议诉讼',
      }),
    });

    const result = await analyzeCostBenefit(sampleCase);
    expect(result.litigation.cost).toBe(5000);
    expect(result.litigation.time).toBe('');
    expect(result.settlement.cost).toBe(0);
    expect(result.mediation.cost).toBe(0);
    expect(result.mediation.time).toBe('2周');
  });
});

// ─── Trend Tracker Tests ────────────────────────────────────

describe('trackRiskTrend', () => {
  const stablePoints: RiskTrendDataPoint[] = [
    { date: '2024-01-01', overallLevel: 'MEDIUM', dimensions: { legal: 50, financial: 50, compliance: 50, reputation: 50 } },
    { date: '2024-02-01', overallLevel: 'MEDIUM', dimensions: { legal: 52, financial: 48, compliance: 51, reputation: 49 } },
    { date: '2024-03-01', overallLevel: 'MEDIUM', dimensions: { legal: 51, financial: 50, compliance: 50, reputation: 50 } },
    { date: '2024-04-01', overallLevel: 'MEDIUM', dimensions: { legal: 50, financial: 51, compliance: 49, reputation: 50 } },
  ];

  it('detects STABLE trend when scores barely change', () => {
    const report = trackRiskTrend('ent-001', stablePoints);
    expect(report.trend).toBe('STABLE');
    expect(report.enterpriseId).toBe('ent-001');
    expect(report.dataPoints).toHaveLength(4);
  });

  it('detects WORSENING trend when later scores are higher', () => {
    const worseningPoints: RiskTrendDataPoint[] = [
      { date: '2024-01-01', overallLevel: 'LOW', dimensions: { legal: 20, financial: 20, compliance: 20, reputation: 20 } },
      { date: '2024-02-01', overallLevel: 'MEDIUM', dimensions: { legal: 50, financial: 50, compliance: 50, reputation: 50 } },
      { date: '2024-03-01', overallLevel: 'HIGH', dimensions: { legal: 70, financial: 70, compliance: 70, reputation: 70 } },
      { date: '2024-04-01', overallLevel: 'CRITICAL', dimensions: { legal: 90, financial: 90, compliance: 90, reputation: 90 } },
    ];
    const report = trackRiskTrend('ent-002', worseningPoints);
    expect(report.trend).toBe('WORSENING');
  });

  it('detects IMPROVING trend when later scores are lower', () => {
    const improvingPoints: RiskTrendDataPoint[] = [
      { date: '2024-01-01', overallLevel: 'HIGH', dimensions: { legal: 80, financial: 80, compliance: 80, reputation: 80 } },
      { date: '2024-02-01', overallLevel: 'MEDIUM', dimensions: { legal: 60, financial: 60, compliance: 60, reputation: 60 } },
      { date: '2024-03-01', overallLevel: 'LOW', dimensions: { legal: 30, financial: 30, compliance: 30, reputation: 30 } },
      { date: '2024-04-01', overallLevel: 'LOW', dimensions: { legal: 20, financial: 20, compliance: 20, reputation: 20 } },
    ];
    const report = trackRiskTrend('ent-003', improvingPoints);
    expect(report.trend).toBe('IMPROVING');
  });

  it('generates alerts when dimension jumps 20+ points', () => {
    const alertPoints: RiskTrendDataPoint[] = [
      { date: '2024-01-01', overallLevel: 'LOW', dimensions: { legal: 30, financial: 30, compliance: 30, reputation: 30 } },
      { date: '2024-02-01', overallLevel: 'HIGH', dimensions: { legal: 80, financial: 30, compliance: 30, reputation: 30 } },
    ];
    const report = trackRiskTrend('ent-004', alertPoints);
    expect(report.alerts.length).toBeGreaterThanOrEqual(1);
    expect(report.alerts[0].dimension).toBe('legal');
    expect(report.alerts[0].currentLevel).toBe('HIGH');
  });

  it('returns STABLE with empty summary for no data', () => {
    const report = trackRiskTrend('ent-005', []);
    expect(report.trend).toBe('STABLE');
    expect(report.summary).toBe('暂无历史数据');
    expect(report.alerts).toHaveLength(0);
  });

  it('sorts data points by date', () => {
    const unsorted: RiskTrendDataPoint[] = [
      { date: '2024-03-01', overallLevel: 'MEDIUM', dimensions: { legal: 50, financial: 50, compliance: 50, reputation: 50 } },
      { date: '2024-01-01', overallLevel: 'LOW', dimensions: { legal: 20, financial: 20, compliance: 20, reputation: 20 } },
    ];
    const report = trackRiskTrend('ent-006', unsorted);
    expect(report.dataPoints[0].date).toBe('2024-01-01');
    expect(report.dataPoints[1].date).toBe('2024-03-01');
  });
});
