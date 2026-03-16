/**
 * 法律文档分块器
 * 按法条/条款级别分块，支持中文（第X条）、泰文（มาตรา X）、英文（Article X）
 * 每块 500-1000 tokens，支持块间重叠
 */

/** 文档分块结果 */
export interface DocumentChunk {
  index: number;
  content: string;
  estimatedTokens: number;
}

/** 分块选项 */
export interface ChunkOptions {
  maxTokens?: number;       // 默认 1000
  overlapTokens?: number;   // 默认 50
  language?: 'zh' | 'th' | 'en' | 'auto';
}

/** 知识库文档 */
export interface KnowledgeBaseDocument {
  id: string;
  title: string;
  content: string;
  namespace: string;
  metadata?: Record<string, unknown>;
}

/** 法条分隔正则 - 匹配中文、泰文、英文法条标记 */
const ARTICLE_PATTERNS = [
  /(?=第[一二三四五六七八九十百千零\d]+条)/g,       // 中文：第X条
  /(?=มาตรา\s*\d+)/g,                              // 泰文：มาตรา X
  /(?=Article\s+\d+)/gi,                            // 英文：Article X
  /(?=Section\s+\d+)/gi,                            // 英文：Section X
];

/**
 * 估算文本的 token 数
 * CJK 字符约 2 chars/token，英文/泰文约 4 chars/token
 */
export function estimateTokens(text: string): number {
  let cjkChars = 0;
  let otherChars = 0;

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    // CJK Unified Ideographs + CJK Extension ranges + Thai
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||   // CJK basic
      (code >= 0x3400 && code <= 0x4dbf) ||   // CJK Extension A
      (code >= 0xf900 && code <= 0xfaff)      // CJK Compatibility
    ) {
      cjkChars++;
    } else if (code >= 0x0e00 && code <= 0x0e7f) {
      // Thai characters - roughly 3 chars per token
      otherChars++;
    } else {
      otherChars++;
    }
  }

  return Math.ceil(cjkChars / 2 + otherChars / 4);
}

/**
 * 检测文本主要语言
 */
function detectLanguage(text: string): 'zh' | 'th' | 'en' {
  let cjk = 0;
  let thai = 0;

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x4e00 && code <= 0x9fff) cjk++;
    if (code >= 0x0e00 && code <= 0x0e7f) thai++;
  }

  if (cjk > thai && cjk > 10) return 'zh';
  if (thai > cjk && thai > 10) return 'th';
  return 'en';
}

/**
 * 按法条边界分割文本
 */
function splitByArticles(text: string): string[] {
  // Try each pattern and use the one that produces the most splits
  let bestSplits: string[] = [text];

  for (const pattern of ARTICLE_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const splits = text.split(pattern).filter((s) => s.trim().length > 0);
    if (splits.length > bestSplits.length) {
      bestSplits = splits;
    }
  }

  return bestSplits;
}

/**
 * 将过大的段落按句子边界进一步分割
 */
function splitLargeSegment(segment: string, maxTokens: number): string[] {
  const tokens = estimateTokens(segment);
  if (tokens <= maxTokens) return [segment];

  // Split by sentence boundaries
  const sentences = segment.split(/(?<=[。！？；\n.!?;])\s*/);
  const result: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const combined = current ? current + sentence : sentence;
    if (estimateTokens(combined) > maxTokens && current) {
      result.push(current.trim());
      current = sentence;
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result.length > 0 ? result : [segment];
}

/**
 * 合并过小的段落
 */
function mergeSmallSegments(segments: string[], minTokens: number): string[] {
  if (segments.length <= 1) return segments;

  const result: string[] = [];
  let current = '';

  for (const segment of segments) {
    const combined = current ? current + '\n' + segment : segment;
    if (estimateTokens(combined) >= minTokens || !current) {
      if (current && estimateTokens(current) >= minTokens) {
        result.push(current);
        current = segment;
      } else {
        current = combined;
      }
    } else {
      current = combined;
    }
  }

  if (current.trim()) {
    // If last chunk is too small, merge with previous
    if (result.length > 0 && estimateTokens(current) < minTokens) {
      result[result.length - 1] = result[result.length - 1] + '\n' + current;
    } else {
      result.push(current);
    }
  }

  return result;
}

/**
 * 添加块间重叠
 */
function addOverlap(chunks: string[], overlapTokens: number): string[] {
  if (overlapTokens <= 0 || chunks.length <= 1) return chunks;

  const result: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    let chunk = chunks[i]!;

    // Add overlap from previous chunk's end
    if (i > 0) {
      const prevChunk = chunks[i - 1]!;
      const prevSentences = prevChunk.split(/(?<=[。！？；\n.!?;])\s*/);
      let overlap = '';
      for (let j = prevSentences.length - 1; j >= 0; j--) {
        const candidate = prevSentences[j]! + (overlap ? ' ' + overlap : '');
        if (estimateTokens(candidate) > overlapTokens) break;
        overlap = candidate;
      }
      if (overlap) {
        chunk = overlap + '\n' + chunk;
      }
    }

    result.push(chunk);
  }

  return result;
}

/**
 * 对法律文档进行分块
 * @param text 文档全文
 * @param options 分块选项
 * @returns 分块结果数组
 */
export function chunkDocument(
  text: string,
  options?: ChunkOptions
): DocumentChunk[] {
  const maxTokens = options?.maxTokens ?? 1000;
  const overlapTokens = options?.overlapTokens ?? 50;
  const minTokens = 500;

  if (!text || text.trim().length === 0) {
    return [];
  }

  const trimmed = text.trim();

  // If the entire text is small enough, return as single chunk
  const totalTokens = estimateTokens(trimmed);
  if (totalTokens <= maxTokens) {
    return [
      {
        index: 0,
        content: trimmed,
        estimatedTokens: totalTokens,
      },
    ];
  }

  // Step 1: Split by article boundaries
  let segments = splitByArticles(trimmed);

  // Step 2: Split large segments further
  const splitSegments: string[] = [];
  for (const seg of segments) {
    splitSegments.push(...splitLargeSegment(seg, maxTokens));
  }

  // Step 3: Merge small segments
  segments = mergeSmallSegments(splitSegments, minTokens);

  // Step 4: Add overlap
  const chunksWithOverlap = addOverlap(segments, overlapTokens);

  // Step 5: Build result
  return chunksWithOverlap.map((content, index) => ({
    index,
    content,
    estimatedTokens: estimateTokens(content),
  }));
}
