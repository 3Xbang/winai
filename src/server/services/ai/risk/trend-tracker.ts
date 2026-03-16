/**
 * Risk Trend Tracker — Enterprise risk trend aggregation and alerting
 * Aggregates historical risk assessments and generates trend reports.
 * Requirements: 25.6
 */

import type { RiskLevel } from './assessor';

// ─── Types ──────────────────────────────────────────────────

export interface RiskTrendDataPoint {
  date: string;
  overallLevel: RiskLevel;
  dimensions: {
    legal: number;
    financial: number;
    compliance: number;
    reputation: number;
  };
}

export interface RiskTrendReport {
  enterpriseId: string;
  dataPoints: RiskTrendDataPoint[];
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  alerts: RiskAlert[];
  summary: string;
}

export interface RiskAlert {
  dimension: string;
  previousLevel: RiskLevel;
  currentLevel: RiskLevel;
  message: string;
}

// ─── Helpers ────────────────────────────────────────────────

const LEVEL_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function averageDimension(points: RiskTrendDataPoint[], dim: keyof RiskTrendDataPoint['dimensions']): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, p) => sum + p.dimensions[dim], 0) / points.length;
}

function detectAlerts(
  previous: RiskTrendDataPoint | undefined,
  current: RiskTrendDataPoint | undefined,
): RiskAlert[] {
  if (!previous || !current) return [];
  const alerts: RiskAlert[] = [];
  const dims = ['legal', 'financial', 'compliance', 'reputation'] as const;

  for (const dim of dims) {
    const prevScore = previous.dimensions[dim];
    const currScore = current.dimensions[dim];
    // Alert if score increased by 20+ points
    if (currScore - prevScore >= 20) {
      const prevLevel = scoreToLevel(prevScore);
      const currLevel = scoreToLevel(currScore);
      alerts.push({
        dimension: dim,
        previousLevel: prevLevel,
        currentLevel: currLevel,
        message: `${dim} 风险从 ${prevLevel} 上升至 ${currLevel}（+${currScore - prevScore}分）`,
      });
    }
  }
  return alerts;
}

function scoreToLevel(score: number): RiskLevel {
  if (score > 90) return 'CRITICAL';
  if (score > 70) return 'HIGH';
  if (score > 40) return 'MEDIUM';
  return 'LOW';
}

function computeTrend(points: RiskTrendDataPoint[]): 'IMPROVING' | 'STABLE' | 'WORSENING' {
  if (points.length < 2) return 'STABLE';

  const firstHalf = points.slice(0, Math.floor(points.length / 2));
  const secondHalf = points.slice(Math.floor(points.length / 2));

  const avgFirst = (averageDimension(firstHalf, 'legal') + averageDimension(firstHalf, 'financial') +
    averageDimension(firstHalf, 'compliance') + averageDimension(firstHalf, 'reputation')) / 4;
  const avgSecond = (averageDimension(secondHalf, 'legal') + averageDimension(secondHalf, 'financial') +
    averageDimension(secondHalf, 'compliance') + averageDimension(secondHalf, 'reputation')) / 4;

  const diff = avgSecond - avgFirst;
  if (diff > 5) return 'WORSENING';
  if (diff < -5) return 'IMPROVING';
  return 'STABLE';
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Track risk trend for an enterprise from historical data points.
 * In production, dataPoints would be fetched from the RiskAssessment table.
 * Here we accept them as a parameter for testability.
 */
export function trackRiskTrend(
  enterpriseId: string,
  dataPoints: RiskTrendDataPoint[],
): RiskTrendReport {
  const sorted = [...dataPoints].sort((a, b) => a.date.localeCompare(b.date));
  const trend = computeTrend(sorted);

  const previous = sorted.length >= 2 ? sorted[sorted.length - 2] : undefined;
  const current = sorted.length >= 1 ? sorted[sorted.length - 1] : undefined;
  const alerts = detectAlerts(previous, current);

  const summary = sorted.length === 0
    ? '暂无历史数据'
    : `共 ${sorted.length} 条记录，风险趋势：${trend === 'IMPROVING' ? '改善' : trend === 'WORSENING' ? '恶化' : '稳定'}`;

  return { enterpriseId, dataPoints: sorted, trend, alerts, summary };
}
