/**
 * Case Search Engine (案例检索引擎)
 * Searches for similar legal cases in China and Thailand, analyzes judicial trends,
 * and provides case comparison analysis.
 * Integrates OpenSearch for full-text search and LLM for semantic ranking and trend analysis.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface CaseSearchQuery {
  query: string;
  jurisdiction?: 'CHINA' | 'THAILAND' | 'DUAL';
  caseType?: string;
  dateRange?: { from?: string; to?: string };
  limit?: number;
}

export interface SimilarCase {
  caseId: string;
  jurisdiction: 'CHINA' | 'THAILAND';
  summary: string;
  verdict: string;
  keyReasoning: string;
  relevanceScore: number;
}

export interface TrendItem {
  period: string;
  description: string;
  direction: 'INCREASING' | 'DECREASING' | 'STABLE';
}

export interface TrendAnalysis {
  trends: TrendItem[];
  summary: string;
}

export interface CaseComparison {
  similarities: string[];
  differences: string[];
  summary: string;
}

export interface CaseSearchResult {
  cases: SimilarCase[];
  trendAnalysis: TrendAnalysis;
  comparison: CaseComparison;
}


// ─── OpenSearch Client Interface (mock for now) ─────────────

export interface OpenSearchHit {
  caseId: string;
  jurisdiction: string;
  title: string;
  content: string;
  verdict: string;
  date?: string;
  score: number;
}

export interface OpenSearchClient {
  search(query: string, options?: {
    jurisdiction?: string;
    caseType?: string;
    dateRange?: { from?: string; to?: string };
    limit?: number;
  }): Promise<OpenSearchHit[]>;
}

/**
 * Mock OpenSearch client for development.
 * Returns empty results — actual integration will be implemented later.
 */
export class MockOpenSearchClient implements OpenSearchClient {
  async search(): Promise<OpenSearchHit[]> {
    return [];
  }
}

// ─── Constants ──────────────────────────────────────────────

const VALID_JURISDICTIONS: SimilarCase['jurisdiction'][] = ['CHINA', 'THAILAND'];
const VALID_TREND_DIRECTIONS: TrendItem['direction'][] = ['INCREASING', 'DECREASING', 'STABLE'];
const DEFAULT_LIMIT = 10;

export const CASE_SEARCH_SYSTEM_PROMPT = `你是一位精通中国法律和泰国法律的资深案例检索专家。你的任务是根据用户的案件描述，检索并分析中泰两国的相关类似案例。

## 你的任务
1. 根据案件描述，生成相关的类似案例列表
2. 每个案例必须包含案件摘要、裁判结果和关键裁判理由
3. 评估每个案例与当前案件的相关度（0-1）

## 输出格式（严格 JSON）
{
  "cases": [
    {
      "caseId": "案例编号",
      "jurisdiction": "CHINA" 或 "THAILAND",
      "summary": "案件摘要",
      "verdict": "裁判结果",
      "keyReasoning": "关键裁判理由",
      "relevanceScore": 0.0-1.0
    }
  ],
  "noHighlyRelevantCases": false,
  "noRelevantReason": ""
}

## 重要规则
- jurisdiction 必须是 CHINA 或 THAILAND
- summary、verdict、keyReasoning 必须非空
- relevanceScore 必须在 0-1 之间
- 如果没有高度相关的案例，设置 noHighlyRelevantCases 为 true，并在 noRelevantReason 中说明原因，同时仍提供最接近的参考案例`;

export const CASE_SEARCH_USER_PROMPT_TEMPLATE = `请根据以下案件描述，检索中泰两国的相关类似案例：

案件描述：
{{query}}

{{jurisdictionFilter}}
{{caseTypeFilter}}
{{dateRangeFilter}}

请检索最多 {{limit}} 个相关案例，严格按照 JSON 格式输出。`;


export const TREND_ANALYSIS_SYSTEM_PROMPT = `你是一位精通中国法律和泰国法律的资深裁判趋势分析专家。你的任务是分析一组案例的裁判趋势和共性规律。

## 你的任务
1. 分析案例集合的裁判趋势
2. 识别共性规律和变化方向
3. 提供趋势总结

## 输出格式（严格 JSON）
{
  "trends": [
    {
      "period": "时间段描述",
      "description": "趋势描述",
      "direction": "INCREASING" 或 "DECREASING" 或 "STABLE"
    }
  ],
  "summary": "整体趋势总结"
}

## 重要规则
- direction 必须是 INCREASING、DECREASING 或 STABLE 之一
- trends 数组至少包含一项
- summary 必须非空`;

export const TREND_ANALYSIS_USER_PROMPT_TEMPLATE = `请分析以下案例集合的裁判趋势：

案例列表：
{{cases}}

请严格按照 JSON 格式输出趋势分析结果。`;

export const CASE_COMPARISON_SYSTEM_PROMPT = `你是一位精通中国法律和泰国法律的资深案例对比分析专家。你的任务是将检索到的类似案例与当前案件进行对比分析。

## 你的任务
1. 分析类似案例之间的共同点
2. 分析类似案例之间的差异点
3. 提供对比总结

## 输出格式（严格 JSON）
{
  "similarities": ["共同点1", "共同点2"],
  "differences": ["差异点1", "差异点2"],
  "summary": "对比分析总结"
}

## 重要规则
- similarities 和 differences 数组至少各包含一项
- summary 必须非空`;

export const CASE_COMPARISON_USER_PROMPT_TEMPLATE = `请对以下案例进行对比分析：

原始查询：
{{query}}

类似案例：
{{cases}}

请严格按照 JSON 格式输出对比分析结果。`;

// ─── Case Search Engine ─────────────────────────────────────

export class CaseSearchEngine {
  private llm = getLLMGateway();
  private openSearchClient: OpenSearchClient;

  constructor(openSearchClient?: OpenSearchClient) {
    this.openSearchClient = openSearchClient ?? new MockOpenSearchClient();
  }

  /**
   * Search for similar cases based on a query.
   * Combines OpenSearch full-text search with LLM semantic analysis.
   */
  async search(query: CaseSearchQuery): Promise<CaseSearchResult> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    // Step 1: Try OpenSearch full-text search
    const openSearchHits = await this.tryOpenSearch(query, limit);

    // Step 2: Use LLM for semantic search and ranking
    const cases = await this.llmSearch(query, openSearchHits, limit);

    // Step 3: If cases found, get trend analysis and comparison
    let trendAnalysis: TrendAnalysis;
    let comparison: CaseComparison;

    if (cases.length > 0) {
      [trendAnalysis, comparison] = await Promise.all([
        this.analyzeTrends(cases),
        this.compareCases(query.query, cases),
      ]);
    } else {
      trendAnalysis = this.buildEmptyTrendAnalysis();
      comparison = this.buildEmptyComparison();
    }

    return { cases, trendAnalysis, comparison };
  }

  /**
   * Analyze judicial trends from a set of similar cases.
   */
  async analyzeTrends(cases: SimilarCase[]): Promise<TrendAnalysis> {
    if (cases.length === 0) {
      return this.buildEmptyTrendAnalysis();
    }

    const casesText = cases
      .map((c, i) => `${i + 1}. [${c.jurisdiction}] ${c.summary}\n   裁判结果：${c.verdict}\n   关键理由：${c.keyReasoning}`)
      .join('\n\n');

    const userPrompt = TREND_ANALYSIS_USER_PROMPT_TEMPLATE
      .replace('{{cases}}', casesText);

    const messages: LLMMessage[] = [
      { role: 'system', content: TREND_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 3000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedTrendAnalysis(cases);
    }

    try {
      const parsed = this.llm.parseJSON<RawTrendResponse>(response);
      return this.normalizeTrendAnalysis(parsed);
    } catch {
      return this.buildDegradedTrendAnalysis(cases);
    }
  }

  // ─── Private Methods ────────────────────────────────────

  private async tryOpenSearch(query: CaseSearchQuery, limit: number): Promise<OpenSearchHit[]> {
    try {
      return await this.openSearchClient.search(query.query, {
        jurisdiction: query.jurisdiction,
        caseType: query.caseType,
        dateRange: query.dateRange,
        limit,
      });
    } catch {
      // OpenSearch unavailable — fall back to LLM-only search
      return [];
    }
  }

  private async llmSearch(
    query: CaseSearchQuery,
    openSearchHits: OpenSearchHit[],
    limit: number,
  ): Promise<SimilarCase[]> {
    const jurisdictionFilter = query.jurisdiction
      ? `管辖区筛选：${query.jurisdiction === 'DUAL' ? '中国和泰国' : query.jurisdiction === 'CHINA' ? '仅中国' : '仅泰国'}`
      : '';
    const caseTypeFilter = query.caseType ? `案件类型：${query.caseType}` : '';
    const dateRangeFilter = query.dateRange
      ? `日期范围：${query.dateRange.from ?? '不限'} 至 ${query.dateRange.to ?? '不限'}`
      : '';

    let userPrompt = CASE_SEARCH_USER_PROMPT_TEMPLATE
      .replace('{{query}}', query.query)
      .replace('{{jurisdictionFilter}}', jurisdictionFilter)
      .replace('{{caseTypeFilter}}', caseTypeFilter)
      .replace('{{dateRangeFilter}}', dateRangeFilter)
      .replace('{{limit}}', String(limit));

    // Augment with OpenSearch results if available
    if (openSearchHits.length > 0) {
      const hitsText = openSearchHits
        .map((h, i) => `${i + 1}. [${h.jurisdiction}] ${h.title}: ${h.content.slice(0, 200)}...`)
        .join('\n');
      userPrompt += `\n\n参考检索结果（来自全文检索）：\n${hitsText}`;
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: CASE_SEARCH_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 4000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedCases(query);
    }

    try {
      const parsed = this.llm.parseJSON<RawSearchResponse>(response);
      return this.normalizeCases(parsed.cases, limit);
    } catch {
      return this.buildDegradedCases(query);
    }
  }

  private async compareCases(queryText: string, cases: SimilarCase[]): Promise<CaseComparison> {
    const casesText = cases
      .map((c, i) => `${i + 1}. [${c.jurisdiction}] ${c.summary}\n   裁判结果：${c.verdict}`)
      .join('\n\n');

    const userPrompt = CASE_COMPARISON_USER_PROMPT_TEMPLATE
      .replace('{{query}}', queryText)
      .replace('{{cases}}', casesText);

    const messages: LLMMessage[] = [
      { role: 'system', content: CASE_COMPARISON_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 3000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedComparison();
    }

    try {
      const parsed = this.llm.parseJSON<RawComparisonResponse>(response);
      return this.normalizeComparison(parsed);
    } catch {
      return this.buildDegradedComparison();
    }
  }


  // ─── Normalization ──────────────────────────────────────

  private normalizeCases(rawCases: unknown, limit: number): SimilarCase[] {
    if (!Array.isArray(rawCases) || rawCases.length === 0) {
      return [];
    }

    return rawCases
      .filter((c): c is Record<string, unknown> => c !== null && typeof c === 'object')
      .slice(0, limit)
      .map(c => this.normalizeOneCase(c));
  }

  private normalizeOneCase(raw: Record<string, unknown>): SimilarCase {
    return {
      caseId: typeof raw.caseId === 'string' && raw.caseId.trim()
        ? raw.caseId.trim() : `CASE-${Date.now()}`,
      jurisdiction: this.normalizeJurisdiction(raw.jurisdiction),
      summary: typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim() : '案件摘要待补充',
      verdict: typeof raw.verdict === 'string' && raw.verdict.trim()
        ? raw.verdict.trim() : '裁判结果待补充',
      keyReasoning: typeof raw.keyReasoning === 'string' && raw.keyReasoning.trim()
        ? raw.keyReasoning.trim() : '关键裁判理由待补充',
      relevanceScore: this.normalizeScore(raw.relevanceScore),
    };
  }

  private normalizeJurisdiction(value: unknown): 'CHINA' | 'THAILAND' {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (VALID_JURISDICTIONS.includes(upper as SimilarCase['jurisdiction'])) {
        return upper as 'CHINA' | 'THAILAND';
      }
    }
    return 'CHINA';
  }

  private normalizeScore(value: unknown): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, Math.min(1, value));
    }
    return 0.5;
  }

  private normalizeTrendAnalysis(raw: RawTrendResponse): TrendAnalysis {
    const trends = this.normalizeTrends(raw.trends);
    const summary = typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim() : '裁判趋势分析待完成。';

    return { trends, summary };
  }

  private normalizeTrends(rawTrends: unknown): TrendItem[] {
    if (!Array.isArray(rawTrends) || rawTrends.length === 0) {
      return [{
        period: '近期',
        description: '趋势分析待完成',
        direction: 'STABLE',
      }];
    }

    return rawTrends
      .filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object')
      .map(t => ({
        period: typeof t.period === 'string' && t.period.trim()
          ? t.period.trim() : '未知时段',
        description: typeof t.description === 'string' && t.description.trim()
          ? t.description.trim() : '趋势描述待补充',
        direction: this.normalizeTrendDirection(t.direction),
      }));
  }

  private normalizeTrendDirection(value: unknown): TrendItem['direction'] {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (VALID_TREND_DIRECTIONS.includes(upper as TrendItem['direction'])) {
        return upper as TrendItem['direction'];
      }
    }
    return 'STABLE';
  }

  private normalizeComparison(raw: RawComparisonResponse): CaseComparison {
    const similarities = this.normalizeStringArray(raw.similarities, '案例间存在共性规律');
    const differences = this.normalizeStringArray(raw.differences, '案例间存在差异');
    const summary = typeof raw.summary === 'string' && raw.summary.trim()
      ? raw.summary.trim() : '案例对比分析待完成。';

    return { similarities, differences, summary };
  }

  private normalizeStringArray(arr: unknown, fallback: string): string[] {
    if (!Array.isArray(arr) || arr.length === 0) {
      return [fallback];
    }
    const filtered = arr
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim());
    return filtered.length > 0 ? filtered : [fallback];
  }

  // ─── Empty / Degraded Responses ─────────────────────────

  private buildEmptyTrendAnalysis(): TrendAnalysis {
    return {
      trends: [],
      summary: '未检索到相关案例，无法进行趋势分析。',
    };
  }

  private buildEmptyComparison(): CaseComparison {
    return {
      similarities: [],
      differences: [],
      summary: '未检索到相关案例，无法进行对比分析。',
    };
  }

  private buildDegradedTrendAnalysis(cases: SimilarCase[]): TrendAnalysis {
    return {
      trends: [{
        period: '近期',
        description: `基于 ${cases.length} 个案例的趋势分析（AI 服务暂时不可用）`,
        direction: 'STABLE' as const,
      }],
      summary: 'AI 服务暂时不可用，无法完成详细趋势分析，请稍后重试。',
    };
  }

  private buildDegradedCases(query: CaseSearchQuery): SimilarCase[] {
    return [{
      caseId: 'DEGRADED-001',
      jurisdiction: query.jurisdiction === 'THAILAND' ? 'THAILAND' : 'CHINA',
      summary: 'AI 服务暂时不可用，无法检索相关案例',
      verdict: '请稍后重试',
      keyReasoning: 'AI 服务暂时不可用',
      relevanceScore: 0,
    }];
  }

  private buildDegradedComparison(): CaseComparison {
    return {
      similarities: ['AI 服务暂时不可用，无法完成对比分析'],
      differences: ['AI 服务暂时不可用，无法完成对比分析'],
      summary: 'AI 服务暂时不可用，无法完成案例对比分析，请稍后重试。',
    };
  }
}

// ─── Raw Response Types ───────────────────────────────────

interface RawSearchResponse {
  cases?: unknown;
  noHighlyRelevantCases?: boolean;
  noRelevantReason?: string;
}

interface RawTrendResponse {
  trends?: unknown;
  summary?: unknown;
}

interface RawComparisonResponse {
  similarities?: unknown;
  differences?: unknown;
  summary?: unknown;
}

// ─── Singleton ──────────────────────────────────────────────

let engineInstance: CaseSearchEngine | null = null;

export function getCaseSearchEngine(): CaseSearchEngine {
  if (!engineInstance) {
    engineInstance = new CaseSearchEngine();
  }
  return engineInstance;
}

export function resetCaseSearchEngine(): void {
  engineInstance = null;
}
