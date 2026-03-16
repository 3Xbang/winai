/**
 * 嵌入服务 - 封装 OpenAI Embeddings API (text-embedding-3-small, 1536 维度)
 * 提供文本向量化能力，支持单条和批量处理
 */

import { EmbeddingClient, EMBEDDING_DIMENSION } from './types';

/** OpenAI 嵌入客户端 - 调用 OpenAI Embeddings API */
export class OpenAIEmbeddingClient implements EmbeddingClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = options?.model || 'text-embedding-3-small';
    this.baseUrl = options?.baseUrl || 'https://api.openai.com/v1';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Input text cannot be empty');
    }

    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: text.trim(),
          model: this.model,
          dimensions: EMBEDDING_DIMENSION,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded: ${errorBody}`);
        }
        throw new Error(
          `OpenAI API error (${response.status}): ${errorBody}`
        );
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Rate limit')) {
        throw error;
      }
      if (error instanceof Error && error.message.includes('OpenAI API error')) {
        throw error;
      }
      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      throw new Error('Input texts array cannot be empty');
    }

    const trimmed = texts.map((t) => t.trim());
    if (trimmed.some((t) => t.length === 0)) {
      throw new Error('All input texts must be non-empty');
    }

    if (!this.apiKey) {
      throw new Error('OpenAI API key is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          input: trimmed,
          model: this.model,
          dimensions: EMBEDDING_DIMENSION,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        if (response.status === 429) {
          throw new Error(`Rate limit exceeded: ${errorBody}`);
        }
        throw new Error(
          `OpenAI API error (${response.status}): ${errorBody}`
        );
      }

      const data = await response.json();
      // Sort by index to ensure correct order
      const sorted = data.data.sort(
        (a: { index: number }, b: { index: number }) => a.index - b.index
      );
      return sorted.map((item: { embedding: number[] }) => item.embedding);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Rate limit') || error.message.includes('OpenAI API error'))) {
        throw error;
      }
      throw new Error(
        `Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}


/**
 * Mock 嵌入客户端 - 用于测试，返回确定性的 1536 维向量
 * 基于文本内容的哈希生成可重复的向量
 */
export class MockEmbeddingClient implements EmbeddingClient {
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error('Input text cannot be empty');
    }
    return generateDeterministicVector(text);
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      throw new Error('Input texts array cannot be empty');
    }
    if (texts.some((t) => !t || t.trim().length === 0)) {
      throw new Error('All input texts must be non-empty');
    }
    return texts.map((text) => generateDeterministicVector(text));
  }
}

/**
 * 基于文本内容生成确定性的 1536 维向量
 * 使用简单的哈希算法确保相同文本产生相同向量
 */
function generateDeterministicVector(text: string): number[] {
  const vector: number[] = new Array(EMBEDDING_DIMENSION);
  let hash = 0;

  // Simple hash from text
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  // Generate deterministic vector from hash seed
  let seed = Math.abs(hash);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    // Linear congruential generator for deterministic pseudo-random values
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    // Normalize to [-1, 1] range
    vector[i] = (seed / 0xffffffff) * 2 - 1;
  }

  // Normalize to unit vector (L2 norm = 1)
  const magnitude = Math.sqrt(
    vector.reduce((sum, val) => sum + val * val, 0)
  );
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    vector[i] = (vector[i] ?? 0) / magnitude;
  }

  return vector;
}
