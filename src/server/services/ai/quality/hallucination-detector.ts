/**
 * Hallucination Detector — Verify law citations against knowledge base
 * Requirements: 30.4
 */

// ─── Types ──────────────────────────────────────────────────

export interface HallucinationCheckResult {
  messageId: string;
  hasHallucination: boolean;
  shouldRegenerate: boolean;
  unverifiedCitations: string[];
  verifiedCitations: string[];
}

// ─── Citation Extraction ────────────────────────────────────

const CITATION_PATTERN = /《[^》]+》第?\d+条?|第\d+条/g;

export function extractCitations(content: string): string[] {
  const matches = content.match(CITATION_PATTERN);
  return matches ? [...new Set(matches)] : [];
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Check for hallucinated law citations.
 * In production, verifies against pgvector + LawDocument table.
 * @param knownCitations - Set of verified citations from knowledge base
 */
export function checkHallucination(
  messageId: string,
  content: string,
  knownCitations: Set<string>,
): HallucinationCheckResult {
  const citations = extractCitations(content);
  const verified: string[] = [];
  const unverified: string[] = [];

  for (const citation of citations) {
    if (knownCitations.has(citation)) {
      verified.push(citation);
    } else {
      unverified.push(citation);
    }
  }

  const hasHallucination = unverified.length > 0;

  return {
    messageId,
    hasHallucination,
    shouldRegenerate: hasHallucination,
    unverifiedCitations: unverified,
    verifiedCitations: verified,
  };
}
