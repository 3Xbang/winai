/**
 * 向量存储服务 - 封装 pgvector 操作
 * 支持余弦相似度搜索和 IVFFlat 索引
 */

import {
  VectorDocument,
  RetrievedDocument,
  VectorStoreInterface,
  EMBEDDING_DIMENSION,
} from './types';

/**
 * 计算两个向量的余弦相似度
 * @returns 相似度分数 [-1, 1]，1 表示完全相同
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Vector dimensions must match: ${a.length} vs ${b.length}`
    );
  }
  if (a.length === 0) {
    throw new Error('Vectors cannot be empty');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) {
    return 0;
  }

  return dotProduct / magnitude;
}

/**
 * pgvector 向量存储 - 使用 PostgreSQL pgvector 扩展
 * 通过 Prisma 的 $queryRawUnsafe 执行原生 SQL
 */
export class PgVectorStore implements VectorStoreInterface {
  private prisma: any; // PrismaClient

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  async upsert(doc: VectorDocument): Promise<void> {
    if (doc.embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension must be ${EMBEDDING_DIMENSION}, got ${doc.embedding.length}`
      );
    }

    const vectorStr = `[${doc.embedding.join(',')}]`;

    // Upsert: delete existing chunk then insert
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "VectorEmbedding" WHERE "documentId" = $1 AND "chunkIndex" = $2`,
      doc.documentId,
      doc.chunkIndex
    );

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "VectorEmbedding" ("id", "documentId", "chunkIndex", "chunkContent", "embedding", "namespace", "metadata", "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4::vector, $5, $6::jsonb, NOW())`,
      doc.documentId,
      doc.chunkIndex,
      doc.content,
      vectorStr,
      doc.namespace,
      doc.metadata ? JSON.stringify(doc.metadata) : null
    );
  }

  async similaritySearch(
    embedding: number[],
    namespace: string,
    topK: number
  ): Promise<RetrievedDocument[]> {
    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension must be ${EMBEDDING_DIMENSION}, got ${embedding.length}`
      );
    }

    const vectorStr = `[${embedding.join(',')}]`;

    const results = await this.prisma.$queryRawUnsafe(
      `SELECT "documentId", "chunkIndex", "chunkContent" as content, "metadata",
              1 - ("embedding" <=> $1::vector) AS score
       FROM "VectorEmbedding"
       WHERE "namespace" = $2
       ORDER BY "embedding" <=> $1::vector
       LIMIT $3`,
      vectorStr,
      namespace,
      topK
    );

    return results.map((row: any) => ({
      documentId: row.documentId,
      chunkIndex: row.chunkIndex,
      content: row.content,
      score: Number(row.score),
      metadata: row.metadata || undefined,
    }));
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "VectorEmbedding" WHERE "documentId" = $1`,
      documentId
    );
  }
}


/**
 * 内存向量存储 - 用于测试，无需 pgvector 依赖
 * 使用内存中的 Map 存储向量，支持余弦相似度搜索
 */
export class InMemoryVectorStore implements VectorStoreInterface {
  private store: Map<string, VectorDocument> = new Map();

  /** 生成存储键 */
  private getKey(documentId: string, chunkIndex: number): string {
    return `${documentId}:${chunkIndex}`;
  }

  async upsert(doc: VectorDocument): Promise<void> {
    if (doc.embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension must be ${EMBEDDING_DIMENSION}, got ${doc.embedding.length}`
      );
    }
    const key = this.getKey(doc.documentId, doc.chunkIndex);
    this.store.set(key, { ...doc });
  }

  async similaritySearch(
    embedding: number[],
    namespace: string,
    topK: number
  ): Promise<RetrievedDocument[]> {
    if (embedding.length !== EMBEDDING_DIMENSION) {
      throw new Error(
        `Embedding dimension must be ${EMBEDDING_DIMENSION}, got ${embedding.length}`
      );
    }

    const results: RetrievedDocument[] = [];

    for (const doc of this.store.values()) {
      if (doc.namespace !== namespace) {
        continue;
      }

      const score = cosineSimilarity(embedding, doc.embedding);
      results.push({
        documentId: doc.documentId,
        chunkIndex: doc.chunkIndex,
        content: doc.content,
        score,
        metadata: doc.metadata,
      });
    }

    // Sort by score descending and limit to topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    const keysToDelete: string[] = [];
    for (const [key, doc] of this.store.entries()) {
      if (doc.documentId === documentId) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }

  /** 获取存储中的文档数量（测试辅助） */
  size(): number {
    return this.store.size;
  }

  /** 清空存储（测试辅助） */
  clear(): void {
    this.store.clear();
  }
}

/**
 * pgvector 扩展和索引的 SQL 配置
 * 用于数据库初始化时执行
 */
export const PGVECTOR_SETUP_SQL = `
-- 启用 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 向量嵌入表索引（IVFFlat 索引，适合中等规模数据）
CREATE INDEX IF NOT EXISTS idx_vector_embedding_ivfflat
  ON "VectorEmbedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 按命名空间分区查询优化
CREATE INDEX IF NOT EXISTS idx_embedding_namespace
  ON "VectorEmbedding" (namespace);
`;
