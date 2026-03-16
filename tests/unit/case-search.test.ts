import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock OpenAI ────────────────────────────────────────────
const mockOpenAICreate = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockOpenAICreate } };
  },
}));

// ─── Mock Anthropic ─────────────────────────────────────────
const mockAnthropicCreate = vi.fn();
const mockAnthropicStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate, stream: mockAnthropicStream };
  },
}));

// ─── Mock Prisma ────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  default: {
    promptTemplate: { findFirst: vi.fn().mockRejectedValue(new Error('DB unavailable in test')) },
  },
}));

// ─── Helpers ────────────────────────────────────────────────

function mockOpenAIJsonResponse(jsonObj: Record<string, unknown>) {
  mockOpenAICreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(jsonObj) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  });
}

/** Queue multiple sequential LLM responses (for search → trends → comparison) */
function mockOpenAISequentialResponses(...responses: Record<string, unknown>[]) {
  for (const resp of responses) {
    mockOpenAICreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(resp) }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    });
  }
}


function buildSearchResponse(): Record<string, unknown> {
  return {
    cases: [
      {
        caseId: '(2023)京民终123号',
        jurisdiction: 'CHINA',
        summary: '房屋租赁合同纠纷案，承租人拖欠租金三个月后被出租人起诉',
        verdict: '判决承租人支付拖欠租金及违约金',
        keyReasoning: '根据民法典第722条，承租人应当按照约定的期限支付租金',
        relevanceScore: 0.92,
      },
      {
        caseId: 'TH-2023-CIV-456',
        jurisdiction: 'THAILAND',
        summary: '商业租赁纠纷，租户未按时支付租金',
        verdict: '法院判决租户支付欠款并赔偿损失',
        keyReasoning: '根据泰国民商法典第537条，租赁合同中租金支付义务明确',
        relevanceScore: 0.85,
      },
    ],
    noHighlyRelevantCases: false,
    noRelevantReason: '',
  };
}

function buildTrendResponse(): Record<string, unknown> {
  return {
    trends: [
      {
        period: '2021-2023',
        description: '租赁纠纷案件中，法院对承租人违约的判罚力度呈上升趋势',
        direction: 'INCREASING',
      },
      {
        period: '2023',
        description: '调解结案比例保持稳定',
        direction: 'STABLE',
      },
    ],
    summary: '近年来租赁纠纷案件裁判趋势显示，法院对违约行为的惩罚力度有所加强。',
  };
}

function buildComparisonResponse(): Record<string, unknown> {
  return {
    similarities: [
      '均涉及租金支付违约',
      '法院均支持出租人的诉讼请求',
    ],
    differences: [
      '中国案例适用民法典，泰国案例适用民商法典',
      '违约金计算标准不同',
    ],
    summary: '中泰两国在租赁纠纷处理上存在共性，但法律依据和赔偿标准有所差异。',
  };
}

describe('CaseSearchEngine', () => {
  let CaseSearchEngine: typeof import('@/server/services/legal/case-search').CaseSearchEngine;
  let resetCaseSearchEngine: typeof import('@/server/services/legal/case-search').resetCaseSearchEngine;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;

  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();

    const llmMod = await import('@/server/services/llm/gateway');
    resetLLMGateway = llmMod.resetLLMGateway;
    resetLLMGateway();

    const mod = await import('@/server/services/legal/case-search');
    CaseSearchEngine = mod.CaseSearchEngine;
    resetCaseSearchEngine = mod.resetCaseSearchEngine;
    resetCaseSearchEngine();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── search() ─────────────────────────────────────────────

  describe('search()', () => {
    it('should return cases with valid fields from LLM response', async () => {
      mockOpenAISequentialResponses(
        buildSearchResponse(),
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '租赁合同纠纷，承租人拖欠租金' });

      expect(result.cases.length).toBeGreaterThan(0);
      result.cases.forEach(c => {
        expect(c.caseId).toBeTruthy();
        expect(['CHINA', 'THAILAND']).toContain(c.jurisdiction);
        expect(c.summary).toBeTruthy();
        expect(c.verdict).toBeTruthy();
        expect(c.keyReasoning).toBeTruthy();
        expect(c.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(c.relevanceScore).toBeLessThanOrEqual(1);
      });
    });

    it('should include trendAnalysis and comparison when cases are non-empty', async () => {
      mockOpenAISequentialResponses(
        buildSearchResponse(),
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '租赁合同纠纷' });

      expect(result.cases.length).toBeGreaterThan(0);
      expect(result.trendAnalysis).toBeDefined();
      expect(result.trendAnalysis.summary).toBeTruthy();
      expect(result.comparison).toBeDefined();
      expect(result.comparison.summary).toBeTruthy();
    });

    it('should pass jurisdiction filter to LLM prompt', async () => {
      mockOpenAISequentialResponses(
        buildSearchResponse(),
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      await engine.search({ query: '劳动纠纷', jurisdiction: 'CHINA' });

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('仅中国');
    });

    it('should pass DUAL jurisdiction filter correctly', async () => {
      mockOpenAISequentialResponses(
        buildSearchResponse(),
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      await engine.search({ query: '跨境贸易纠纷', jurisdiction: 'DUAL' });

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('中国和泰国');
    });

    it('should use json_object response format and low temperature', async () => {
      mockOpenAISequentialResponses(
        buildSearchResponse(),
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      await engine.search({ query: '合同纠纷' });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should handle degraded LLM response gracefully', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '合同纠纷' });

      // Should still return a valid structure
      expect(result.cases).toBeDefined();
      expect(Array.isArray(result.cases)).toBe(true);
      expect(result.cases.length).toBeGreaterThan(0);
      result.cases.forEach(c => {
        expect(c.caseId).toBeTruthy();
        expect(['CHINA', 'THAILAND']).toContain(c.jurisdiction);
        expect(c.summary).toBeTruthy();
        expect(c.verdict).toBeTruthy();
        expect(c.keyReasoning).toBeTruthy();
      });
      expect(result.trendAnalysis).toBeDefined();
      expect(result.comparison).toBeDefined();
    });

    it('should handle malformed JSON gracefully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'not valid json' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '合同纠纷' });

      expect(result.cases).toBeDefined();
      expect(Array.isArray(result.cases)).toBe(true);
    });

    it('should handle empty cases array from LLM', async () => {
      mockOpenAIJsonResponse({ cases: [] });

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '非常罕见的案件类型' });

      expect(result.cases).toEqual([]);
      expect(result.trendAnalysis.summary).toBeTruthy();
      expect(result.comparison.summary).toBeTruthy();
    });

    it('should normalize invalid jurisdiction to CHINA', async () => {
      mockOpenAISequentialResponses(
        {
          cases: [{
            caseId: 'TEST-001',
            jurisdiction: 'INVALID',
            summary: '测试案例',
            verdict: '测试裁判',
            keyReasoning: '测试理由',
            relevanceScore: 0.8,
          }],
        },
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '测试' });

      expect(result.cases[0]!.jurisdiction).toBe('CHINA');
    });

    it('should clamp relevanceScore to 0-1 range', async () => {
      mockOpenAISequentialResponses(
        {
          cases: [
            {
              caseId: 'TEST-001',
              jurisdiction: 'CHINA',
              summary: '测试',
              verdict: '测试',
              keyReasoning: '测试',
              relevanceScore: 1.5,
            },
            {
              caseId: 'TEST-002',
              jurisdiction: 'THAILAND',
              summary: '测试',
              verdict: '测试',
              keyReasoning: '测试',
              relevanceScore: -0.3,
            },
          ],
        },
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '测试' });

      expect(result.cases[0]!.relevanceScore).toBeLessThanOrEqual(1);
      expect(result.cases[1]!.relevanceScore).toBeGreaterThanOrEqual(0);
    });

    it('should respect the limit parameter', async () => {
      const manyCases = Array.from({ length: 20 }, (_, i) => ({
        caseId: `CASE-${i}`,
        jurisdiction: 'CHINA',
        summary: `案例${i}`,
        verdict: `裁判${i}`,
        keyReasoning: `理由${i}`,
        relevanceScore: 0.9 - i * 0.01,
      }));

      mockOpenAISequentialResponses(
        { cases: manyCases },
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine();
      const result = await engine.search({ query: '测试', limit: 5 });

      expect(result.cases.length).toBeLessThanOrEqual(5);
    });

    it('should integrate with custom OpenSearch client', async () => {
      const mockOSClient = {
        search: vi.fn().mockResolvedValue([
          {
            caseId: 'OS-001',
            jurisdiction: 'CHINA',
            title: 'OpenSearch案例',
            content: '来自OpenSearch的案例内容',
            verdict: '判决结果',
            score: 0.95,
          },
        ]),
      };

      mockOpenAISequentialResponses(
        buildSearchResponse(),
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine(mockOSClient);
      await engine.search({ query: '合同纠纷' });

      expect(mockOSClient.search).toHaveBeenCalled();
      // OpenSearch results should be included in the LLM prompt
      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('参考检索结果');
    });

    it('should handle OpenSearch failure gracefully and fall back to LLM-only', async () => {
      const failingOSClient = {
        search: vi.fn().mockRejectedValue(new Error('OpenSearch unavailable')),
      };

      mockOpenAISequentialResponses(
        buildSearchResponse(),
        buildTrendResponse(),
        buildComparisonResponse(),
      );

      const engine = new CaseSearchEngine(failingOSClient);
      const result = await engine.search({ query: '合同纠纷' });

      expect(result.cases.length).toBeGreaterThan(0);
    });
  });


  // ─── analyzeTrends() ──────────────────────────────────────

  describe('analyzeTrends()', () => {
    it('should return trend analysis with valid direction indicators', async () => {
      mockOpenAIJsonResponse(buildTrendResponse());

      const engine = new CaseSearchEngine();
      const cases: import('@/server/services/legal/case-search').SimilarCase[] = [
        {
          caseId: 'CASE-001',
          jurisdiction: 'CHINA',
          summary: '租赁纠纷案',
          verdict: '判决承租人支付租金',
          keyReasoning: '根据民法典第722条',
          relevanceScore: 0.9,
        },
      ];

      const result = await engine.analyzeTrends(cases);

      expect(result.trends.length).toBeGreaterThan(0);
      result.trends.forEach(t => {
        expect(t.period).toBeTruthy();
        expect(t.description).toBeTruthy();
        expect(['INCREASING', 'DECREASING', 'STABLE']).toContain(t.direction);
      });
      expect(result.summary).toBeTruthy();
    });

    it('should return empty trends for empty cases array', async () => {
      const engine = new CaseSearchEngine();
      const result = await engine.analyzeTrends([]);

      expect(result.trends).toEqual([]);
      expect(result.summary).toBeTruthy();
    });

    it('should handle degraded LLM response gracefully', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const engine = new CaseSearchEngine();
      const cases: import('@/server/services/legal/case-search').SimilarCase[] = [
        {
          caseId: 'CASE-001',
          jurisdiction: 'CHINA',
          summary: '测试案例',
          verdict: '测试裁判',
          keyReasoning: '测试理由',
          relevanceScore: 0.8,
        },
      ];

      const result = await engine.analyzeTrends(cases);

      expect(result.trends.length).toBeGreaterThan(0);
      expect(result.summary).toBeTruthy();
    });

    it('should normalize invalid direction values to STABLE', async () => {
      mockOpenAIJsonResponse({
        trends: [{
          period: '2023',
          description: '趋势描述',
          direction: 'INVALID_DIRECTION',
        }],
        summary: '总结',
      });

      const engine = new CaseSearchEngine();
      const result = await engine.analyzeTrends([{
        caseId: 'CASE-001',
        jurisdiction: 'CHINA',
        summary: '测试',
        verdict: '测试',
        keyReasoning: '测试',
        relevanceScore: 0.8,
      }]);

      expect(result.trends[0]!.direction).toBe('STABLE');
    });

    it('should include case details in the LLM prompt', async () => {
      mockOpenAIJsonResponse(buildTrendResponse());

      const engine = new CaseSearchEngine();
      await engine.analyzeTrends([{
        caseId: 'CASE-001',
        jurisdiction: 'CHINA',
        summary: '特定案例摘要内容',
        verdict: '特定裁判结果',
        keyReasoning: '特定裁判理由',
        relevanceScore: 0.9,
      }]);

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('特定案例摘要内容');
      expect(userMessage?.content).toContain('特定裁判结果');
    });
  });

  // ─── MockOpenSearchClient ─────────────────────────────────

  describe('MockOpenSearchClient', () => {
    it('should return empty results', async () => {
      const { MockOpenSearchClient } = await import('@/server/services/legal/case-search');
      const client = new MockOpenSearchClient();
      const results = await client.search('test query');
      expect(results).toEqual([]);
    });
  });

  // ─── Singleton ────────────────────────────────────────────

  describe('getCaseSearchEngine / resetCaseSearchEngine', () => {
    it('should return the same instance on repeated calls', async () => {
      const { getCaseSearchEngine } = await import('@/server/services/legal/case-search');
      resetCaseSearchEngine();
      const a = getCaseSearchEngine();
      const b = getCaseSearchEngine();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', async () => {
      const { getCaseSearchEngine } = await import('@/server/services/legal/case-search');
      resetCaseSearchEngine();
      const a = getCaseSearchEngine();
      resetCaseSearchEngine();
      const b = getCaseSearchEngine();
      expect(a).not.toBe(b);
    });
  });
});
