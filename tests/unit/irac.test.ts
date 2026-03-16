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
  mockOpenAICreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(jsonObj) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  });
}

function mockOpenAITextResponse(text: string) {
  mockOpenAICreate.mockResolvedValueOnce({
    choices: [{ message: { content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  });
}

const CHINA_IRAC_RESPONSE = {
  issue: '关于在上海注册外资有限责任公司的法律资格和程序问题',
  rule: [
    { lawName: '《公司法》', articleNumber: '第23条', description: '有限责任公司设立条件' },
    { lawName: '《外商投资法》', articleNumber: '第4条', description: '外商投资准入管理' },
  ],
  analysis: '根据《公司法》第23条，设立有限责任公司需满足股东人数、出资额等条件。结合用户情况，作为外国投资者在上海注册公司，还需遵守《外商投资法》的准入规定。',
  conclusion: '用户可以在上海注册外资有限责任公司，但需要满足《公司法》和《外商投资法》的双重要求。建议先确认拟经营行业是否在负面清单内。',
};

const THAILAND_IRAC_RESPONSE = {
  issue: 'Legal requirements for a foreign national to establish a business in Thailand',
  rule: [
    { lawName: 'Foreign Business Act', articleNumber: 'Section 8', description: 'Restricted business activities for foreigners' },
    { lawName: 'Civil and Commercial Code', articleNumber: 'Section 1097', description: 'Company registration requirements' },
  ],
  analysis: 'Under the Foreign Business Act Section 8, certain business activities are restricted for foreign nationals. The applicant must verify whether the intended business falls under List 1, 2, or 3 of restricted activities.',
  conclusion: 'The applicant may establish a company in Thailand but must comply with foreign ownership restrictions under the Foreign Business Act. BOI promotion may provide exemptions.',
};

describe('IRACEngine', () => {
  let IRACEngine: typeof import('@/server/services/legal/irac').IRACEngine;
  let resetIRACEngine: typeof import('@/server/services/legal/irac').resetIRACEngine;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;
  let resetPromptEngine: typeof import('@/server/services/llm/prompt-engine').resetPromptEngine;

  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();

    const llmMod = await import('@/server/services/llm/gateway');
    resetLLMGateway = llmMod.resetLLMGateway;
    resetLLMGateway();

    const promptMod = await import('@/server/services/llm/prompt-engine');
    resetPromptEngine = promptMod.resetPromptEngine;
    resetPromptEngine();

    const mod = await import('@/server/services/legal/irac');
    IRACEngine = mod.IRACEngine;
    resetIRACEngine = mod.resetIRACEngine;
    resetIRACEngine();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── CHINA jurisdiction ─────────────────────────────────

  describe('analyze() — CHINA jurisdiction', () => {
    it('should perform one IRAC analysis under Chinese law', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '我想在上海注册一家外资有限责任公司' },
        { jurisdiction: 'CHINA', confidence: 0.95 },
      );

      expect(result.jurisdiction.jurisdiction).toBe('CHINA');
      expect(result.chinaAnalysis).toBeDefined();
      expect(result.thailandAnalysis).toBeUndefined();
      expect(result.combinedConclusion).toBeUndefined();

      const analysis = result.chinaAnalysis!;
      expect(analysis.issue).toBeTruthy();
      expect(analysis.rule.length).toBeGreaterThan(0);
      expect(analysis.rule[0]!.lawName).toBe('《公司法》');
      expect(analysis.rule[0]!.articleNumber).toBe('第23条');
      expect(analysis.analysis).toBeTruthy();
      expect(analysis.conclusion).toBeTruthy();
    });

    it('should include all four IRAC steps with non-empty values', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '劳动合同纠纷' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      const analysis = result.chinaAnalysis!;
      expect(analysis.issue.length).toBeGreaterThan(0);
      expect(analysis.rule.length).toBeGreaterThan(0);
      expect(analysis.analysis.length).toBeGreaterThan(0);
      expect(analysis.conclusion.length).toBeGreaterThan(0);
    });
  });

  // ─── THAILAND jurisdiction ──────────────────────────────

  describe('analyze() — THAILAND jurisdiction', () => {
    it('should perform one IRAC analysis under Thai law', async () => {
      mockOpenAIJsonResponse(THAILAND_IRAC_RESPONSE);

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: 'I want to start a business in Bangkok' },
        { jurisdiction: 'THAILAND', confidence: 0.92 },
      );

      expect(result.jurisdiction.jurisdiction).toBe('THAILAND');
      expect(result.thailandAnalysis).toBeDefined();
      expect(result.chinaAnalysis).toBeUndefined();
      expect(result.combinedConclusion).toBeUndefined();

      const analysis = result.thailandAnalysis!;
      expect(analysis.issue).toBeTruthy();
      expect(analysis.rule.length).toBeGreaterThan(0);
      expect(analysis.rule[0]!.articleNumber).toBeTruthy();
      expect(analysis.analysis).toBeTruthy();
      expect(analysis.conclusion).toBeTruthy();
    });
  });

  // ─── DUAL jurisdiction ──────────────────────────────────

  describe('analyze() — DUAL jurisdiction', () => {
    it('should perform two independent IRAC analyses plus combined conclusion', async () => {
      // First call: China analysis
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);
      // Second call: Thailand analysis
      mockOpenAIJsonResponse(THAILAND_IRAC_RESPONSE);
      // Third call: Combined conclusion
      mockOpenAITextResponse('综合来看，中国法和泰国法对跨境公司注册有不同要求。建议同时满足两国法律规定。');

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '我想在中国和泰国同时设立公司进行跨境贸易' },
        {
          jurisdiction: 'DUAL',
          confidence: 0.85,
          chinaLaws: [{ lawName: '外商投资法', description: '外商投资' }],
          thailandLaws: [{ lawName: 'Foreign Business Act', description: '外国人经商法' }],
        },
      );

      expect(result.jurisdiction.jurisdiction).toBe('DUAL');

      // Both analyses should be present
      expect(result.chinaAnalysis).toBeDefined();
      expect(result.thailandAnalysis).toBeDefined();
      expect(result.combinedConclusion).toBeDefined();

      // China analysis completeness
      const china = result.chinaAnalysis!;
      expect(china.issue).toBeTruthy();
      expect(china.rule.length).toBeGreaterThan(0);
      expect(china.analysis).toBeTruthy();
      expect(china.conclusion).toBeTruthy();

      // Thailand analysis completeness
      const thailand = result.thailandAnalysis!;
      expect(thailand.issue).toBeTruthy();
      expect(thailand.rule.length).toBeGreaterThan(0);
      expect(thailand.analysis).toBeTruthy();
      expect(thailand.conclusion).toBeTruthy();

      // Combined conclusion
      expect(result.combinedConclusion!.length).toBeGreaterThan(0);
    });

    it('should make three LLM calls for DUAL jurisdiction', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);
      mockOpenAIJsonResponse(THAILAND_IRAC_RESPONSE);
      mockOpenAITextResponse('综合结论');

      const engine = new IRACEngine();
      await engine.analyze(
        { query: '中泰跨境投资' },
        { jurisdiction: 'DUAL', confidence: 0.8 },
      );

      // Two IRAC analyses (parallel) + one combined conclusion = 3 calls
      expect(mockOpenAICreate).toHaveBeenCalledTimes(3);
    });
  });

  // ─── Rule step references ───────────────────────────────

  describe('Rule step — law article references', () => {
    it('should include articleNumber in rule references', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '公司法问题' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      const rules = result.chinaAnalysis!.rule;
      expect(rules.length).toBeGreaterThan(0);
      // At least one rule should have an articleNumber
      const hasArticle = rules.some(r => r.articleNumber && r.articleNumber.trim().length > 0);
      expect(hasArticle).toBe(true);
    });

    it('should provide fallback articleNumber when LLM omits it', async () => {
      mockOpenAIJsonResponse({
        issue: '争议焦点',
        rule: [{ lawName: '《民法典》', description: '民事法律' }],
        analysis: '分析内容',
        conclusion: '结论内容',
      });

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '民法典问题' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      const rules = result.chinaAnalysis!.rule;
      expect(rules.length).toBeGreaterThan(0);
      // Should have a fallback articleNumber
      const hasArticle = rules.some(r => r.articleNumber);
      expect(hasArticle).toBe(true);
    });
  });

  // ─── Degraded response handling ─────────────────────────

  describe('Degraded response handling', () => {
    it('should return degraded analysis when both LLM providers fail', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '法律咨询' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      expect(result.chinaAnalysis).toBeDefined();
      const analysis = result.chinaAnalysis!;
      expect(analysis.issue).toBeTruthy();
      expect(analysis.rule.length).toBeGreaterThan(0);
      expect(analysis.analysis).toBeTruthy();
      expect(analysis.conclusion).toBeTruthy();
    });

    it('should handle invalid JSON from LLM gracefully', async () => {
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'not valid json' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '法律问题' },
        { jurisdiction: 'THAILAND', confidence: 0.9 },
      );

      // Should return degraded analysis instead of throwing
      expect(result.thailandAnalysis).toBeDefined();
      expect(result.thailandAnalysis!.issue).toBeTruthy();
    });
  });

  // ─── Normalization edge cases ───────────────────────────

  describe('Normalization edge cases', () => {
    it('should handle empty rule array from LLM', async () => {
      mockOpenAIJsonResponse({
        issue: '争议焦点',
        rule: [],
        analysis: '分析',
        conclusion: '结论',
      });

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '问题' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      // Should provide fallback rule
      expect(result.chinaAnalysis!.rule.length).toBeGreaterThan(0);
      expect(result.chinaAnalysis!.rule[0]!.lawName).toBeTruthy();
    });

    it('should handle empty string fields from LLM', async () => {
      mockOpenAIJsonResponse({
        issue: '',
        rule: [{ lawName: '《公司法》', articleNumber: '第1条', description: '' }],
        analysis: '',
        conclusion: '',
      });

      const engine = new IRACEngine();
      const result = await engine.analyze(
        { query: '问题' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      const analysis = result.chinaAnalysis!;
      // All fields should be non-empty (fallback values)
      expect(analysis.issue.length).toBeGreaterThan(0);
      expect(analysis.analysis.length).toBeGreaterThan(0);
      expect(analysis.conclusion.length).toBeGreaterThan(0);
    });

    it('should include context in the prompt when provided', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);

      const engine = new IRACEngine();
      await engine.analyze(
        { query: '合同纠纷', context: '用户是一家在北京注册的外资企业' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('用户是一家在北京注册的外资企业');
    });
  });

  // ─── LLM call configuration ─────────────────────────────

  describe('LLM call configuration', () => {
    it('should use json_object response format for IRAC analysis', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);

      const engine = new IRACEngine();
      await engine.analyze(
        { query: '法律问题' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should include IRAC system prompt with four-step methodology', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);

      const engine = new IRACEngine();
      await engine.analyze(
        { query: '法律问题' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('IRAC');
      expect(systemMessage?.content).toContain('Issue');
      expect(systemMessage?.content).toContain('Rule');
      expect(systemMessage?.content).toContain('Analysis');
      expect(systemMessage?.content).toContain('Conclusion');
    });

    it('should include China jurisdiction hint for CHINA analysis', async () => {
      mockOpenAIJsonResponse(CHINA_IRAC_RESPONSE);

      const engine = new IRACEngine();
      await engine.analyze(
        { query: '法律问题' },
        { jurisdiction: 'CHINA', confidence: 0.9 },
      );

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('中国法');
    });

    it('should include Thailand jurisdiction hint for THAILAND analysis', async () => {
      mockOpenAIJsonResponse(THAILAND_IRAC_RESPONSE);

      const engine = new IRACEngine();
      await engine.analyze(
        { query: 'Business in Thailand' },
        { jurisdiction: 'THAILAND', confidence: 0.9 },
      );

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as {
        messages: Array<{ role: string; content: string }>;
      };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('泰国法');
    });
  });
});
