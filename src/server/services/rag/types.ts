/**
 * RAG (Retrieval-Augmented Generation) 系统类型定义
 * 用于向量存储、嵌入服务和知识检索
 */

/** 向量文档 - 用于存储到向量数据库 */
export interface VectorDocument {
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[];
  namespace: string;
  metadata?: Record<string, unknown>;
}

/** 检索到的文档 - 向量搜索结果 */
export interface RetrievedDocument {
  documentId: string;
  chunkIndex: number;
  content: string;
  score: number; // 余弦相似度分数 0-1
  metadata?: Record<string, unknown>;
}

/** 嵌入客户端接口 - 用于生成文本向量 */
export interface EmbeddingClient {
  /** 生成单个文本的嵌入向量 */
  generateEmbedding(text: string): Promise<number[]>;
  /** 批量生成文本的嵌入向量 */
  generateBatchEmbeddings(texts: string[]): Promise<number[][]>;
}

/** 向量存储接口 - 用于存储和检索向量 */
export interface VectorStoreInterface {
  /** 插入或更新向量文档 */
  upsert(doc: VectorDocument): Promise<void>;
  /** 基于余弦相似度搜索 */
  similaritySearch(
    embedding: number[],
    namespace: string,
    topK: number
  ): Promise<RetrievedDocument[]>;
  /** 按文档 ID 删除所有相关向量 */
  deleteByDocumentId(documentId: string): Promise<void>;
}

/** 嵌入向量维度 (text-embedding-3-small) */
export const EMBEDDING_DIMENSION = 1536;

/** 默认命名空间 */
export const DEFAULT_NAMESPACE = 'global';
