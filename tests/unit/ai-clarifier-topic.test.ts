/**
 * Unit tests for Clarifier & Topic Manager
 * Requirements: 21.3, 21.4
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateClarifyingQuestions,
  hasInfoCategory,
  detectMissingInfo,
} from '@/server/services/ai/conversation/clarifier';
import {
  TopicManager,
  InMemoryTopicStore,
  detectTopicSwitch,
} from '@/server/services/ai/conversation/topic-manager';
import {
  InMemoryContextStore,
  buildContextKey,
  CONTEXT_TTL_SECONDS,
} from '@/server/services/ai/conversation/context-manager';
import type { ConversationContext, ConversationMessage } from '@/server/services/ai/conversation/context-manager';

// ─── Helpers ────────────────────────────────────────────────

function makeContext(overrides: Partial<ConversationContext> = {}): ConversationContext {
  const now = new Date();
  return {
    sessionId: 'test-session',
    messages: [],
    keyFacts: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMessage(content: string, role: 'user' | 'assistant' = 'user'): ConversationMessage {
  return { role, content, timestamp: new Date() };
}

// ─── Clarifier Tests ────────────────────────────────────────

describe('generateClarifyingQuestions', () => {
  it('generates questions when dates are missing', () => {
    const ctx = makeContext({
      messages: [makeMessage('我和对方公司有合同纠纷，金额100万元')],
      keyFacts: ['100万元'],
    });
    const result = generateClarifyingQuestions(ctx);
    expect(result.missingInfo).toContain('date');
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questions.some((q) => q.includes('时间') || q.includes('日期'))).toBe(true);
  });

  it('generates questions when amounts are missing', () => {
    const ctx = makeContext({
      messages: [makeMessage('2024年3月15日发生了一起合同纠纷')],
      keyFacts: ['2024年3月15日'],
    });
    const result = generateClarifyingQuestions(ctx);
    expect(result.missingInfo).toContain('amount');
    expect(result.questions.some((q) => q.includes('金额'))).toBe(true);
  });

  it('generates questions when parties are missing', () => {
    const ctx = makeContext({
      messages: [makeMessage('2024年1月发生了纠纷，涉及金额¥500000')],
      keyFacts: ['2024年1月', '¥500000'],
    });
    const result = generateClarifyingQuestions(ctx);
    expect(result.missingInfo).toContain('parties');
    expect(result.questions.some((q) => q.includes('当事人'))).toBe(true);
  });

  it('returns no questions when context is complete', () => {
    const ctx = makeContext({
      messages: [
        makeMessage(
          '2024年3月15日，原告：张三有限公司 与被告：李四有限公司 在位于北京市朝阳区的办公室发生合同纠纷，涉及金额¥1000000。根据民法典第509条。',
        ),
      ],
      keyFacts: [
        '2024年3月15日',
        '¥1000000',
        '原告：张三有限公司',
        '被告：李四有限公司',
        '位于北京市朝阳区',
        '民法典',
      ],
    });
    const result = generateClarifyingQuestions(ctx);
    expect(result.questions).toHaveLength(0);
    expect(result.missingInfo).toHaveLength(0);
  });

  it('returns empty for context with no messages', () => {
    const ctx = makeContext({ messages: [] });
    const result = generateClarifyingQuestions(ctx);
    expect(result.questions).toHaveLength(0);
    expect(result.missingInfo).toHaveLength(0);
  });
});

describe('hasInfoCategory', () => {
  it('detects date in keyFacts', () => {
    const ctx = makeContext({ keyFacts: ['2024-01-15'], messages: [makeMessage('test')] });
    expect(hasInfoCategory('date', ctx)).toBe(true);
  });

  it('detects amount in message content', () => {
    const ctx = makeContext({ messages: [makeMessage('涉及金额¥500000')] });
    expect(hasInfoCategory('amount', ctx)).toBe(true);
  });

  it('detects parties in message content', () => {
    const ctx = makeContext({ messages: [makeMessage('原告：张三公司')] });
    expect(hasInfoCategory('parties', ctx)).toBe(true);
  });

  it('detects location in message content', () => {
    const ctx = makeContext({ messages: [makeMessage('位于上海市浦东新区')] });
    expect(hasInfoCategory('location', ctx)).toBe(true);
  });
});

// ─── Topic Manager Tests ────────────────────────────────────

describe('TopicManager', () => {
  let contextStore: InMemoryContextStore;
  let topicStore: InMemoryTopicStore;
  let topicManager: TopicManager;

  beforeEach(() => {
    contextStore = new InMemoryContextStore();
    topicStore = new InMemoryTopicStore();
    topicManager = new TopicManager(contextStore, topicStore);
  });

  it('switchTopic creates a new branch with empty context', async () => {
    const sessionId = 'session-1';

    const branch = await topicManager.switchTopic(sessionId, '签证咨询');

    expect(branch.topicName).toBe('签证咨询');
    expect(branch.topicId).toBeDefined();
    expect(branch.context.messages).toHaveLength(0);
    expect(branch.context.currentTopic).toBe('签证咨询');
    expect(branch.createdAt).toBeInstanceOf(Date);
  });

  it('switchTopic saves current context as a branch before switching', async () => {
    const sessionId = 'session-2';
    const key = buildContextKey(sessionId);

    // Set up existing context with messages
    const existingContext: ConversationContext = makeContext({
      sessionId,
      messages: [makeMessage('我想咨询合同问题')],
      currentTopic: '合同纠纷',
    });
    await contextStore.set(key, existingContext, CONTEXT_TTL_SECONDS);

    // Switch topic
    await topicManager.switchTopic(sessionId, '签证咨询');

    // Should have 2 branches: the saved old topic + the new topic
    const branches = await topicManager.getTopicBranches(sessionId);
    expect(branches.length).toBe(2);

    const oldBranch = branches.find((b) => b.topicName === '合同纠纷');
    expect(oldBranch).toBeDefined();
    expect(oldBranch!.context.messages).toHaveLength(1);
  });

  it('restoreTopic returns the correct context', async () => {
    const sessionId = 'session-3';
    const key = buildContextKey(sessionId);

    // Create initial context
    const initialContext = makeContext({
      sessionId,
      messages: [makeMessage('合同纠纷相关问题')],
      currentTopic: '合同纠纷',
    });
    await contextStore.set(key, initialContext, CONTEXT_TTL_SECONDS);

    // Switch to new topic
    await topicManager.switchTopic(sessionId, '签证咨询');

    // Find the old topic branch
    const branches = await topicManager.getTopicBranches(sessionId);
    const oldBranch = branches.find((b) => b.topicName === '合同纠纷');
    expect(oldBranch).toBeDefined();

    // Restore old topic
    const restored = await topicManager.restoreTopic(sessionId, oldBranch!.topicId);
    expect(restored.currentTopic).toBe('合同纠纷');
    expect(restored.messages).toHaveLength(1);
    expect(restored.messages[0]?.content).toBe('合同纠纷相关问题');
  });

  it('getTopicBranches lists all branches', async () => {
    const sessionId = 'session-4';

    await topicManager.switchTopic(sessionId, '话题A');
    await topicManager.switchTopic(sessionId, '话题B');

    const branches = await topicManager.getTopicBranches(sessionId);
    // First switch: creates new branch for 话题A
    // Second switch: saves 话题A context + creates 话题B branch
    expect(branches.length).toBeGreaterThanOrEqual(2);
    const names = branches.map((b: { topicName: string }) => b.topicName);
    expect(names).toContain('话题A');
    expect(names).toContain('话题B');
  });

  it('restoreTopic throws for non-existent topicId', async () => {
    await expect(
      topicManager.restoreTopic('session-x', 'non-existent-id'),
    ).rejects.toThrow('Topic branch not found');
  });
});

// ─── Topic Switch Detection Tests ───────────────────────────

describe('detectTopicSwitch', () => {
  const emptyContext = makeContext();

  it('detects Chinese topic switch keywords', () => {
    expect(detectTopicSwitch('另外，我还想问一个签证的问题', emptyContext)).toBe(true);
    expect(detectTopicSwitch('换个话题，关于公司注册', emptyContext)).toBe(true);
    expect(detectTopicSwitch('还有一个问题想咨询', emptyContext)).toBe(true);
  });

  it('detects English topic switch keywords', () => {
    expect(detectTopicSwitch('By the way, I have another question about visas', emptyContext)).toBe(true);
    expect(detectTopicSwitch('On another note, what about tax compliance?', emptyContext)).toBe(true);
  });

  it('returns false for normal continuation messages', () => {
    expect(detectTopicSwitch('请继续分析这个合同条款', emptyContext)).toBe(false);
    expect(detectTopicSwitch('Can you explain more about this clause?', emptyContext)).toBe(false);
  });
});
