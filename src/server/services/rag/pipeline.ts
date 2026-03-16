/**
 * RAG 检索管线与置信度评分
 * 实现完整 RAG 管线：用户查询 → 嵌入 → pgvector 搜索 → Top-K 结果 → LLM 生成
 * 包含法条引用格式化、置信度评分和降级策略
 */

import type { EmbeddingClient, VectorStoreInterface, RetrievedDocument } from './types';

// ─── Types ──────────────────────────────────────────────────

export interface RAGQuery {
  query: string;
  namespace: string;
  topK?: number; // default 5
  includeConfidence?: boolean; // default true
}

export interface Citation {
  lawName: string;
  articleNumber: string;
  contentSummary: string;
  confidenceScore: number; // 0-100
  needsVerification: boolean; // true if score < 70
}

export interface RAGResult {
  answer: string;
  citations: Citation[];
  isVerified: boolean; // false if degraded mode
  degraded: boolean; // true if RAG was unavailable
  degradedReason?: string;
}

/** LLM generate function signature */
export type LLMGenerateFn = (prompt: string, systemPrompt?: string) => Promise<string>;

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_TOP_K = 5;
const CONFIDENCE_THRESHOLD = 70;
const DEGRADED_NOTICE = '未经知识库验证';

// ─── RAG Pipeline ───────────────────────────────────────────

export class RAGPipeline {
  private embeddingClient: EmbeddingClient;
  private vectorStore: VectorStoreInterface;
  private llmGenerate: LLMGenerateFn;

  constructor(
    embeddingClient: EmbeddingClient,
    vectorStore: VectorStoreInterface,
    llmGenerate: LLMGenerateFn
  ) {
    this.embeddingClient = embeddingClient;
    this.vectorStore = vectorStore;
    this.llmGenerate = llmGenerate;
  }

  /**
   * Full RAG pipeline: embed query → search vectors → format citations → generate answer
   */
  async query(request: RAGQuery): Promise<RAGResult> {
    const topK = request.topK ?? DEFAULT_TOP_K;
    const includeConfidence = request.includeConfidence ?? true;

    // Step 1: Generate embedding for the query
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.embeddingClient.generateEmbedding(request.query);
    } catch (error) {
      // Embedding generation failed → degraded mode
      return this.handleDegradedMode(
        request.query,
        `嵌入生成失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Step 2: Search vector store
    let retrievedDocs: RetrievedDocument[];
    try {
      retrievedDocs = await this.vectorStore.similaritySearch(
        queryEmbedding,
        request.namespace,
        topK
      );
    } catch (error) {
      // Vector search failed → degraded mode
      return this.handleDegradedMode(
        request.query,
        `向量检索失败: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Step 3: Format citations from retrieved documents
    let citations = this.formatCitations(retrievedDocs);

    // Step 4: Score confidence for each citation
    if (includeConfidence) {
      citations = citations.map((citation) => {
        const score = this.getConfidenceScore(citation, retrievedDocs);
        return {
          ...citation,
          confidenceScore: score,
          needsVerification: score < CONFIDENCE_THRESHOLD,
        };
      });
    }

    // Step 5: Generate answer with context
    const context = this.buildContext(retrievedDocs);
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(request.query, context, citations);

    let answer: string;
    try {
      answer = await this.llmGenerate(userPrompt, systemPrompt);
    } catch {
      // LLM generation failed but we have citations — return partial result
      answer = '法律分析生成失败，请参考以下检索到的法条引用。';
    }

    // Append verification warnings for low-confidence citations
    const lowConfCitations = citations.filter((c) => c.needsVerification);
    if (lowConfCitations.length > 0) {
      answer += '\n\n⚠️ 建议人工核实：部分法条引用置信度较低，建议人工核实相关法条的准确性。';
    }

    return {
      answer,
      citations,
      isVerified: true,
      degraded: false,
    };
  }

  /**
   * Extract law name, article number, and content summary from retrieved documents
   */
  formatCitations(documents: RetrievedDocument[]): Citation[] {
    return documents.map((doc) => {
      const metadata = doc.metadata || {};
      const lawName = String(metadata.lawName || '未知法律');
      const articleNumber = String(metadata.articleNumber || '未知条款');
      const contentSummary = doc.content.length > 200
        ? doc.content.substring(0, 200) + '...'
        : doc.content;

      return {
        lawName,
        articleNumber,
        contentSummary,
        confidenceScore: Math.round(doc.score * 100),
        needsVerification: Math.round(doc.score * 100) < CONFIDENCE_THRESHOLD,
      };
    });
  }

  /**
   * Score confidence 0-100 based on retrieval score and content quality
   */
  getConfidenceScore(citation: Citation, retrievedDocs?: RetrievedDocument[]): number {
    let score = 0;

    // Base score from retrieval similarity (0-60 points)
    const matchingDoc = retrievedDocs?.find(
      (d) =>
        (d.metadata?.lawName === citation.lawName || !d.metadata?.lawName) &&
        (d.metadata?.articleNumber === citation.articleNumber || !d.metadata?.articleNumber)
    );
    if (matchingDoc) {
      score += Math.round(matchingDoc.score * 60);
    } else {
      score += citation.confidenceScore > 0 ? Math.round(citation.confidenceScore * 0.6) : 30;
    }

    // Content quality bonus (0-20 points)
    if (citation.lawName && citation.lawName !== '未知法律') {
      score += 10;
    }
    if (citation.articleNumber && citation.articleNumber !== '未知条款') {
      score += 10;
    }

    // Content summary quality (0-20 points)
    if (citation.contentSummary && citation.contentSummary.length > 20) {
      score += 10;
    }
    if (citation.contentSummary && citation.contentSummary.length > 50) {
      score += 10;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Degraded mode: return answer without RAG verification
   */
  handleDegradedMode(query: string, reason?: string): RAGResult {
    const degradedReason = reason || DEGRADED_NOTICE;

    return {
      answer: `⚠️ ${DEGRADED_NOTICE}\n\n由于知识库检索服务暂时不可用，以下回复未经法律知识库验证，仅供参考。请务必咨询专业律师确认。\n\n针对您的问题："${query}"，建议您咨询专业律师获取准确的法律意见。`,
      citations: [],
      isVerified: false,
      degraded: true,
      degradedReason,
    };
  }

  // ─── Private Helpers ────────────────────────────────────────

  private buildContext(documents: RetrievedDocument[]): string {
    if (documents.length === 0) return '';

    return documents
      .map((doc, i) => {
        const meta = doc.metadata || {};
        const lawName = meta.lawName || '未知法律';
        const articleNumber = meta.articleNumber || '';
        const header = articleNumber
          ? `【${lawName} ${articleNumber}】`
          : `【${lawName}】`;
        return `${i + 1}. ${header}\n${doc.content}`;
      })
      .join('\n\n');
  }

  private buildSystemPrompt(): string {
    return `你是一位专业的中泰法律专家。请基于提供的法律条文和知识库内容，为用户提供准确的法律分析。
要求：
1. 引用具体法条时，请标注法律名称和条款编号
2. 分析应当严谨、客观
3. 如果检索到的法条与问题相关性不高，请如实说明
4. 回复使用中文`;
  }

  private buildUserPrompt(query: string, context: string, citations: Citation[]): string {
    let prompt = `用户问题：${query}\n\n`;

    if (context) {
      prompt += `以下是从法律知识库中检索到的相关法条：\n\n${context}\n\n`;
    }

    if (citations.length > 0) {
      prompt += `法条引用摘要：\n`;
      citations.forEach((c, i) => {
        prompt += `${i + 1}. ${c.lawName} ${c.articleNumber}: ${c.contentSummary}\n`;
      });
      prompt += '\n';
    }

    prompt += '请基于以上法律依据，对用户的问题进行专业的法律分析。';
    return prompt;
  }
}
