/**
 * RAG 嵌入服务与向量存储单元测试
 * 测试 embedding 生成、向量存储 CRUD、余弦相似度计算等核心功能
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockEmbeddingClient } from '@/server/services/rag/embedding';
import {
  InMemoryVectorStore,
  cosineSimilarity,
} from '@/server/services/rag/vector-store';
import {
  EMBEDDING_DIMENSION,
  VectorDocument,
} from '@/server/services/rag/types';

// ==================== Embedding Service Tests ====================

describe('MockEmbeddingClient', () => {
  let client: MockEmbeddingClient;

  beforeEach(() => {
    client = new MockEmbeddingClient();
  });

  describe('generateEmbedding', () => {
    it('should return a vector with 1536 dimensions', async () => {
      const embedding = await client.generateEmbedding('中国民法典第一条');
      expect(embedding).toHaveLength(EMBEDDING_DIMENSION);
    });

    it('should return deterministic results for the same input', async () => {
      const embedding1 = await client.generateEmbedding('test input');
      const embedding2 = await client.generateEmbedding('test input');
      expect(embedding1).toEqual(embedding2);
    });

    it('should return different vectors for different inputs', async () => {
      const embedding1 = await client.generateEmbedding('中国法律');
      const embedding2 = await client.generateEmbedding('泰国法律');
      expect(embedding1).not.toEqual(embedding2);
    });

    it('should return a normalized unit vector', async () => {
      const embedding = await client.generateEmbedding('unit vector test');
      const magnitude = Math.sqrt(
        embedding.reduce((sum, val) => sum + val * val, 0)
      );
      expect(magnitude).toBeCloseTo(1.0, 5);
    });

    it('should throw error for empty text', async () => {
      await expect(client.generateEmbedding('')).rejects.toThrow(
        'Input text cannot be empty'
      );
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(client.generateEmbedding('   ')).rejects.toThrow(
        'Input text cannot be empty'
      );
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should return correct number of embeddings', async () => {
      const texts = ['text one', 'text two', 'text three'];
      const embeddings = await client.generateBatchEmbeddings(texts);
      expect(embeddings).toHaveLength(3);
    });

    it('should return 1536-dim vectors for each text', async () => {
      const texts = ['合同法', '刑法'];
      const embeddings = await client.generateBatchEmbeddings(texts);
      for (const emb of embeddings) {
        expect(emb).toHaveLength(EMBEDDING_DIMENSION);
      }
    });

    it('should match individual embedding results', async () => {
      const texts = ['hello', 'world'];
      const batchResults = await client.generateBatchEmbeddings(texts);
      const individual1 = await client.generateEmbedding('hello');
      const individual2 = await client.generateEmbedding('world');
      expect(batchResults[0]).toEqual(individual1);
      expect(batchResults[1]).toEqual(individual2);
    });

    it('should throw error for empty array', async () => {
      await expect(client.generateBatchEmbeddings([])).rejects.toThrow(
        'Input texts array cannot be empty'
      );
    });

    it('should throw error if any text is empty', async () => {
      await expect(
        client.generateBatchEmbeddings(['valid', ''])
      ).rejects.toThrow('All input texts must be non-empty');
    });
  });
});


// ==================== Cosine Similarity Tests ====================

describe('cosineSimilarity', () => {
  it('should return 1 for identical vectors', () => {
    const v = [1, 0, 0];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it('should return -1 for opposite vectors', () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  it('should return 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  it('should handle high-dimensional vectors', () => {
    const dim = EMBEDDING_DIMENSION;
    const a = new Array(dim).fill(1 / Math.sqrt(dim));
    const b = new Array(dim).fill(1 / Math.sqrt(dim));
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
  });

  it('should throw error for mismatched dimensions', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(
      'Vector dimensions must match'
    );
  });

  it('should throw error for empty vectors', () => {
    expect(() => cosineSimilarity([], [])).toThrow('Vectors cannot be empty');
  });

  it('should return 0 for zero vectors', () => {
    const zero = [0, 0, 0];
    expect(cosineSimilarity(zero, [1, 0, 0])).toBe(0);
  });

  it('should be symmetric', () => {
    const a = [0.5, 0.3, 0.8];
    const b = [0.1, 0.9, 0.4];
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 10);
  });
});

// ==================== Vector Store Tests ====================

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;
  let embeddingClient: MockEmbeddingClient;

  beforeEach(() => {
    store = new InMemoryVectorStore();
    embeddingClient = new MockEmbeddingClient();
  });

  /** Helper to create a VectorDocument */
  async function createDoc(
    documentId: string,
    chunkIndex: number,
    content: string,
    namespace: string = 'global',
    metadata?: Record<string, unknown>
  ): Promise<VectorDocument> {
    const embedding = await embeddingClient.generateEmbedding(content);
    return { documentId, chunkIndex, content, embedding, namespace, metadata };
  }

  describe('upsert', () => {
    it('should store a document', async () => {
      const doc = await createDoc('doc1', 0, '中国民法典第一条');
      await store.upsert(doc);
      expect(store.size()).toBe(1);
    });

    it('should overwrite existing document with same id and chunk', async () => {
      const doc1 = await createDoc('doc1', 0, 'original content');
      const doc2 = await createDoc('doc1', 0, 'updated content');
      await store.upsert(doc1);
      await store.upsert(doc2);
      expect(store.size()).toBe(1);

      const results = await store.similaritySearch(
        doc2.embedding,
        'global',
        10
      );
      expect(results[0].content).toBe('updated content');
    });

    it('should store multiple chunks for same document', async () => {
      const doc1 = await createDoc('doc1', 0, 'chunk 0');
      const doc2 = await createDoc('doc1', 1, 'chunk 1');
      await store.upsert(doc1);
      await store.upsert(doc2);
      expect(store.size()).toBe(2);
    });

    it('should throw error for wrong embedding dimension', async () => {
      const doc: VectorDocument = {
        documentId: 'doc1',
        chunkIndex: 0,
        content: 'test',
        embedding: [1, 2, 3], // Wrong dimension
        namespace: 'global',
      };
      await expect(store.upsert(doc)).rejects.toThrow(
        `Embedding dimension must be ${EMBEDDING_DIMENSION}`
      );
    });
  });

  describe('similaritySearch', () => {
    it('should return the most similar documents', async () => {
      const doc1 = await createDoc('doc1', 0, '中国合同法');
      const doc2 = await createDoc('doc2', 0, '泰国刑法');
      const doc3 = await createDoc('doc3', 0, '中国合同法律');

      await store.upsert(doc1);
      await store.upsert(doc2);
      await store.upsert(doc3);

      const queryEmbedding =
        await embeddingClient.generateEmbedding('中国合同法');
      const results = await store.similaritySearch(
        queryEmbedding,
        'global',
        3
      );

      expect(results).toHaveLength(3);
      // The exact match should be first with score ~1.0
      expect(results[0].documentId).toBe('doc1');
      expect(results[0].score).toBeCloseTo(1.0, 5);
    });

    it('should filter by namespace', async () => {
      const doc1 = await createDoc('doc1', 0, 'content A', 'china');
      const doc2 = await createDoc('doc2', 0, 'content B', 'thailand');
      const doc3 = await createDoc('doc3', 0, 'content C', 'china');

      await store.upsert(doc1);
      await store.upsert(doc2);
      await store.upsert(doc3);

      const queryEmbedding =
        await embeddingClient.generateEmbedding('content A');
      const results = await store.similaritySearch(
        queryEmbedding,
        'china',
        10
      );

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.documentId !== 'doc2')).toBe(true);
    });

    it('should respect topK limit', async () => {
      // Insert 5 documents
      for (let i = 0; i < 5; i++) {
        const doc = await createDoc(`doc${i}`, 0, `content ${i}`);
        await store.upsert(doc);
      }

      const queryEmbedding =
        await embeddingClient.generateEmbedding('content 0');
      const results = await store.similaritySearch(
        queryEmbedding,
        'global',
        2
      );

      expect(results).toHaveLength(2);
    });

    it('should return empty array when no documents match namespace', async () => {
      const doc = await createDoc('doc1', 0, 'test', 'china');
      await store.upsert(doc);

      const queryEmbedding =
        await embeddingClient.generateEmbedding('test');
      const results = await store.similaritySearch(
        queryEmbedding,
        'thailand',
        10
      );

      expect(results).toHaveLength(0);
    });

    it('should return results sorted by score descending', async () => {
      const doc1 = await createDoc('doc1', 0, 'apple');
      const doc2 = await createDoc('doc2', 0, 'banana');
      const doc3 = await createDoc('doc3', 0, 'cherry');

      await store.upsert(doc1);
      await store.upsert(doc2);
      await store.upsert(doc3);

      const queryEmbedding =
        await embeddingClient.generateEmbedding('apple');
      const results = await store.similaritySearch(
        queryEmbedding,
        'global',
        3
      );

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should include metadata in results', async () => {
      const doc = await createDoc('doc1', 0, 'test content', 'global', {
        lawName: '民法典',
        articleNumber: '第一条',
      });
      await store.upsert(doc);

      const queryEmbedding =
        await embeddingClient.generateEmbedding('test content');
      const results = await store.similaritySearch(
        queryEmbedding,
        'global',
        1
      );

      expect(results[0].metadata).toEqual({
        lawName: '民法典',
        articleNumber: '第一条',
      });
    });

    it('should throw error for wrong embedding dimension in query', async () => {
      await expect(
        store.similaritySearch([1, 2, 3], 'global', 5)
      ).rejects.toThrow(`Embedding dimension must be ${EMBEDDING_DIMENSION}`);
    });
  });

  describe('deleteByDocumentId', () => {
    it('should delete all chunks for a document', async () => {
      const doc1 = await createDoc('doc1', 0, 'chunk 0');
      const doc2 = await createDoc('doc1', 1, 'chunk 1');
      const doc3 = await createDoc('doc2', 0, 'other doc');

      await store.upsert(doc1);
      await store.upsert(doc2);
      await store.upsert(doc3);
      expect(store.size()).toBe(3);

      await store.deleteByDocumentId('doc1');
      expect(store.size()).toBe(1);

      const queryEmbedding =
        await embeddingClient.generateEmbedding('chunk 0');
      const results = await store.similaritySearch(
        queryEmbedding,
        'global',
        10
      );
      expect(results).toHaveLength(1);
      expect(results[0].documentId).toBe('doc2');
    });

    it('should handle deleting non-existent document gracefully', async () => {
      await expect(
        store.deleteByDocumentId('nonexistent')
      ).resolves.not.toThrow();
    });
  });
});
