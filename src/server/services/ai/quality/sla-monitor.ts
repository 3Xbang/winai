/**
 * SLA Monitor — Response time tracking and SLA compliance
 * Requirements: 30.7
 */

// ─── Types ──────────────────────────────────────────────────

export type ResponseMode = 'quick' | 'deep' | 'document';

// SLA thresholds in milliseconds
const SLA_THRESHOLDS: Record<ResponseMode, number> = {
  quick: 5000,     // 5s
  deep: 30000,     // 30s
  document: 60000, // 60s
};

// ─── Public API ─────────────────────────────────────────────

/**
 * Check if a response meets the SLA threshold for its mode.
 */
export function checkSLA(responseTimeMs: number, mode: ResponseMode): boolean {
  const threshold = SLA_THRESHOLDS[mode];
  return responseTimeMs <= threshold;
}

/**
 * Get the SLA threshold for a given mode.
 */
export function getSLAThreshold(mode: ResponseMode): number {
  return SLA_THRESHOLDS[mode];
}
