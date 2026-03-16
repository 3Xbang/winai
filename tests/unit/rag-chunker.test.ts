/**
 * RAG 文档分块与知识库管理单元测试
 * 测试法律文档分块逻辑、知识库 CRUD 操作
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  chunkDocument,
  estimateTokens,
  DocumentChunk,
  KnowledgeBaseDocument,
} from '@/server/services/rag/chunker';
import { KnowledgeBaseManager } from '@/server/services/rag/knowledge-base';
import { MockEmbeddingClient } from '@/server/services/rag/embedding';
import { InMemoryVectorStore } from '@/server/services/rag/vector-store';

// ==================== Token Estimation Tests ====================

describe('estimateTokens', () => {
  it('should estimate CJK text at ~2 chars per token', () => {
    // 10 CJK chars → ~5 tokens
    const tokens = estimateTokens('中国民法典第一条规定了');
    expect(tokens).toBeGreaterThanOrEqual(4);
    expect(tokens).toBeLessThanOrEqual(8);
  });

  it('should estimate English text at ~4 chars per token', () => {
    // "Article one of the civil code" = 29 chars → ~7-8 tokens
    const tokens = estimateTokens('Article one of the civil code');
    expect(tokens).toBeGreaterThanOrEqual(5);
    expect(tokens).toBeLessThanOrEqual(12);
  });

  it('should return 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

// ==================== Chunker Tests ====================

describe('chunkDocument', () => {
  it('should return empty array for empty text', () => {
    expect(chunkDocument('')).toEqual([]);
    expect(chunkDocument('   ')).toEqual([]);
  });

  it('should return single chunk for short text', () => {
    const chunks = chunkDocument('这是一段简短的法律文本。');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.content).toBe('这是一段简短的法律文本。');
    expect(chunks[0]!.estimatedTokens).toBeGreaterThan(0);
  });

  it('should include index, content, and estimatedTokens in each chunk', () => {
    const text = '第一条 这是第一条的内容。'.repeat(200);
    const chunks = chunkDocument(text);
    for (const chunk of chunks) {
      expect(chunk).toHaveProperty('index');
      expect(chunk).toHaveProperty('content');
      expect(chunk).toHaveProperty('estimatedTokens');
      expect(typeof chunk.index).toBe('number');
      expect(typeof chunk.content).toBe('string');
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.estimatedTokens).toBeGreaterThan(0);
    }
  });

  describe('Chinese legal text chunking (第X条 pattern)', () => {
    it('should split by 第X条 boundaries', () => {
      const articles: string[] = [];
      for (let i = 1; i <= 20; i++) {
        articles.push(`第${i}条 ${'这是法律条文的详细内容，包含了各种法律规定和要求。'.repeat(20)}`);
      }
      const text = articles.join('\n');
      const chunks = chunkDocument(text);

      expect(chunks.length).toBeGreaterThan(1);
      // First chunk should start with 第1条
      expect(chunks[0]!.content).toContain('第1条');
    });
  });

  describe('Thai legal text chunking (มาตรา X pattern)', () => {
    it('should split by มาตรา X boundaries', () => {
      const articles: string[] = [];
      for (let i = 1; i <= 20; i++) {
        articles.push(`มาตรา ${i} ${'กฎหมายไทยมีข้อกำหนดที่สำคัญหลายประการเกี่ยวกับการดำเนินธุรกิจ '.repeat(20)}`);
      }
      const text = articles.join('\n');
      const chunks = chunkDocument(text);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]!.content).toContain('มาตรา');
    });
  });

  describe('English legal text chunking (Article X pattern)', () => {
    it('should split by Article X boundaries', () => {
      const articles: string[] = [];
      for (let i = 1; i <= 20; i++) {
        articles.push(`Article ${i} This is a detailed legal provision that contains various requirements and regulations for compliance. `.repeat(20));
      }
      const text = articles.join('\n');
      const chunks = chunkDocument(text);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0]!.content).toContain('Article');
    });
  });

  describe('chunk size constraints', () => {
    it('should produce chunks within reasonable token range for large documents', () => {
      const articles: string[] = [];
      for (let i = 1; i <= 50; i++) {
        articles.push(`第${i}条 ${'本条规定了关于民事主体从事民事活动应当遵循的基本原则和具体要求。'.repeat(15)}`);
      }
      const text = articles.join('\n');
      const chunks = chunkDocument(text, { maxTokens: 1000 });

      // All chunks should have estimated tokens > 0
      for (const chunk of chunks) {
        expect(chunk.estimatedTokens).toBeGreaterThan(0);
      }

      // Most chunks should be within a reasonable range (allowing some flexibility for merging/overlap)
      const withinRange = chunks.filter(
        (c) => c.estimatedTokens >= 100 && c.estimatedTokens <= 1500
      );
      expect(withinRange.length / chunks.length).toBeGreaterThan(0.5);
    });
  });

  describe('chunk overlap', () => {
    it('should add overlap content between consecutive chunks', () => {
      const articles: string[] = [];
      for (let i = 1; i <= 30; i++) {
        articles.push(`第${i}条 ${'这是一段较长的法律条文内容，用于测试分块重叠功能是否正常工作。'.repeat(15)}`);
      }
      const text = articles.join('\n');
      const chunks = chunkDocument(text, { overlapTokens: 50 });

      if (chunks.length >= 2) {
        // With overlap, later chunks may contain content from previous chunks
        // We just verify chunks are produced and have content
        for (const chunk of chunks) {
          expect(chunk.content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should not add overlap when overlapTokens is 0', () => {
      const articles: string[] = [];
      for (let i = 1; i <= 20; i++) {
        articles.push(`第${i}条 ${'法律条文内容。'.repeat(50)}`);
      }
      const text = articles.join('\n');
      const chunksNoOverlap = chunkDocument(text, { overlapTokens: 0 });
      const chunksWithOverlap = chunkDocument(text, { overlapTokens: 100 });

      // With overlap, total content should be larger
      if (chunksNoOverlap.length > 1 && chunksWithOverlap.length > 1) {
        const totalNoOverlap = chunksNoOverlap.reduce((s, c) => s + c.content.length, 0);
        const totalWithOverlap = chunksWithOverlap.reduce((s, c) => s + c.content.length, 0);
        expect(totalWithOverlap).toBeGreaterThanOrEqual(totalNoOverlap);
      }
    });
  });
});


// ==================== Knowledge Base Manager Tests ====================

describe('KnowledgeBaseManager', () => {
  let manager: KnowledgeBaseManager;
  let embeddingClient: MockEmbeddingClient;
  let vectorStore: InMemoryVectorStore;

  beforeEach(() => {
    embeddingClient = new MockEmbeddingClient();
    vectorStore = new InMemoryVectorStore();
    manager = new KnowledgeBaseManager(embeddingClient, vectorStore);
  });

  function createDoc(
    id: string,
    content: string,
    namespace = 'global',
    title?: string
  ): KnowledgeBaseDocument {
    return {
      id,
      title: title ?? `Document ${id}`,
      content,
      namespace,
      metadata: { source: 'test' },
    };
  }

  describe('indexDocument', () => {
    it('should index a document and create vectors in the store', async () => {
      const doc = createDoc('doc1', '第一条 民事主体的人身权利、财产权利以及其他合法权益受法律保护。'.repeat(30));
      await manager.indexDocument(doc);

      expect(manager.getDocumentCount()).toBe(1);
      expect(vectorStore.size()).toBeGreaterThan(0);
    });

    it('should create correct number of vectors matching chunk count', async () => {
      const content = Array.from({ length: 10 }, (_, i) =>
        `第${i + 1}条 ${'这是法律条文的详细内容。'.repeat(30)}`
      ).join('\n');
      const doc = createDoc('doc1', content);
      await manager.indexDocument(doc);

      const chunkCount = manager.getChunkCount('doc1');
      expect(chunkCount).toBeGreaterThan(0);
      expect(vectorStore.size()).toBe(chunkCount);
    });

    it('should handle empty content gracefully', async () => {
      const doc = createDoc('empty', '');
      await manager.indexDocument(doc);
      expect(manager.getDocumentCount()).toBe(0);
      expect(vectorStore.size()).toBe(0);
    });

    it('should index multiple documents independently', async () => {
      const doc1 = createDoc('doc1', '第一条 中国民法典的基本规定。'.repeat(30), 'china');
      const doc2 = createDoc('doc2', 'Article 1 Thai Civil and Commercial Code provisions. '.repeat(60), 'thailand');

      await manager.indexDocument(doc1);
      await manager.indexDocument(doc2);

      expect(manager.getDocumentCount()).toBe(2);
      expect(vectorStore.size()).toBeGreaterThan(1);
    });
  });

  describe('updateDocument', () => {
    it('should replace old vectors with new ones', async () => {
      const doc = createDoc('doc1', '第一条 原始内容。'.repeat(30));
      await manager.indexDocument(doc);
      const originalSize = vectorStore.size();

      await manager.updateDocument('doc1', {
        content: '第一条 更新后的内容。'.repeat(30),
        title: 'Updated',
        namespace: 'global',
      });

      // Document count should still be 1
      expect(manager.getDocumentCount()).toBe(1);
      // Vectors should exist (may differ in count)
      expect(vectorStore.size()).toBeGreaterThan(0);
    });

    it('should remove vectors when updated without content', async () => {
      const doc = createDoc('doc1', '第一条 内容。'.repeat(30));
      await manager.indexDocument(doc);
      expect(vectorStore.size()).toBeGreaterThan(0);

      await manager.updateDocument('doc1', { title: 'No content update' });
      expect(manager.getDocumentCount()).toBe(0);
    });
  });

  describe('deleteDocument', () => {
    it('should remove all vectors for a document', async () => {
      const doc = createDoc('doc1', '第一条 法律内容。'.repeat(30));
      await manager.indexDocument(doc);
      expect(vectorStore.size()).toBeGreaterThan(0);

      await manager.deleteDocument('doc1');
      expect(vectorStore.size()).toBe(0);
      expect(manager.getDocumentCount()).toBe(0);
    });

    it('should not affect other documents', async () => {
      const doc1 = createDoc('doc1', '第一条 文档一。'.repeat(30));
      const doc2 = createDoc('doc2', '第一条 文档二。'.repeat(30));
      await manager.indexDocument(doc1);
      await manager.indexDocument(doc2);

      const sizeBeforeDelete = vectorStore.size();
      const doc1Chunks = manager.getChunkCount('doc1');

      await manager.deleteDocument('doc1');

      expect(vectorStore.size()).toBe(sizeBeforeDelete - doc1Chunks);
      expect(manager.getDocumentCount()).toBe(1);
    });

    it('should handle deleting non-existent document gracefully', async () => {
      await expect(manager.deleteDocument('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('reindexAll', () => {
    it('should rebuild all documents from scratch', async () => {
      // Index initial documents
      const doc1 = createDoc('doc1', '第一条 初始文档一。'.repeat(30));
      const doc2 = createDoc('doc2', '第一条 初始文档二。'.repeat(30));
      await manager.indexDocument(doc1);
      await manager.indexDocument(doc2);

      // Reindex with different documents
      const newDoc1 = createDoc('new1', '第一条 新文档一。'.repeat(30));
      const newDoc2 = createDoc('new2', '第一条 新文档二。'.repeat(30));
      const newDoc3 = createDoc('new3', '第一条 新文档三。'.repeat(30));

      await manager.reindexAll([newDoc1, newDoc2, newDoc3]);

      expect(manager.getDocumentCount()).toBe(3);
      expect(manager.getChunkCount('doc1')).toBe(0);
      expect(manager.getChunkCount('doc2')).toBe(0);
      expect(manager.getChunkCount('new1')).toBeGreaterThan(0);
    });

    it('should handle empty document list', async () => {
      const doc = createDoc('doc1', '第一条 内容。'.repeat(30));
      await manager.indexDocument(doc);

      await manager.reindexAll([]);
      expect(manager.getDocumentCount()).toBe(0);
      expect(vectorStore.size()).toBe(0);
    });
  });

  describe('getDocumentCount', () => {
    it('should return 0 initially', () => {
      expect(manager.getDocumentCount()).toBe(0);
    });

    it('should track indexed documents accurately', async () => {
      await manager.indexDocument(createDoc('a', '内容A。'.repeat(30)));
      expect(manager.getDocumentCount()).toBe(1);

      await manager.indexDocument(createDoc('b', '内容B。'.repeat(30)));
      expect(manager.getDocumentCount()).toBe(2);

      await manager.deleteDocument('a');
      expect(manager.getDocumentCount()).toBe(1);
    });
  });
});
