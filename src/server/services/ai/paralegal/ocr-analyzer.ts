/**
 * OCR Analyzer — AWS Textract + LLM NLP analysis pipeline
 * Extracts text from documents via OCR, then analyzes with LLM for legal insights.
 * Requirements: 22.4
 */

import { TextractClient, DetectDocumentTextCommand } from '@aws-sdk/client-textract';
import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface OCRAnalysisResult {
  extractedText: string;
  keyFacts: string[];
  parties: string[];
  amounts: string[];
  legalReferences: string[];
  documentType: string;
  confidence: number; // 0-1
}

// ─── System Prompt ──────────────────────────────────────────

export const OCR_ANALYSIS_PROMPT = `你是一位资深法律文档分析专家。请对以下 OCR 识别的文档文本进行 NLP 分析，提取关键法律信息。

请以 JSON 对象格式输出以下字段：
- "keyFacts": 关键事实数组（提取文档中的重要事实陈述）
- "parties": 当事人信息数组（提取所有涉及的个人或组织名称）
- "amounts": 金额数据数组（提取所有涉及的金额，包含币种和上下文）
- "legalReferences": 法律条款引用数组（提取所有引用的法律、法规、条款编号）
- "documentType": 文档类型（如"合同"、"判决书"、"起诉状"、"律师函"、"发票"等）
- "confidence": 分析置信度（0-1之间的数值，基于文本质量和完整性评估）

仅输出 JSON 对象，不要输出其他内容。

Analyze the OCR-extracted text and extract key legal information including facts, parties, amounts, legal references, document type, and confidence score.`;

// ─── Textract Client ────────────────────────────────────────

function createTextractClient(): TextractClient {
  return new TextractClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
  });
}

// ─── OCR Text Extraction ────────────────────────────────────

/**
 * Extract text from a document stored in S3 using AWS Textract.
 */
async function extractTextFromDocument(fileKey: string): Promise<string> {
  const client = createTextractClient();

  const command = new DetectDocumentTextCommand({
    Document: {
      S3Object: {
        Bucket: process.env.AWS_S3_BUCKET || 'legal-documents',
        Name: fileKey,
      },
    },
  });

  const response = await client.send(command);

  if (!response.Blocks) {
    return '';
  }

  // Concatenate all LINE blocks to form the extracted text
  const lines = response.Blocks
    .filter((block) => block.BlockType === 'LINE')
    .map((block) => block.Text || '')
    .filter(Boolean);

  return lines.join('\n');
}

// ─── LLM NLP Analysis ──────────────────────────────────────

/**
 * Analyze extracted text using LLM for NLP insights.
 * Exported for independent testing.
 */
export async function analyzeText(
  text: string,
): Promise<Omit<OCRAnalysisResult, 'extractedText'>> {
  const gateway = getLLMGateway();

  const messages: LLMMessage[] = [
    { role: 'system', content: OCR_ANALYSIS_PROMPT },
    { role: 'user', content: text },
  ];

  const response = await gateway.chat(messages, {
    temperature: 0.1,
    responseFormat: 'json_object',
  });

  const parsed = gateway.parseJSON<Omit<OCRAnalysisResult, 'extractedText'>>(response);

  return {
    keyFacts: parsed.keyFacts || [],
    parties: parsed.parties || [],
    amounts: parsed.amounts || [],
    legalReferences: parsed.legalReferences || [],
    documentType: parsed.documentType || 'unknown',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
  };
}

// ─── Main Pipeline ──────────────────────────────────────────

/**
 * Full OCR + NLP analysis pipeline:
 * 1. Extract text from document via AWS Textract
 * 2. Analyze extracted text with LLM for legal insights
 *
 * Handles Textract failure gracefully by returning empty result.
 */
export async function analyzeOCRDocument(fileKey: string): Promise<OCRAnalysisResult> {
  let extractedText: string;

  try {
    extractedText = await extractTextFromDocument(fileKey);
  } catch {
    // Textract failure: return empty result
    return {
      extractedText: '',
      keyFacts: [],
      parties: [],
      amounts: [],
      legalReferences: [],
      documentType: '',
      confidence: 0,
    };
  }

  if (!extractedText.trim()) {
    return {
      extractedText: '',
      keyFacts: [],
      parties: [],
      amounts: [],
      legalReferences: [],
      documentType: '',
      confidence: 0,
    };
  }

  const analysis = await analyzeText(extractedText);

  return {
    extractedText,
    ...analysis,
  };
}
