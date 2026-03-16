/**
 * LLM Service Types
 * TypeScript interfaces for LLM Gateway and Prompt Engine
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  /** Override the model to use (e.g., 'gpt-4', 'claude-3-sonnet-20240229') */
  model?: string;
  /** Sampling temperature (0-2) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
  /** Response format — use 'json_object' for structured JSON output */
  responseFormat?: 'text' | 'json_object';
  /** Which provider to use explicitly */
  provider?: 'openai' | 'anthropic';
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'fallback';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'fallback';
}

export interface PromptTemplateData {
  name: string;
  category: string;
  systemPrompt: string;
  userPromptTemplate: string;
  variables: Record<string, string> | null;
  version: number;
  isActive: boolean;
}
