/**
 * 知识库管理器
 * 负责文档索引、更新、删除和全量重建
 * 流程：文档 → 分块 → 嵌入 → 写入向量存储
 */

import { EmbeddingClient, VectorStoreInterface, VectorDocument } from './types';
import {
  chunkDocument,
  ChunkOptions,
  KnowledgeBaseDocument,
} from './chunker';

export { KnowledgeBaseDocument } from './chunker';

export class KnowledgeBaseManager {
  private embeddingClient: EmbeddingClient;
  private vectorStore: VectorStoreInterface;
  private chunkOptions: ChunkOptions;
  private documentIndex: Map<string, number> = new Map(); // documentId → chunk count

  constructor(
    embeddingClient: EmbeddingClient,
    vectorStore: VectorStoreInterface,
    chunkOptions?: ChunkOptions
  ) {
    this.embeddingClient = embeddingClient;
    this.vectorStore = vectorStore;
    this.chunkOptions = chunkOptions ?? {};
  }

  /**
   * 索引文档：分块 → 生成嵌入 → 写入向量存储
   */
  async indexDocument(doc: KnowledgeBaseDocument): Promise<void> {
    const chunks = chunkDocument(doc.content, this.chunkOptions);

    if (chunks.length === 0) return;

    // Generate embeddings for all chunks in batch
    const texts = chunks.map((c) => c.content);
    const embeddings = await this.embeddingClient.generateBatchEmbeddings(texts);

    // Write each chunk to vector store
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const vectorDoc: VectorDocument = {
        documentId: doc.id,
        chunkIndex: chunk.index,
        content: chunk.content,
        embedding: embeddings[i]!,
        namespace: doc.namespace,
        metadata: {
          ...doc.metadata,
          title: doc.title,
          chunkIndex: chunk.index,
          totalChunks: chunks.length,
        },
      };
      await this.vectorStore.upsert(vectorDoc);
    }

    this.documentIndex.set(doc.id, chunks.length);
  }

  /**
   * 更新文档：删除旧向量 → 重新分块和嵌入
   */
  async updateDocument(
    documentId: string,
    update: Partial<KnowledgeBaseDocument>
  ): Promise<void> {
    // Delete old vectors
    await this.vectorStore.deleteByDocumentId(documentId);
    this.documentIndex.delete(documentId);

    // If content is provided, re-index
    if (update.content) {
      const doc: KnowledgeBaseDocument = {
        id: documentId,
        title: update.title ?? documentId,
        content: update.content,
        namespace: update.namespace ?? 'global',
        metadata: update.metadata,
      };
      await this.indexDocument(doc);
    }
  }

  /**
   * 删除文档的所有向量
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.vectorStore.deleteByDocumentId(documentId);
    this.documentIndex.delete(documentId);
  }

  /**
   * 全量重建索引：清空所有文档 → 重新索引
   */
  async reindexAll(documents: KnowledgeBaseDocument[]): Promise<void> {
    // Delete all existing documents
    const existingIds = Array.from(this.documentIndex.keys());
    for (const id of existingIds) {
      await this.vectorStore.deleteByDocumentId(id);
    }
    this.documentIndex.clear();

    // Re-index all documents
    for (const doc of documents) {
      await this.indexDocument(doc);
    }
  }

  /**
   * 获取已索引的文档数量
   */
  getDocumentCount(): number {
    return this.documentIndex.size;
  }

  /**
   * 获取指定文档的分块数量
   */
  getChunkCount(documentId: string): number {
    return this.documentIndex.get(documentId) ?? 0;
  }
}
