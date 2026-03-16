/**
 * Monthly Quality Report Generator
 * Requirements: 30.8
 */

// ─── Types ──────────────────────────────────────────────────

export interface MonthlyQualityReport {
  month: string;
  responseAccuracyRate: number;    // 0-1
  avgSatisfactionScore: number;    // 0-5
  hallucinationRate: number;       // 0-1
  humanEscalationRate: number;     // 0-1
  slaComplianceRate: number;       // 0-1
  totalConsultations: number;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate a monthly quality report from aggregated stats.
 * In production, aggregates from DB tables.
 */
export function generateMonthlyReport(
  month: string,
  stats: {
    totalConsultations: number;
    accurateResponses: number;
    totalSatisfactionScore: number;
    hallucinationCount: number;
    escalationCount: number;
    slaCompliantCount: number;
  },
): MonthlyQualityReport {
  const total = Math.max(stats.totalConsultations, 1);
  const clampRate = (v: number) => Math.max(0, Math.min(1, v));

  return {
    month,
    responseAccuracyRate: clampRate(stats.accurateResponses / total),
    avgSatisfactionScore: Math.max(0, Math.min(5, stats.totalSatisfactionScore / total)),
    hallucinationRate: clampRate(stats.hallucinationCount / total),
    humanEscalationRate: clampRate(stats.escalationCount / total),
    slaComplianceRate: clampRate(stats.slaCompliantCount / total),
    totalConsultations: stats.totalConsultations,
  };
}
