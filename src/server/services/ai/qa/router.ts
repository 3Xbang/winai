/**
 * Query Router — Intent-based routing for smart QA
 * Reuses intent classification to route queries to appropriate handlers.
 * Requirements: 28.6
 */

// ─── Types ──────────────────────────────────────────────────

export type QueryRoute =
  | 'QUICK_QA'
  | 'DEEP_ANALYSIS'
  | 'CONTRACT_REVIEW'
  | 'CASE_ANALYSIS'
  | 'DOCUMENT_GENERATION'
  | 'GENERAL';

export interface RouteResult {
  route: QueryRoute;
  confidence: number;
  suggestedMode: 'quick' | 'deep';
}

// ─── Routing Rules ──────────────────────────────────────────

const ROUTE_PATTERNS: { pattern: RegExp; route: QueryRoute; mode: 'quick' | 'deep' }[] = [
  { pattern: /合同|协议|条款|签约/i, route: 'CONTRACT_REVIEW', mode: 'deep' },
  { pattern: /案件|诉讼|起诉|判决|裁决/i, route: 'CASE_ANALYSIS', mode: 'deep' },
  { pattern: /起草|生成|模板|文书/i, route: 'DOCUMENT_GENERATION', mode: 'deep' },
  { pattern: /什么是|怎么|如何|可以吗|是否/i, route: 'QUICK_QA', mode: 'quick' },
];

// ─── Public API ─────────────────────────────────────────────

/**
 * Route a query to the appropriate handler based on content analysis.
 */
export function routeQuery(query: string): RouteResult {
  for (const { pattern, route, mode } of ROUTE_PATTERNS) {
    if (pattern.test(query)) {
      return { route, confidence: 0.8, suggestedMode: mode };
    }
  }

  // Default: deep analysis for longer queries, quick for short
  const isLong = query.length > 50;
  return {
    route: isLong ? 'DEEP_ANALYSIS' : 'GENERAL',
    confidence: 0.5,
    suggestedMode: isLong ? 'deep' : 'quick',
  };
}
