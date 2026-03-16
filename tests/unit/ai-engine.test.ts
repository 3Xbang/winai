/**
 * Unit tests for AI Conversation Engine (对话引擎核心处理器)
 * Tests: processMessage, structured response, follow-up suggestions,
 * language detection, intent classification, emotion detection,
 * context updates, and degraded mode.
 *
 * Requirements: 21.1, 21.5, 21.6, 21.8
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConversationEngine,
  detectEmotion,
  generateFollowUpSuggestions,
  parseStructuredResponse,
  type ConversationEngineConfig,
} from '../../src/server/services/ai/conversation/engine';
import {
  ContextManager,
  InMemoryContextStore,
} from '../../src/server/services/ai/conversation/context-manager';
import { LegalDomain } from '../../src/server/services/ai/conversation/intent-classifier';
import type { LLMGenerateFn } from '../../src/server/services/rag/pipeline';

// ─── Test Helpers ───────────────────────────────────────────

function createMockLLM(response?: string): LLMGenerateFn {
  return async (_prompt: string, _systemPrompt?: string) => {
    return response ?? '摘要：这是一个法律咨询问题的回复。\n分析：根据相关法律规定，您的情况需要注意以下几点。\n建议：\n1. 咨询专业律师\n2. 准备相关材料';
  };
}

function createEngine(options?: {
  llmResponse?: string;
  withRAG?: boolean;
}): { engine: ConversationEngine; store: InMemoryContextStore; contextManager: ContextManager } {
  const store = new InMemoryContextStore();
  const contextManager = new ContextManager(store);
  const llmGenerate = createMockLLM(options?.llmResponse);

  const config: ConversationEngineConfig = {
    contextManager,
    llmGenerate,
  };

  if (options?.withRAG) {
    // Create a minimal mock RAG pipeline
    config.ragPipeline = {
      query: async (_request: { query: string; namespace: string }) => ({
        answer: `RAG answer for: ${_request.query}`,
        citations: [
          {
            lawName: '民法典',
            articleNumber: '第一百四十三条',
            contentSummary: '民事法律行为有效的条件',
            confidenceScore: 85,
            needsVerification: false,
          },
        ],
        isVerified: true,
        degraded: false,
      }),
    } as any;
  }

  const engine = new ConversationEngine(config);
  return { engine, store, contextManager };
}

// ─── Tests ──────────────────────────────────────────────────

describe('ConversationEngine', () => {
  describe('processMessage', () => {
    it('should return a complete ConversationResponse', async () => {
      const { engine } = createEngine();
      const response = await engine.processMessage('session-1', '我想咨询公司注册的问题');

      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
      expect(response.structure).toBeDefined();
      expect(response.followUpSuggestions).toBeDefined();
      expect(response.detectedLanguage).toBeDefined();
      expect(response.intent).toBeDefined();
      expect(response.citations).toBeDefined();
      expect(Array.isArray(response.citations)).toBe(true);
    });

    it('should include structure with summary, analysis, and nextSteps', async () => {
      const { engine } = createEngine();
      const response = await engine.processMessage('session-2', '合同纠纷如何处理');

      expect(response.structure.summary).toBeTruthy();
      expect(response.structure.analysis).toBeTruthy();
      expect(Array.isArray(response.structure.nextSteps)).toBe(true);
      expect(response.structure.nextSteps.length).toBeGreaterThan(0);
    });

    it('should include at least 1 follow-up suggestion', async () => {
      const { engine } = createEngine();
      const response = await engine.processMessage('session-3', '签证续签需要什么条件');

      expect(response.followUpSuggestions.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect language and include it in response', async () => {
      const { engine } = createEngine();

      const zhResponse = await engine.processMessage('session-zh', '我想咨询劳动法问题');
      expect(zhResponse.detectedLanguage).toBe('zh');

      const enResponse = await engine.processMessage('session-en', 'I need help with a contract dispute');
      expect(enResponse.detectedLanguage).toBe('en');
    });

    it('should classify intent and include it in response', async () => {
      const { engine } = createEngine();
      const response = await engine.processMessage('session-4', '我想咨询公司注册的流程');

      expect(response.intent).toBeDefined();
      expect(response.intent.primaryIntent).toBe(LegalDomain.CORPORATE);
      expect(response.intent.routingTarget).toBeTruthy();
    });

    it('should detect anxious emotion for anxious input', async () => {
      const { engine } = createEngine();
      const response = await engine.processMessage('session-5', '我非常着急，公司马上要被起诉了，怎么办？');

      expect(response.emotionDetected).toBe('anxious');
    });

    it('should detect neutral emotion for calm input', async () => {
      const { engine } = createEngine();
      const response = await engine.processMessage('session-6', '请问公司注册需要哪些材料？');

      expect(response.emotionDetected).toBe('neutral');
    });

    it('should update context after processing', async () => {
      const { engine, contextManager } = createEngine();
      const sessionId = 'session-ctx';

      await engine.processMessage(sessionId, '我想咨询合同问题');

      const context = await contextManager.getContext(sessionId);
      expect(context.messages.length).toBe(2); // user + assistant
      expect(context.messages[0]!.role).toBe('user');
      expect(context.messages[1]!.role).toBe('assistant');
    });

    it('should work in degraded mode when RAG is unavailable', async () => {
      const { engine } = createEngine({ withRAG: false });
      const response = await engine.processMessage('session-degraded', '民法典第一百四十三条是什么');

      expect(response).toBeDefined();
      expect(response.answer).toBeTruthy();
      expect(response.citations).toEqual([]);
    });

    it('should include citations when RAG is available', async () => {
      const { engine } = createEngine({ withRAG: true });
      const response = await engine.processMessage('session-rag', '民法典关于合同效力的规定');

      expect(response.citations.length).toBeGreaterThan(0);
      expect(response.citations[0]!.lawName).toBe('民法典');
    });
  });

  describe('detectEmotion', () => {
    it('should detect anxious emotion', () => {
      expect(detectEmotion('我很着急，不知道怎么办')).toBe('anxious');
      expect(detectEmotion('I am very worried about this case')).toBe('anxious');
    });

    it('should detect urgent emotion', () => {
      expect(detectEmotion('马上就要开庭了，刻不容缓')).toBe('urgent');
      expect(detectEmotion('This is an emergency, need help immediately')).toBe('urgent');
    });

    it('should detect confused emotion', () => {
      expect(detectEmotion('我不明白这个法律条文什么意思')).toBe('confused');
      expect(detectEmotion('I am confused about the legal terms')).toBe('confused');
    });

    it('should return neutral for calm text', () => {
      expect(detectEmotion('请问公司注册流程是什么')).toBe('neutral');
      expect(detectEmotion('What are the requirements for a work permit?')).toBe('neutral');
    });
  });

  describe('generateFollowUpSuggestions', () => {
    it('should generate suggestions for CORPORATE domain', () => {
      const intent = {
        primaryIntent: LegalDomain.CORPORATE,
        secondaryIntents: [],
        confidence: 0.9,
        routingTarget: 'case-analyzer',
      };
      const context = {
        sessionId: 'test',
        messages: [],
        keyFacts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const suggestions = generateFollowUpSuggestions(intent, context);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should generate suggestions for VISA domain', () => {
      const intent = {
        primaryIntent: LegalDomain.VISA,
        secondaryIntents: [],
        confidence: 0.8,
        routingTarget: 'visa',
      };
      const context = {
        sessionId: 'test',
        messages: [],
        keyFacts: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const suggestions = generateFollowUpSuggestions(intent, context);
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('parseStructuredResponse', () => {
    it('should parse structured response with markers', () => {
      const response = '摘要：这是摘要内容。\n分析：这是分析内容。\n建议：\n1. 第一步\n2. 第二步';
      const result = parseStructuredResponse(response);

      expect(result.summary).toBeTruthy();
      expect(result.analysis).toBeTruthy();
      expect(result.nextSteps.length).toBeGreaterThan(0);
    });

    it('should handle unstructured response gracefully', () => {
      const response = '这是一个普通的法律回复，没有明确的结构标记。';
      const result = parseStructuredResponse(response);

      expect(result.summary).toBeTruthy();
      expect(result.analysis).toBeTruthy();
      expect(result.nextSteps.length).toBeGreaterThan(0);
    });
  });
});
