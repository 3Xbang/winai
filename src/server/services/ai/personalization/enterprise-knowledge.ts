/**
 * Enterprise Knowledge — Accumulate and retrieve enterprise-specific knowledge
 * Requirements: 29.2
 */

// ─── Types ──────────────────────────────────────────────────

export interface EnterpriseKnowledge {
  enterpriseId: string;
  industry: string;
  commonIssues: string[];
  historicalConclusions: string[];
  lastUpdated: Date;
}

export interface ConsultationSummary {
  topic: string;
  keyFindings: string[];
  conclusion: string;
}

// ─── In-Memory Store (production: DB + pgvector) ────────────

const knowledgeStore = new Map<string, EnterpriseKnowledge>();

// ─── Public API ─────────────────────────────────────────────

export function getEnterpriseKnowledge(enterpriseId: string): EnterpriseKnowledge | null {
  return knowledgeStore.get(enterpriseId) ?? null;
}

export function accumulateKnowledge(
  enterpriseId: string,
  consultation: ConsultationSummary,
): EnterpriseKnowledge {
  const existing = knowledgeStore.get(enterpriseId) ?? {
    enterpriseId,
    industry: '',
    commonIssues: [],
    historicalConclusions: [],
    lastUpdated: new Date(),
  };

  if (consultation.topic && !existing.commonIssues.includes(consultation.topic)) {
    existing.commonIssues.push(consultation.topic);
  }
  if (consultation.conclusion) {
    existing.historicalConclusions.push(consultation.conclusion);
  }
  existing.lastUpdated = new Date();
  knowledgeStore.set(enterpriseId, existing);
  return existing;
}

export function clearKnowledge(): void {
  knowledgeStore.clear();
}
