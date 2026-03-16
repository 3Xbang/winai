/**
 * AI Conversation Engine (AI 对话引擎核心处理器)
 * Orchestrates the full conversation flow:
 *   Language Detection → Intent Classification → Context Loading →
 *   RAG Retrieval → LLM Generation → Follow-up Suggestions → Context Update
 *
 * Supports structured response output, emotion detection, and degraded mode.
 *
 * Requirements: 21.1, 21.5, 21.6, 21.8
 */

import { detectLanguage } from './language-detector';
import { classifyIntent, type IntentClassification } from './intent-classifier';
import { ContextManager, type ConversationMessage } from './context-manager';
import { generateClarifyingQuestions } from './clarifier';
import type { RAGPipeline, Citation, LLMGenerateFn } from '../../rag/pipeline';

// ─── Types ──────────────────────────────────────────────────

export type EmotionType = 'neutral' | 'anxious' | 'urgent' | 'confused';

export interface ConversationResponse {
  answer: string;
  structure: {
    summary: string;
    analysis: string;
    nextSteps: string[];
  };
  followUpSuggestions: string[];
  detectedLanguage: 'zh' | 'th' | 'en';
  intent: IntentClassification;
  citations: Citation[];
  emotionDetected?: EmotionType;
}

export interface ConversationEngineConfig {
  contextManager: ContextManager;
  ragPipeline?: RAGPipeline;
  llmGenerate: LLMGenerateFn;
}

// ─── Emotion Detection Keywords ─────────────────────────────

const EMOTION_KEYWORDS: Record<Exclude<EmotionType, 'neutral'>, string[]> = {
  anxious: [
    '着急', '焦虑', '紧急', '急', '担心', '害怕', '恐慌', '不安',
    'urgent', 'worried', 'anxious', 'panic', 'scared', 'afraid',
    'กังวล', 'เร่งด่วน', 'กลัว',
  ],
  urgent: [
    '马上', '立刻', '紧迫', '刻不容缓', '火急', '十万火急', '赶紧',
    'immediately', 'asap', 'right now', 'emergency', 'critical',
    'ทันที', 'ฉุกเฉิน',
  ],
  confused: [
    '不明白', '不理解', '不懂', '搞不清', '困惑', '迷茫', '什么意思',
    'confused', 'don\'t understand', 'unclear', 'what does it mean',
    'ไม่เข้าใจ', 'สับสน', 'งง',
  ],
};

// ─── Follow-up Suggestion Templates ─────────────────────────

const FOLLOW_UP_TEMPLATES: Record<string, string[]> = {
  CORPORATE: [
    '公司注册需要准备哪些材料？',
    '外资持股比例有什么限制？',
    '公司章程有哪些必备条款？',
  ],
  CONTRACT: [
    '合同中有哪些常见的风险条款？',
    '如何处理合同违约的情况？',
    '合同争议解决条款应该怎么写？',
  ],
  CRIMINAL: [
    '这种情况可能涉及哪些罪名？',
    '量刑范围大概是多少？',
    '是否需要聘请专业律师？',
  ],
  CIVIL: [
    '诉讼时效是多久？',
    '可以主张哪些损害赔偿？',
    '需要准备哪些证据？',
  ],
  VISA: [
    '签证申请需要哪些材料？',
    '签证续签的条件是什么？',
    '逾期滞留有什么法律后果？',
  ],
  TAX: [
    '如何避免双重征税？',
    '需要申报哪些税种？',
    '有哪些税收优惠政策？',
  ],
  IP: [
    '商标注册流程是怎样的？',
    '如何保护知识产权不被侵犯？',
    '侵权赔偿标准是什么？',
  ],
  LABOR: [
    '劳动合同解除需要什么条件？',
    '加班工资如何计算？',
    '工伤赔偿标准是什么？',
  ],
  TRADE: [
    '跨境贸易需要哪些许可证？',
    '关税税率是多少？',
    '贸易合规有哪些注意事项？',
  ],
};

// ─── Conversation Engine ────────────────────────────────────

export class ConversationEngine {
  private contextManager: ContextManager;
  private ragPipeline?: RAGPipeline;
  private llmGenerate: LLMGenerateFn;

  constructor(config: ConversationEngineConfig) {
    this.contextManager = config.contextManager;
    this.ragPipeline = config.ragPipeline;
    this.llmGenerate = config.llmGenerate;
  }

  /**
   * Core message processing pipeline.
   * Orchestrates: language detection → intent classification → context loading →
   * RAG retrieval → LLM generation → follow-up suggestions → context update.
   */
  async processMessage(
    sessionId: string,
    userMessage: string,
  ): Promise<ConversationResponse> {
    // 1. Detect language
    const detectedLanguage = detectLanguage(userMessage);

    // 2. Classify intent
    const intent = classifyIntent(userMessage);

    // 3. Load context
    const context = await this.contextManager.getContext(sessionId);

    // 4. Detect emotion
    const emotionDetected = detectEmotion(userMessage);

    // 5. RAG retrieval (if pipeline available)
    let citations: Citation[] = [];
    let ragAnswer = '';
    if (this.ragPipeline) {
      try {
        const ragResult = await this.ragPipeline.query({
          query: userMessage,
          namespace: intent.primaryIntent.toLowerCase(),
        });
        citations = ragResult.citations;
        ragAnswer = ragResult.answer;
      } catch {
        // RAG failed — continue in degraded mode
      }
    }

    // 6. LLM generation with context
    const systemPrompt = buildSystemPrompt(detectedLanguage, emotionDetected);
    const userPrompt = buildUserPrompt(
      userMessage,
      context.messages,
      ragAnswer,
      citations,
      intent,
    );

    let llmResponse: string;
    try {
      llmResponse = await this.llmGenerate(userPrompt, systemPrompt);
    } catch {
      llmResponse = getDefaultResponse(detectedLanguage);
    }

    // 7. Parse structured response
    const structure = parseStructuredResponse(llmResponse);

    // 8. Generate follow-up suggestions
    const followUpSuggestions = generateFollowUpSuggestions(intent, context);

    // 9. Generate clarifying questions and merge if needed
    const clarifyResult = generateClarifyingQuestions(context);
    if (clarifyResult.questions.length > 0 && followUpSuggestions.length < 3) {
      followUpSuggestions.push(...clarifyResult.questions.slice(0, 3 - followUpSuggestions.length));
    }

    // 10. Update context with user message and assistant response
    const userMsg: ConversationMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    const assistantMsg: ConversationMessage = {
      role: 'assistant',
      content: llmResponse,
      timestamp: new Date(),
    };
    await this.contextManager.updateContext(sessionId, userMsg);
    await this.contextManager.updateContext(sessionId, assistantMsg);

    return {
      answer: llmResponse,
      structure,
      followUpSuggestions,
      detectedLanguage,
      intent,
      citations,
      emotionDetected,
    };
  }
}

// ─── Emotion Detection ──────────────────────────────────────

/**
 * Detect emotion from user text using keyword matching.
 * Returns the most prominent emotion or 'neutral'.
 */
export function detectEmotion(text: string): EmotionType {
  const normalizedText = text.toLowerCase();
  const scores: Record<string, number> = { anxious: 0, urgent: 0, confused: 0 };

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        scores[emotion] = (scores[emotion] ?? 0) + 1;
      }
    }
  }

  const maxEmotion = Object.entries(scores).reduce(
    (max, [emotion, score]) => (score > max.score ? { emotion, score } : max),
    { emotion: 'neutral', score: 0 },
  );

  return maxEmotion.score > 0 ? (maxEmotion.emotion as EmotionType) : 'neutral';
}

// ─── Follow-up Suggestions ──────────────────────────────────

/**
 * Generate 2-3 follow-up question suggestions based on intent domain.
 */
export function generateFollowUpSuggestions(
  intent: IntentClassification,
  _context: import('./context-manager').ConversationContext,
): string[] {
  const domain = intent.primaryIntent;
  const templates = FOLLOW_UP_TEMPLATES[domain] ?? FOLLOW_UP_TEMPLATES['CIVIL'] ?? ['建议咨询专业律师获取更详细的法律意见'];
  // Return 2-3 suggestions
  return templates.slice(0, 3);
}

// ─── Structured Response Parsing ────────────────────────────

/**
 * Parse LLM response into structured output (summary, analysis, nextSteps).
 * Attempts to extract sections from the response text.
 */
export function parseStructuredResponse(response: string): {
  summary: string;
  analysis: string;
  nextSteps: string[];
} {
  // Try to extract sections by common markers
  const summaryMatch = response.match(/(?:摘要|总结|概要|summary)[：:]\s*([\s\S]*?)(?=(?:分析|analysis|建议|next|下一步)|$)/i);
  const analysisMatch = response.match(/(?:分析|analysis)[：:]\s*([\s\S]*?)(?=(?:建议|next|下一步|摘要|总结)|$)/i);
  const stepsMatch = response.match(/(?:建议|下一步|next\s*steps?|行动方案)[：:]\s*([\s\S]*?)$/i);

  const summary = summaryMatch?.[1]?.trim() || extractFirstSentences(response, 2);
  const analysis = analysisMatch?.[1]?.trim() || response;
  const nextStepsText = stepsMatch?.[1]?.trim() || '';

  // Parse next steps from numbered or bulleted list
  let nextSteps: string[] = [];
  if (nextStepsText) {
    nextSteps = nextStepsText
      .split(/\n/)
      .map((line) => line.replace(/^[\d.)\-•*]+\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  // Ensure at least one next step
  if (nextSteps.length === 0) {
    nextSteps = ['建议咨询专业律师获取更详细的法律意见'];
  }

  return { summary, analysis, nextSteps };
}

// ─── Helpers ────────────────────────────────────────────────

function extractFirstSentences(text: string, count: number): string {
  const sentences = text.split(/[。.！!？?]/);
  return sentences.slice(0, count).join('。').trim() || text.substring(0, 100);
}

function buildSystemPrompt(language: 'zh' | 'th' | 'en', emotion: EmotionType): string {
  const langInstructions: Record<string, string> = {
    zh: '请使用中文回复。',
    th: 'กรุณาตอบเป็นภาษาไทย',
    en: 'Please respond in English.',
  };

  let emotionInstruction = '';
  if (emotion === 'anxious' || emotion === 'urgent') {
    emotionInstruction = '\n用户可能感到焦虑或紧迫，请使用安抚性语气，优先提供即时可行的建议，并明确告知后续处理步骤。';
  } else if (emotion === 'confused') {
    emotionInstruction = '\n用户可能感到困惑，请使用通俗易懂的语言解释，避免过多专业术语。';
  }

  return `你是一位专业的中泰法律专家。请基于用户的咨询提供准确、结构化的法律分析。
${langInstructions[language]}
回复应包含：摘要、分析、建议的下一步行动。法律术语请附带通俗解释。${emotionInstruction}`;
}

function buildUserPrompt(
  userMessage: string,
  historyMessages: ConversationMessage[],
  ragAnswer: string,
  citations: Citation[],
  intent: IntentClassification,
): string {
  let prompt = '';

  // Include recent conversation history for context
  if (historyMessages.length > 0) {
    const recentMessages = historyMessages.slice(-6);
    prompt += '对话历史：\n';
    for (const msg of recentMessages) {
      const role = msg.role === 'user' ? '用户' : '助手';
      prompt += `${role}: ${msg.content}\n`;
    }
    prompt += '\n';
  }

  // Include RAG context
  if (ragAnswer) {
    prompt += `知识库参考：\n${ragAnswer}\n\n`;
  }

  if (citations.length > 0) {
    prompt += '相关法条引用：\n';
    for (const c of citations) {
      prompt += `- ${c.lawName} ${c.articleNumber}: ${c.contentSummary}\n`;
    }
    prompt += '\n';
  }

  prompt += `法律领域: ${intent.primaryIntent}\n`;
  prompt += `用户问题: ${userMessage}\n\n`;
  prompt += '请提供结构化的法律分析回复，包含摘要、详细分析和建议的下一步行动。';

  return prompt;
}

function getDefaultResponse(language: 'zh' | 'th' | 'en'): string {
  const defaults: Record<string, string> = {
    zh: '抱歉，系统暂时无法处理您的请求。建议咨询专业律师获取更详细的法律意见。',
    th: 'ขออภัย ระบบไม่สามารถประมวลผลคำขอของคุณได้ในขณะนี้ แนะนำให้ปรึกษาทนายความ',
    en: 'Sorry, the system is temporarily unable to process your request. Please consult a professional lawyer.',
  };
  return defaults[language] ?? defaults['zh'] ?? '系统暂时无法处理您的请求。';
}
