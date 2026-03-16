import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMMessage, LLMResponse } from '@/server/services/llm/types';

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

describe('JurisdictionIdentifier', () => {
  let JurisdictionIdentifier: typeof import('@/server/services/legal/jurisdiction').JurisdictionIdentifier;
  let resetJurisdictionIdentifier: typeof import('@/server/services/legal/jurisdiction').resetJurisdictionIdentifier;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;
  let resetPromptEngine: typeof import('@/server/services/llm/prompt-engine').resetPromptEngine;
  let CONFIDENCE_THRESHOLD: number;

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

    const mod = await import('@/server/services/legal/jurisdiction');
    JurisdictionIdentifier = mod.JurisdictionIdentifier;
    resetJurisdictionIdentifier = mod.resetJurisdictionIdentifier;
    CONFIDENCE_THRESHOLD = mod.CONFIDENCE_THRESHOLD;
    resetJurisdictionIdentifier();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('identify() — China jurisdiction', () => {
    it('should identify CHINA jurisdiction with high confidence', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'CHINA',
        confidence: 0.95,
        chinaLaws: [
          { lawName: '公司法', articleNumber: '第23条', description: '公司注册相关规定' },
        ],
        thailandLaws: [],
        needsMoreInfo: [],
        reasoning: '咨询内容明确涉及中国公司注册',
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '我想在上海注册一家有限责任公司，需要什么条件？' });

      expect(result.jurisdiction).toBe('CHINA');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.chinaLaws).toBeDefined();
      expect(result.chinaLaws!.length).toBeGreaterThan(0);
      expect(result.chinaLaws?.[0]?.lawName).toBe('公司法');
      expect(result.needsMoreInfo).toBeUndefined();
    });
  });

  describe('identify() — Thailand jurisdiction', () => {
    it('should identify THAILAND jurisdiction with high confidence', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'THAILAND',
        confidence: 0.92,
        chinaLaws: [],
        thailandLaws: [
          { lawName: 'Foreign Business Act', description: '外国人在泰经商限制' },
        ],
        needsMoreInfo: [],
        reasoning: '咨询内容涉及泰国签证和工作许可',
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '我想申请泰国工作签证，需要什么材料？' });

      expect(result.jurisdiction).toBe('THAILAND');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.thailandLaws).toBeDefined();
      expect(result.thailandLaws!.length).toBeGreaterThan(0);
      expect(result.needsMoreInfo).toBeUndefined();
    });
  });

  describe('identify() — Dual jurisdiction', () => {
    it('should identify DUAL jurisdiction and return both law arrays', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'DUAL',
        confidence: 0.85,
        chinaLaws: [
          { lawName: '外商投资法', description: '外商投资准入规定' },
        ],
        thailandLaws: [
          { lawName: 'Foreign Business Act', description: '外国人经商法' },
        ],
        needsMoreInfo: [],
        reasoning: '涉及中泰跨境投资',
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({
        query: '我是中国公民，想在泰国设立一家贸易公司，同时在中国设立分公司',
      });

      expect(result.jurisdiction).toBe('DUAL');
      expect(result.chinaLaws).toBeDefined();
      expect(result.chinaLaws!.length).toBeGreaterThan(0);
      expect(result.thailandLaws).toBeDefined();
      expect(result.thailandLaws!.length).toBeGreaterThan(0);
    });
  });

  describe('identify() — Low confidence triggers needsMoreInfo', () => {
    it('should return needsMoreInfo when confidence is below threshold', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'CHINA',
        confidence: 0.5,
        chinaLaws: [{ lawName: '待确定', description: '需要更多信息' }],
        thailandLaws: [],
        needsMoreInfo: ['请说明您的业务所在地', '请说明涉及的具体法律问题类型'],
        reasoning: '信息不足以准确判定',
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '我有一个法律问题想咨询' });

      expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
      expect(result.needsMoreInfo).toBeDefined();
      expect(result.needsMoreInfo!.length).toBeGreaterThan(0);
    });

    it('should provide default needsMoreInfo when LLM returns empty array for low confidence', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'DUAL',
        confidence: 0.4,
        chinaLaws: [],
        thailandLaws: [],
        needsMoreInfo: [],
        reasoning: '无法判定',
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '帮我看看这个问题' });

      expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
      expect(result.needsMoreInfo).toBeDefined();
      expect(result.needsMoreInfo!.length).toBeGreaterThan(0);
    });
  });

  describe('identify() — High confidence does NOT include needsMoreInfo', () => {
    it('should not include needsMoreInfo when confidence is above threshold', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'CHINA',
        confidence: 0.95,
        chinaLaws: [{ lawName: '劳动合同法', description: '劳动合同相关' }],
        thailandLaws: [],
        needsMoreInfo: [],
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '北京公司员工被辞退的赔偿标准是什么？' });

      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
      expect(result.needsMoreInfo).toBeUndefined();
    });
  });

  describe('identify() — Degraded response handling', () => {
    it('should return safe default when both LLM providers fail', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '法律咨询' });

      expect(result.jurisdiction).toBe('DUAL');
      expect(result.confidence).toBe(0);
      expect(result.needsMoreInfo).toBeDefined();
      expect(result.needsMoreInfo!.length).toBeGreaterThan(0);
    });
  });

  describe('identify() — Normalization and edge cases', () => {
    it('should clamp confidence to [0, 1] range', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'CHINA',
        confidence: 1.5,
        chinaLaws: [{ lawName: '民法典', description: '民事法律' }],
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '民法典相关问题' });

      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing law references gracefully for DUAL', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'DUAL',
        confidence: 0.8,
        // No chinaLaws or thailandLaws provided
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '中泰跨境贸易问题' });

      expect(result.jurisdiction).toBe('DUAL');
      // Should have fallback law references
      expect(result.chinaLaws).toBeDefined();
      expect(result.chinaLaws!.length).toBeGreaterThan(0);
      expect(result.thailandLaws).toBeDefined();
      expect(result.thailandLaws!.length).toBeGreaterThan(0);
    });

    it('should normalize lowercase jurisdiction values', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'thailand',
        confidence: 0.9,
        thailandLaws: [{ lawName: 'Immigration Act', description: '移民法' }],
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '泰国移民法问题' });

      expect(result.jurisdiction).toBe('THAILAND');
    });

    it('should default to DUAL for invalid jurisdiction values', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'INVALID',
        confidence: 0.5,
      });

      const identifier = new JurisdictionIdentifier();
      const result = await identifier.identify({ query: '一些问题' });

      expect(result.jurisdiction).toBe('DUAL');
    });

    it('should include context in the prompt when provided', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'THAILAND',
        confidence: 0.9,
        thailandLaws: [{ lawName: 'Labor Protection Act', description: '劳动保护法' }],
      });

      const identifier = new JurisdictionIdentifier();
      await identifier.identify({
        query: '劳动纠纷问题',
        context: '用户在泰国曼谷工作',
      });

      // Verify the LLM was called (the context should be included in the prompt)
      expect(mockOpenAICreate).toHaveBeenCalledOnce();
      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('用户在泰国曼谷工作');
    });
  });

  describe('identify() — LLM call configuration', () => {
    it('should use json_object response format and low temperature', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'CHINA',
        confidence: 0.9,
        chinaLaws: [{ lawName: '公司法', description: '公司法' }],
      });

      const identifier = new JurisdictionIdentifier();
      await identifier.identify({ query: '公司法问题' });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should include system prompt with keyword mapping', async () => {
      mockOpenAIJsonResponse({
        jurisdiction: 'CHINA',
        confidence: 0.9,
        chinaLaws: [{ lawName: '民法典', description: '民事' }],
      });

      const identifier = new JurisdictionIdentifier();
      await identifier.identify({ query: '民法典问题' });

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('中泰法律关键词映射表');
      expect(systemMessage?.content).toContain('管辖权判定规则');
    });
  });
});
