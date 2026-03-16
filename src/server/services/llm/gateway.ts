/**
 * LLM API Gateway
 * Encapsulates OpenAI and Anthropic Claude API calls with fallback strategy.
 * Primary: OpenAI GPT-4 → Fallback: Anthropic Claude → Degraded response
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import type { LLMMessage, LLMOptions, LLMResponse, LLMStreamChunk } from './types';

const DEGRADED_RESPONSE: LLMResponse = {
  content: '抱歉，AI 服务暂时不可用，请稍后重试。Sorry, the AI service is temporarily unavailable. Please try again later.',
  model: 'none',
  provider: 'fallback',
  finishReason: 'degraded',
};

export class LLMGateway {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;
  private openaiModel: string;
  private anthropicModel: string;

  constructor() {
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4';
    this.anthropicModel = process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229';

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
  }

  /**
   * Send a chat completion request with automatic fallback.
   * Strategy: OpenAI → Claude → degraded response
   */
  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const provider = options.provider;

    // If a specific provider is requested, only try that one
    if (provider === 'openai') {
      return this.chatOpenAI(messages, options);
    }
    if (provider === 'anthropic') {
      return this.chatAnthropic(messages, options);
    }

    // Fallback strategy: OpenAI → Claude → degraded
    try {
      return await this.chatOpenAI(messages, options);
    } catch (openaiError) {
      console.warn('OpenAI API failed, falling back to Anthropic:', (openaiError as Error).message);
      try {
        return await this.chatAnthropic(messages, options);
      } catch (anthropicError) {
        console.error('Anthropic API also failed:', (anthropicError as Error).message);
        return { ...DEGRADED_RESPONSE };
      }
    }
  }

  /**
   * Stream a chat completion with automatic fallback.
   * Returns an AsyncIterable of LLMStreamChunk.
   */
  async *chatStream(messages: LLMMessage[], options: LLMOptions = {}): AsyncIterable<LLMStreamChunk> {
    const provider = options.provider;

    if (provider === 'openai') {
      yield* this.streamOpenAI(messages, options);
      return;
    }
    if (provider === 'anthropic') {
      yield* this.streamAnthropic(messages, options);
      return;
    }

    // Fallback strategy for streaming
    try {
      yield* this.streamOpenAI(messages, options);
    } catch (openaiError) {
      console.warn('OpenAI stream failed, falling back to Anthropic:', (openaiError as Error).message);
      try {
        yield* this.streamAnthropic(messages, options);
      } catch (anthropicError) {
        console.error('Anthropic stream also failed:', (anthropicError as Error).message);
        yield {
          content: DEGRADED_RESPONSE.content,
          done: true,
          provider: 'fallback',
        };
      }
    }
  }

  // ─── OpenAI Methods ───────────────────────────────────────

  private async chatOpenAI(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized — OPENAI_API_KEY is missing');
    }

    const model = options.model || this.openaiModel;
    const response = await this.openai.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      ...(options.responseFormat === 'json_object'
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content ?? '',
      model,
      provider: 'openai',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
      finishReason: choice?.finish_reason ?? undefined,
    };
  }

  private async *streamOpenAI(messages: LLMMessage[], options: LLMOptions): AsyncIterable<LLMStreamChunk> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized — OPENAI_API_KEY is missing');
    }

    const model = options.model || this.openaiModel;
    const stream = await this.openai.chat.completions.create({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const finishReason = chunk.choices[0]?.finish_reason;
      yield {
        content: delta?.content ?? '',
        done: finishReason !== null && finishReason !== undefined,
        model,
        provider: 'openai',
      };
    }
  }

  // ─── Anthropic Methods ────────────────────────────────────

  private async chatAnthropic(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized — ANTHROPIC_API_KEY is missing');
    }

    const model = options.model || this.anthropicModel;

    // Anthropic uses a separate system parameter
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      ...(systemMessage ? { system: systemMessage } : {}),
      messages: nonSystemMessages,
      temperature: options.temperature ?? 0.7,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    return {
      content: textBlock?.text ?? '',
      model,
      provider: 'anthropic',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? undefined,
    };
  }

  private async *streamAnthropic(messages: LLMMessage[], options: LLMOptions): AsyncIterable<LLMStreamChunk> {
    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized — ANTHROPIC_API_KEY is missing');
    }

    const model = options.model || this.anthropicModel;
    const systemMessage = messages.find((m) => m.role === 'system')?.content;
    const nonSystemMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const stream = this.anthropic.messages.stream({
      model,
      max_tokens: options.maxTokens ?? 4096,
      ...(systemMessage ? { system: systemMessage } : {}),
      messages: nonSystemMessages,
      temperature: options.temperature ?? 0.7,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield {
          content: event.delta.text,
          done: false,
          model,
          provider: 'anthropic',
        };
      }
      if (event.type === 'message_stop') {
        yield {
          content: '',
          done: true,
          model,
          provider: 'anthropic',
        };
      }
    }
  }

  // ─── Utility Methods ──────────────────────────────────────

  /**
   * Parse a JSON response from the LLM, with optional Zod schema validation.
   * @param response The LLM response to parse
   * @param schema Optional Zod schema for validation
   * @returns Parsed and optionally validated object
   */
  parseJSON<T = unknown>(response: LLMResponse, schema?: { parse: (data: unknown) => T }): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      throw new Error(`Failed to parse LLM response as JSON: ${response.content.slice(0, 200)}`);
    }

    if (schema) {
      return schema.parse(parsed);
    }
    return parsed as T;
  }

  /**
   * Check if either provider is available.
   */
  isAvailable(): boolean {
    return this.openai !== null || this.anthropic !== null;
  }
}

/** Singleton instance */
let gatewayInstance: LLMGateway | null = null;

export function getLLMGateway(): LLMGateway {
  if (!gatewayInstance) {
    gatewayInstance = new LLMGateway();
  }
  return gatewayInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetLLMGateway(): void {
  gatewayInstance = null;
}
