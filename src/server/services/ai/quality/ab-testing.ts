/**
 * A/B Testing Framework — Consistent variant assignment and metrics tracking
 * Requirements: 30.6
 */

// ─── Types ──────────────────────────────────────────────────

export interface ABTestVariant {
  testName: string;
  variant: 'A' | 'B';
  metrics: {
    totalAssignments: number;
    avgSatisfaction: number;
    accuracyRate: number;
  };
}

// ─── In-Memory Store (production: Redis) ────────────────────

const assignmentStore = new Map<string, 'A' | 'B'>();
const metricsStore = new Map<string, { total: number; satSum: number; accSum: number }>();

function storeKey(userId: string, testName: string): string {
  return `${testName}:${userId}`;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Assign a user to an A/B test variant. Same user always gets same variant.
 */
export function assignABTest(userId: string, testName: string): ABTestVariant {
  const key = storeKey(userId, testName);
  let variant = assignmentStore.get(key);

  if (!variant) {
    // Deterministic assignment based on hash
    const hash = simpleHash(key);
    variant = hash % 2 === 0 ? 'A' : 'B';
    assignmentStore.set(key, variant);
  }

  // Update metrics
  const mKey = `${testName}:${variant}`;
  const m = metricsStore.get(mKey) ?? { total: 0, satSum: 0, accSum: 0 };
  m.total += 1;
  metricsStore.set(mKey, m);

  return {
    testName,
    variant,
    metrics: {
      totalAssignments: m.total,
      avgSatisfaction: m.total > 0 ? m.satSum / m.total : 0,
      accuracyRate: m.total > 0 ? m.accSum / m.total : 0,
    },
  };
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function clearABTests(): void {
  assignmentStore.clear();
  metricsStore.clear();
}
