import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMMessage, LLMResponse, LLMStreamChunk } from '@/server/services/llm/types';

// ─── Mock OpenAI (used by GLM via OpenAI-compatible SDK) ────
const mockOpenAICreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockOpenAICreate,
        },
      };
    },
  };
});

// ─── Mock Prisma ────────────────────────────────────────────
const mockFindFirst = vi.fn();
vi.mock('@/lib/prisma', () => ({
  default: {
    promptTemplate: {
      findFirst: mockFindFirst,
    },
  },
}));

describe('LLMGateway', () => {
  let LLMGateway: typeof import('@/server/services/llm/gateway').LLMGateway;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;

  beforeEach(async () => {
    vi.stubEnv('GLM_API_KEY', 'test-glm-key');
    vi.stubEnv('GLM_MODEL', 'glm-4-flash-250414');

    mockOpenAICreate.mockReset();

    const mod = await import('@/server/services/llm/gateway');
    LLMGateway = mod.LLMGateway;
    resetLLMGateway = mod.resetLLMGateway;
    resetLLMGateway();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const sampleMessages: LLMMessage[] = [
    { role: 'system', content: 'You are a legal expert.' },
    { role: 'user', content: 'What is IRAC?' },
  ];

  describe('chat()', () => {
    it('should call GLM and return response', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'IRAC stands for...' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const gw = new LLMGateway();
      const result = await gw.chat(sampleMessages);

      expect(result.content).toBe('IRAC stands for...');
      expect(result.provider).toBe('glm');
      expect(result.model).toBe('glm-4-flash-250414');
      expect(result.usage?.totalTokens).toBe(30);
      expect(mockOpenAICreate).toHaveBeenCalledOnce();
    });

    it('should return degraded response when GLM fails', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('GLM down'));

      const gw = new LLMGateway();
      const result = await gw.chat(sampleMessages);

      expect(result.provider).toBe('fallback');
      expect(result.content).toContain('AI 服务暂时不可用');
      expect(result.finishReason).toBe('degraded');
    });

    it('should return degraded response when GLM_API_KEY is missing', async () => {
      vi.stubEnv('GLM_API_KEY', '');

      resetLLMGateway();
      const mod = await import('@/server/services/llm/gateway');
      const gw = new mod.LLMGateway();
      const result = await gw.chat(sampleMessages);

      expect(result.provider).toBe('fallback');
      expect(result.content).toContain('AI 服务暂时不可用');
    });

    it('should pass temperature and maxTokens to GLM', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });

      const gw = new LLMGateway();
      await gw.chat(sampleMessages, { temperature: 0.2, maxTokens: 500 });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2,
          max_tokens: 500,
        }),
      );
    });

    it('should pass response_format for json_object mode', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: '{"result":"ok"}' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });

      const gw = new LLMGateway();
      await gw.chat(sampleMessages, { responseFormat: 'json_object' });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        }),
      );
    });
  });

  describe('chatStream()', () => {
    it('should stream chunks from GLM', async () => {
      const mockStream = (async function* () {
        yield { choices: [{ delta: { content: 'Hello' }, finish_reason: null }] };
        yield { choices: [{ delta: { content: ' world' }, finish_reason: null }] };
        yield { choices: [{ delta: { content: '' }, finish_reason: 'stop' }] };
      })();

      mockOpenAICreate.mockResolvedValue(mockStream);

      const gw = new LLMGateway();
      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of gw.chatStream(sampleMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(chunks[0]!.content).toBe('Hello');
      expect(chunks[1]!.content).toBe(' world');
      expect(chunks[2]!.done).toBe(true);
      expect(chunks[0]!.provider).toBe('glm');
    });

    it('should yield degraded chunk when GLM stream fails', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('GLM stream error'));

      const gw = new LLMGateway();
      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of gw.chatStream(sampleMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0]!.done).toBe(true);
      expect(chunks[0]!.provider).toBe('fallback');
      expect(chunks[0]!.content).toContain('AI 服务暂时不可用');
    });
  });

  describe('parseJSON()', () => {
    it('should parse valid JSON from LLM response', () => {
      const gw = new LLMGateway();
      const response: LLMResponse = {
        content: '{"jurisdiction":"CHINA","confidence":0.95}',
        model: 'glm-4-flash-250414',
        provider: 'glm',
      };

      const parsed = gw.parseJSON<{ jurisdiction: string; confidence: number }>(response);
      expect(parsed.jurisdiction).toBe('CHINA');
      expect(parsed.confidence).toBe(0.95);
    });

    it('should throw on invalid JSON', () => {
      const gw = new LLMGateway();
      const response: LLMResponse = {
        content: 'This is not JSON',
        model: 'glm-4-flash-250414',
        provider: 'glm',
      };

      expect(() => gw.parseJSON(response)).toThrow('Failed to parse LLM response as JSON');
    });

    it('should validate with a Zod-like schema', () => {
      const gw = new LLMGateway();
      const response: LLMResponse = {
        content: '{"value":42}',
        model: 'glm-4-flash-250414',
        provider: 'glm',
      };

      const mockSchema = {
        parse: (data: unknown) => {
          const obj = data as { value: number };
          if (typeof obj.value !== 'number') throw new Error('Invalid');
          return obj;
        },
      };

      const parsed = gw.parseJSON(response, mockSchema);
      expect(parsed.value).toBe(42);
    });
  });

  describe('isAvailable()', () => {
    it('should return true when GLM is configured', () => {
      const gw = new LLMGateway();
      expect(gw.isAvailable()).toBe(true);
    });

    it('should return false when GLM_API_KEY is missing', async () => {
      vi.stubEnv('GLM_API_KEY', '');
      resetLLMGateway();
      const mod = await import('@/server/services/llm/gateway');
      const gw = new mod.LLMGateway();
      expect(gw.isAvailable()).toBe(false);
    });
  });
});
