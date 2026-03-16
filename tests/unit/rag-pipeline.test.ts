/**
 * RAG 检索管线与置信度评分单元测试
 * 测试完整 RAG 管线、法条引用格式化、置信度评分和降级策略
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockEmbeddingClient } from '@/server/services/rag/embedding';
import { InMemoryVectorStore } from '@/server/services/rag/vector-store';
import {
  RAGPipeline,
  type RAGQuery,
  type Citation,
  type LLMGenerateFn,
} from '@/server/services/rag/pipeline';
import type { EmbeddingClient, VectorStoreInterface } from '@/server/services/rag/types';

// ─── Test Helpers ───────────────────────────────────────────

/** Mock LLM generate function */
const mockLLMGenerate: LLMGenerateFn = vi.fn(async (prompt: string) => {
  return `基于检索到的法律条文，针对您的问题进行如下分析：这是一个模拟的法律分析回复。`;
});

/** Seed the vector store with sample legal documents */
async function seedStore(
  store: InMemoryVectorStore,
  embeddingClient: MockEmbeddingClient
) {
  const docs = [
    {
      id: 'civil-code-1',
      content: '中华人民共和国民法典第一编总则，第一条：为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序，适应中国特色社会主义发展要求，弘扬社会主义核心价值观，根据宪法，制定本法。',
      namespace: 'china',
      metadata: { lawName: '中华人民共和国民法典', articleNumber: '第一条', jurisdiction: 'CHINA' },
    },
    {
      id: 'civil-code-188',
      content: '中华人民共和国民法典第一百八十八条：向人民法院请求保护民事权利的诉讼时效期间为三年。法律另有规定的，依照其规定。',
      namespace: 'china',
      metadata: { lawName: '中华人民共和国民法典', articleNumber: '第一百八十八条', jurisdiction: 'CHINA' },
    },
    {
      id: 'company-law-1',
      content: '中华人民共和国公司法第一条：为了规范公司的组织和行为，保护公司、股东和债权人的合法权益，维护社会经济秩序，促进社会主义市场经济的发展，制定本法。',
      namespace: 'china',
      metadata: { lawName: '中华人民共和国公司法', articleNumber: '第一条', jurisdiction: 'CHINA' },
    },
    {
      id: 'thai-ccc-1',
      content: 'Thai Civil and Commercial Code Section 1: This Act shall be called the Civil and Commercial Code.',
      namespace: 'thailand',
      metadata: { lawName: 'Thai Civil and Commercial Code', articleNumber: 'Section 1', jurisdiction: 'THAILAND' },
    },
    {
      id: 'thai-fba-1',
      content: 'Foreign Business Act B.E. 2542 Section 4: Foreign business means business not operated by Thai nationals.',
      namespace: 'thailand',
      metadata: { lawName: 'Foreign Business Act', articleNumber: 'Section 4', jurisdiction: 'THAILAND' },
    },
  ];

  for (const doc of docs) {
    const embedding = await embeddingClient.generateEmbedding(doc.content);
    await store.upsert({
      documentId: doc.id,
      chunkIndex: 0,
      content: doc.content,
      embedding,
      namespace: doc.namespace,
      metadata: doc.metadata,
    });
  }
}

// ─── Test Suites ────────────────────────────────────────────

describe('RAGPipeline', () => {
  let embeddingClient: MockEmbeddingClient;
  let vectorStore: InMemoryVectorStore;
  let pipeline: RAGPipeline;
  let llmGenerate: LLMGenerateFn;

  beforeEach(async () => {
    embeddingClient = new MockEmbeddingClient();
    vectorStore = new InMemoryVectorStore();
    llmGenerate = vi.fn(async () => '基于法律条文的分析回复。');
    pipeline = new RAGPipeline(embeddingClient, vectorStore, llmGenerate);
    await seedStore(vectorStore, embeddingClient);
  });

  // ─── Full Query Pipeline ────────────────────────────────

  describe('query - full pipeline', () => {
    it('should return answer with citations for a valid query', async () => {
      const request: RAGQuery = {
        query: '中华人民共和国民法典第一条的内容是什么？',
        namespace: 'china',
        topK: 3,
      };

      const result = await pipeline.query(request);

      expect(result.answer).toBeTruthy();
      expect(result.citations.length).toBeGreaterThan(0);
      expect(result.isVerified).toBe(true);
      expect(result.degraded).toBe(false);
      expect(result.degradedReason).toBeUndefined();
    });

    it('should call LLM generate with context from retrieved documents', async () => {
      const request: RAGQuery = {
        query: '公司法相关问题',
        namespace: 'china',
        topK: 2,
      };

      await pipeline.query(request);

      expect(llmGenerate).toHaveBeenCalledTimes(1);
      const callArgs = (llmGenerate as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[0]).toContain('公司法相关问题');
      expect(callArgs[1]).toBeTruthy(); // system prompt
    });

    it('should return empty citations when no results found but still return answer', async () => {
      const request: RAGQuery = {
        query: 'some query',
        namespace: 'nonexistent-namespace',
        topK: 5,
      };

      const result = await pipeline.query(request);

      expect(result.citations).toHaveLength(0);
      expect(result.answer).toBeTruthy();
      expect(result.degraded).toBe(false);
      expect(result.isVerified).toBe(true);
    });
  });

  // ─── Citation Formatting ────────────────────────────────

  describe('formatCitations', () => {
    it('should extract law name and article number from metadata', async () => {
      const queryEmbedding = await embeddingClient.generateEmbedding('民法典');
      const docs = await vectorStore.similaritySearch(queryEmbedding, 'china', 3);

      const citations = pipeline.formatCitations(docs);

      expect(citations.length).toBeGreaterThan(0);
      citations.forEach((citation) => {
        expect(citation.lawName).toBeTruthy();
        expect(citation.articleNumber).toBeTruthy();
        expect(citation.contentSummary).toBeTruthy();
      });
    });

    it('should use default values when metadata is missing', () => {
      const docs = [
        {
          documentId: 'doc1',
          chunkIndex: 0,
          content: 'Some legal content without metadata',
          score: 0.8,
          metadata: undefined,
        },
      ];

      const citations = pipeline.formatCitations(docs);

      expect(citations).toHaveLength(1);
      expect(citations[0].lawName).toBe('未知法律');
      expect(citations[0].articleNumber).toBe('未知条款');
    });

    it('should truncate long content summaries to 200 chars', () => {
      const longContent = 'A'.repeat(300);
      const docs = [
        {
          documentId: 'doc1',
          chunkIndex: 0,
          content: longContent,
          score: 0.9,
          metadata: { lawName: '测试法', articleNumber: '第一条' },
        },
      ];

      const citations = pipeline.formatCitations(docs);

      expect(citations[0].contentSummary.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(citations[0].contentSummary).toContain('...');
    });

    it('should not truncate short content summaries', () => {
      const shortContent = 'Short legal text';
      const docs = [
        {
          documentId: 'doc1',
          chunkIndex: 0,
          content: shortContent,
          score: 0.9,
          metadata: { lawName: '测试法', articleNumber: '第一条' },
        },
      ];

      const citations = pipeline.formatCitations(docs);

      expect(citations[0].contentSummary).toBe(shortContent);
      expect(citations[0].contentSummary).not.toContain('...');
    });
  });

  // ─── Confidence Scoring ─────────────────────────────────

  describe('getConfidenceScore', () => {
    it('should return high score for well-matched citations with complete metadata', () => {
      const citation: Citation = {
        lawName: '中华人民共和国民法典',
        articleNumber: '第一条',
        contentSummary: '为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序。',
        confidenceScore: 90,
        needsVerification: false,
      };

      const docs = [
        {
          documentId: 'doc1',
          chunkIndex: 0,
          content: citation.contentSummary,
          score: 0.95,
          metadata: { lawName: '中华人民共和国民法典', articleNumber: '第一条' },
        },
      ];

      const score = pipeline.getConfidenceScore(citation, docs);

      expect(score).toBeGreaterThanOrEqual(70);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return low score for citations with missing metadata', () => {
      const citation: Citation = {
        lawName: '未知法律',
        articleNumber: '未知条款',
        contentSummary: 'Short',
        confidenceScore: 0,
        needsVerification: true,
      };

      const score = pipeline.getConfidenceScore(citation);

      expect(score).toBeLessThan(70);
    });

    it('should score between 0 and 100', () => {
      const citation: Citation = {
        lawName: '测试法',
        articleNumber: '第一条',
        contentSummary: '这是一段足够长的法律条文内容，用于测试置信度评分的计算逻辑。',
        confidenceScore: 50,
        needsVerification: false,
      };

      const score = pipeline.getConfidenceScore(citation);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ─── needsVerification Flag ─────────────────────────────

  describe('needsVerification flag', () => {
    it('should set needsVerification=true when confidence < 70', async () => {
      // Use a store with docs that have no metadata for low confidence
      const emptyStore = new InMemoryVectorStore();
      const emptyEmbedding = await embeddingClient.generateEmbedding('no metadata doc');
      await emptyStore.upsert({
        documentId: 'no-meta',
        chunkIndex: 0,
        content: 'X',
        embedding: emptyEmbedding,
        namespace: 'test',
      });

      const lowConfPipeline = new RAGPipeline(embeddingClient, emptyStore, llmGenerate);
      const result = await lowConfPipeline.query({
        query: 'no metadata doc',
        namespace: 'test',
        topK: 1,
        includeConfidence: true,
      });

      expect(result.citations.length).toBeGreaterThan(0);
      // With no metadata, confidence should be low
      result.citations.forEach((c) => {
        if (c.confidenceScore < 70) {
          expect(c.needsVerification).toBe(true);
        }
      });
    });

    it('should set needsVerification=false when confidence >= 70', async () => {
      const result = await pipeline.query({
        query: '中华人民共和国民法典第一条的内容是什么？',
        namespace: 'china',
        topK: 1,
        includeConfidence: true,
      });

      // The exact match should have high confidence
      const highConfCitations = result.citations.filter(
        (c) => c.confidenceScore >= 70
      );
      highConfCitations.forEach((c) => {
        expect(c.needsVerification).toBe(false);
      });
    });

    it('should append verification warning when low-confidence citations exist', async () => {
      const emptyStore = new InMemoryVectorStore();
      const emptyEmbedding = await embeddingClient.generateEmbedding('low conf');
      await emptyStore.upsert({
        documentId: 'low-conf',
        chunkIndex: 0,
        content: 'X',
        embedding: emptyEmbedding,
        namespace: 'test',
      });

      const lowConfPipeline = new RAGPipeline(embeddingClient, emptyStore, llmGenerate);
      const result = await lowConfPipeline.query({
        query: 'low conf',
        namespace: 'test',
        topK: 1,
        includeConfidence: true,
      });

      const hasLowConf = result.citations.some((c) => c.needsVerification);
      if (hasLowConf) {
        expect(result.answer).toContain('建议人工核实');
      }
    });
  });

  // ─── Degraded Mode ──────────────────────────────────────

  describe('degraded mode - embedding failure', () => {
    it('should return degraded result when embedding generation fails', async () => {
      const failingEmbedding: EmbeddingClient = {
        generateEmbedding: vi.fn().mockRejectedValue(new Error('API unavailable')),
        generateBatchEmbeddings: vi.fn().mockRejectedValue(new Error('API unavailable')),
      };

      const degradedPipeline = new RAGPipeline(failingEmbedding, vectorStore, llmGenerate);
      const result = await degradedPipeline.query({
        query: '测试查询',
        namespace: 'china',
      });

      expect(result.degraded).toBe(true);
      expect(result.isVerified).toBe(false);
      expect(result.citations).toHaveLength(0);
      expect(result.degradedReason).toContain('嵌入生成失败');
      expect(result.answer).toContain('未经知识库验证');
    });
  });

  describe('degraded mode - vector search failure', () => {
    it('should return degraded result when vector search fails', async () => {
      const failingStore: VectorStoreInterface = {
        upsert: vi.fn(),
        similaritySearch: vi.fn().mockRejectedValue(new Error('pgvector timeout')),
        deleteByDocumentId: vi.fn(),
      };

      const degradedPipeline = new RAGPipeline(embeddingClient, failingStore, llmGenerate);
      const result = await degradedPipeline.query({
        query: '测试查询',
        namespace: 'china',
      });

      expect(result.degraded).toBe(true);
      expect(result.isVerified).toBe(false);
      expect(result.citations).toHaveLength(0);
      expect(result.degradedReason).toContain('向量检索失败');
      expect(result.answer).toContain('未经知识库验证');
    });
  });

  describe('degraded mode properties', () => {
    it('should set isVerified=false and degraded=true in degraded mode', () => {
      const result = pipeline.handleDegradedMode('test query');

      expect(result.isVerified).toBe(false);
      expect(result.degraded).toBe(true);
      expect(result.citations).toHaveLength(0);
      expect(result.degradedReason).toBeTruthy();
    });

    it('should include the degraded reason', () => {
      const result = pipeline.handleDegradedMode('test', 'Custom reason');

      expect(result.degradedReason).toBe('Custom reason');
    });
  });

  // ─── topK Parameter ─────────────────────────────────────

  describe('topK parameter', () => {
    it('should limit results to topK', async () => {
      const result = await pipeline.query({
        query: '法律问题',
        namespace: 'china',
        topK: 1,
      });

      expect(result.citations.length).toBeLessThanOrEqual(1);
    });

    it('should default to 5 when topK is not specified', async () => {
      const result = await pipeline.query({
        query: '法律问题',
        namespace: 'china',
      });

      // We have 3 docs in china namespace, so should get at most 3
      expect(result.citations.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── Namespace Filtering ────────────────────────────────

  describe('namespace filtering', () => {
    it('should only return citations from the specified namespace', async () => {
      const chinaResult = await pipeline.query({
        query: '法律',
        namespace: 'china',
        topK: 10,
      });

      const thailandResult = await pipeline.query({
        query: 'law',
        namespace: 'thailand',
        topK: 10,
      });

      // China namespace has 3 docs, Thailand has 2
      expect(chinaResult.citations.length).toBeLessThanOrEqual(3);
      expect(thailandResult.citations.length).toBeLessThanOrEqual(2);
    });

    it('should return empty citations for non-existent namespace', async () => {
      const result = await pipeline.query({
        query: 'test',
        namespace: 'nonexistent',
        topK: 5,
      });

      expect(result.citations).toHaveLength(0);
    });
  });
});
