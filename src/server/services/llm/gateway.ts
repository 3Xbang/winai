/**
 * LLM API Gateway — GLM (ZhipuAI) Only
 * Uses OpenAI-compatible SDK to call ZhipuAI GLM API.
 */

import OpenAI from 'openai';
import type { LLMMessage, LLMOptions, LLMResponse, LLMStreamChunk } from './types';

const DEGRADED_RESPONSE: LLMResponse = {
  content: '抱歉，AI 服务暂时不可用，请稍后重试。Sorry, the AI service is temporarily unavailable. Please try again later.',
  model: 'none',
  provider: 'fallback',
  finishReason: 'degraded',
};

export class LLMGateway {
  private glm: OpenAI | null = null;
  private glmModel: string;

  constructor() {
    this.glmModel = process.env.GLM_MODEL || 'glm-4-flash-250414';

    if (process.env.GLM_API_KEY) {
      this.glm = new OpenAI({
        apiKey: process.env.GLM_API_KEY,
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      });
    }
  }

  /** Send a chat completion request via GLM. */
  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    if (!this.glm) {
      console.error('GLM client not initialized — GLM_API_KEY is missing');
      return { ...DEGRADED_RESPONSE };
    }

    const model = options.model || this.glmModel;
    try {
      const response = await this.glm.chat.completions.create({
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
        provider: 'glm',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
        finishReason: choice?.finish_reason ?? undefined,
      };
    } catch (error) {
      console.error('GLM API failed:', (error as Error).message);
      return { ...DEGRADED_RESPONSE };
    }
  }

  /** Stream a chat completion via GLM. */
  async *chatStream(messages: LLMMessage[], options: LLMOptions = {}): AsyncIterable<LLMStreamChunk> {
    if (!this.glm) {
      yield { content: DEGRADED_RESPONSE.content, done: true, provider: 'fallback' };
      return;
    }

    const model = options.model || this.glmModel;
    try {
      const stream = await this.glm.chat.completions.create({
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
          provider: 'glm',
        };
      }
    } catch (error) {
      console.error('GLM stream failed:', (error as Error).message);
      yield { content: DEGRADED_RESPONSE.content, done: true, provider: 'fallback' };
    }
  }

  /** Parse JSON from LLM response. */
  parseJSON<T = unknown>(response: LLMResponse, schema?: { parse: (data: unknown) => T }): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(response.content);
    } catch {
      throw new Error(`Failed to parse LLM response as JSON: ${response.content.slice(0, 200)}`);
    }
    if (schema) return schema.parse(parsed);
    return parsed as T;
  }

  isAvailable(): boolean {
    return this.glm !== null;
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

export function resetLLMGateway(): void {
  gatewayInstance = null;
}
