import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LLMMessage, LLMResponse, LLMStreamChunk } from '@/server/services/llm/types';

// ─── Mock OpenAI ────────────────────────────────────────────
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

// ─── Mock Anthropic ─────────────────────────────────────────
const mockAnthropicCreate = vi.fn();
const mockAnthropicStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = {
        create: mockAnthropicCreate,
        stream: mockAnthropicStream,
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
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-anthropic-key');
    vi.stubEnv('ANTHROPIC_MODEL', 'claude-3-sonnet-20240229');

    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();
    mockAnthropicStream.mockReset();

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
    it('should call OpenAI as primary provider and return response', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'IRAC stands for...' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      });

      const gw = new LLMGateway();
      const result = await gw.chat(sampleMessages);

      expect(result.content).toBe('IRAC stands for...');
      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4');
      expect(result.usage?.totalTokens).toBe(30);
      expect(mockOpenAICreate).toHaveBeenCalledOnce();
    });

    it('should fall back to Anthropic when OpenAI fails', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI rate limit'));
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'IRAC is a method...' }],
        usage: { input_tokens: 10, output_tokens: 15 },
        stop_reason: 'end_turn',
      });

      const gw = new LLMGateway();
      const result = await gw.chat(sampleMessages);

      expect(result.content).toBe('IRAC is a method...');
      expect(result.provider).toBe('anthropic');
      expect(mockOpenAICreate).toHaveBeenCalledOnce();
      expect(mockAnthropicCreate).toHaveBeenCalledOnce();
    });

    it('should return degraded response when both providers fail', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const gw = new LLMGateway();
      const result = await gw.chat(sampleMessages);

      expect(result.provider).toBe('fallback');
      expect(result.content).toContain('AI 服务暂时不可用');
      expect(result.finishReason).toBe('degraded');
    });

    it('should use specific provider when requested', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Claude response' }],
        usage: { input_tokens: 5, output_tokens: 10 },
        stop_reason: 'end_turn',
      });

      const gw = new LLMGateway();
      const result = await gw.chat(sampleMessages, { provider: 'anthropic' });

      expect(result.provider).toBe('anthropic');
      expect(result.content).toBe('Claude response');
      expect(mockOpenAICreate).not.toHaveBeenCalled();
    });

    it('should pass temperature and maxTokens to OpenAI', async () => {
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
    it('should stream chunks from OpenAI', async () => {
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
      expect(chunks[0].content).toBe('Hello');
      expect(chunks[1].content).toBe(' world');
      expect(chunks[2].done).toBe(true);
      expect(chunks[0].provider).toBe('openai');
    });

    it('should fall back to Anthropic stream when OpenAI stream fails', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI stream error'));

      const mockAnthropicEvents = (async function* () {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Anthropic chunk' } };
        yield { type: 'message_stop' };
      })();
      mockAnthropicStream.mockReturnValue(mockAnthropicEvents);

      const gw = new LLMGateway();
      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of gw.chatStream(sampleMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2);
      expect(chunks[0].content).toBe('Anthropic chunk');
      expect(chunks[0].provider).toBe('anthropic');
      expect(chunks[1].done).toBe(true);
    });

    it('should yield degraded chunk when both streams fail', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicStream.mockImplementation(() => {
        throw new Error('Anthropic down');
      });

      const gw = new LLMGateway();
      const chunks: LLMStreamChunk[] = [];
      for await (const chunk of gw.chatStream(sampleMessages)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0].done).toBe(true);
      expect(chunks[0].provider).toBe('fallback');
      expect(chunks[0].content).toContain('AI 服务暂时不可用');
    });
  });

  describe('parseJSON()', () => {
    it('should parse valid JSON from LLM response', () => {
      const gw = new LLMGateway();
      const response: LLMResponse = {
        content: '{"jurisdiction":"CHINA","confidence":0.95}',
        model: 'gpt-4',
        provider: 'openai',
      };

      const parsed = gw.parseJSON<{ jurisdiction: string; confidence: number }>(response);
      expect(parsed.jurisdiction).toBe('CHINA');
      expect(parsed.confidence).toBe(0.95);
    });

    it('should throw on invalid JSON', () => {
      const gw = new LLMGateway();
      const response: LLMResponse = {
        content: 'This is not JSON',
        model: 'gpt-4',
        provider: 'openai',
      };

      expect(() => gw.parseJSON(response)).toThrow('Failed to parse LLM response as JSON');
    });

    it('should validate with a Zod-like schema', () => {
      const gw = new LLMGateway();
      const response: LLMResponse = {
        content: '{"value":42}',
        model: 'gpt-4',
        provider: 'openai',
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
    it('should return true when at least one provider is configured', () => {
      const gw = new LLMGateway();
      expect(gw.isAvailable()).toBe(true);
    });
  });
});

describe('PromptEngine', () => {
  let PromptEngine: typeof import('@/server/services/llm/prompt-engine').PromptEngine;
  let resetPromptEngine: typeof import('@/server/services/llm/prompt-engine').resetPromptEngine;

  beforeEach(async () => {
    mockFindFirst.mockReset();

    const mod = await import('@/server/services/llm/prompt-engine');
    PromptEngine = mod.PromptEngine;
    resetPromptEngine = mod.resetPromptEngine;
    resetPromptEngine();
  });

  describe('getTemplate()', () => {
    it('should load template from database', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'test_template',
        category: 'test',
        systemPrompt: 'You are a test assistant.',
        userPromptTemplate: 'Answer: {{question}}',
        variables: { question: 'The question' },
        version: 1,
        isActive: true,
      });

      const engine = new PromptEngine();
      const template = await engine.getTemplate('test_template');

      expect(template).not.toBeNull();
      expect(template!.name).toBe('test_template');
      expect(template!.systemPrompt).toBe('You are a test assistant.');
    });

    it('should fall back to hardcoded template when DB fails', async () => {
      mockFindFirst.mockRejectedValue(new Error('DB connection failed'));

      const engine = new PromptEngine();
      const template = await engine.getTemplate('jurisdiction_identifier');

      expect(template).not.toBeNull();
      expect(template!.name).toBe('jurisdiction_identifier');
      expect(template!.category).toBe('legal_analysis');
    });

    it('should return null for unknown template with no fallback', async () => {
      mockFindFirst.mockResolvedValue(null);

      const engine = new PromptEngine();
      const template = await engine.getTemplate('nonexistent_template');

      expect(template).toBeNull();
    });

    it('should use cache on subsequent calls', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'cached_template',
        category: 'test',
        systemPrompt: 'Cached system prompt',
        userPromptTemplate: 'Cached: {{input}}',
        variables: { input: 'input' },
        version: 1,
        isActive: true,
      });

      const engine = new PromptEngine();
      await engine.getTemplate('cached_template');
      await engine.getTemplate('cached_template');

      // DB should only be called once due to caching
      expect(mockFindFirst).toHaveBeenCalledTimes(1);
    });
  });

  describe('renderPrompt()', () => {
    it('should substitute variables in user prompt template', async () => {
      mockFindFirst.mockRejectedValue(new Error('DB unavailable'));

      const engine = new PromptEngine();
      const rendered = await engine.renderPrompt('jurisdiction_identifier', {
        query: '我想在泰国注册一家公司',
      });

      expect(rendered).toContain('我想在泰国注册一家公司');
      expect(rendered).not.toContain('{{query}}');
    });

    it('should leave unmatched variables as-is', async () => {
      mockFindFirst.mockRejectedValue(new Error('DB unavailable'));

      const engine = new PromptEngine();
      const rendered = await engine.renderPrompt('irac_analysis', {
        query: 'Some legal question',
        // jurisdiction is not provided
      });

      expect(rendered).toContain('Some legal question');
      expect(rendered).toContain('{{jurisdiction}}');
    });

    it('should throw for unknown template', async () => {
      mockFindFirst.mockResolvedValue(null);

      const engine = new PromptEngine();
      await expect(engine.renderPrompt('unknown', {})).rejects.toThrow(
        'Prompt template "unknown" not found',
      );
    });
  });

  describe('renderSystemPrompt()', () => {
    it('should return the system prompt from template', async () => {
      mockFindFirst.mockRejectedValue(new Error('DB unavailable'));

      const engine = new PromptEngine();
      const systemPrompt = await engine.renderSystemPrompt('jurisdiction_identifier');

      expect(systemPrompt).toContain('中国法律');
      expect(systemPrompt).toContain('泰国法律');
    });
  });

  describe('clearCache()', () => {
    it('should clear the template cache forcing re-fetch', async () => {
      mockFindFirst.mockResolvedValue({
        name: 'to_clear',
        category: 'test',
        systemPrompt: 'sys',
        userPromptTemplate: 'user',
        variables: null,
        version: 1,
        isActive: true,
      });

      const engine = new PromptEngine();
      await engine.getTemplate('to_clear');
      engine.clearCache();

      // After clearing, it should query DB again
      await engine.getTemplate('to_clear');
      expect(mockFindFirst).toHaveBeenCalledTimes(2);
    });
  });
});
