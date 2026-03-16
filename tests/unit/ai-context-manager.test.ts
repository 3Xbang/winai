/**
 * Unit tests for AI Conversation Context Manager
 * Requirements: 21.1
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ContextManager,
  InMemoryContextStore,
  ConversationMessage,
  ConversationContext,
  extractKeyFacts,
  MAX_CONTEXT_MESSAGES,
  buildContextKey,
  CONTEXT_KEY_PREFIX,
  CONTEXT_KEY_SUFFIX,
} from '@/server/services/ai/conversation/context-manager';

// ─── Helpers ────────────────────────────────────────────────

function makeMessage(
  role: 'user' | 'assistant',
  content: string,
  metadata?: Record<string, unknown>,
): ConversationMessage {
  return { role, content, timestamp: new Date(), metadata };
}

// ─── Tests ──────────────────────────────────────────────────

describe('ContextManager', () => {
  let store: InMemoryContextStore;
  let manager: ContextManager;

  beforeEach(() => {
    store = new InMemoryContextStore();
    manager = new ContextManager(store);
  });

  // ── getContext ───────────────────────────────────────────

  describe('getContext', () => {
    it('returns empty context for a new session', async () => {
      const ctx = await manager.getContext('new-session-123');

      expect(ctx.sessionId).toBe('new-session-123');
      expect(ctx.messages).toEqual([]);
      expect(ctx.keyFacts).toEqual([]);
      expect(ctx.createdAt).toBeInstanceOf(Date);
      expect(ctx.updatedAt).toBeInstanceOf(Date);
    });

    it('returns existing context from store', async () => {
      const existing: ConversationContext = {
        sessionId: 'existing-session',
        messages: [makeMessage('user', '你好')],
        keyFacts: [],
        currentTopic: '公司注册',
        detectedLanguage: 'zh',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      await store.set(buildContextKey('existing-session'), existing);

      const ctx = await manager.getContext('existing-session');
      expect(ctx.sessionId).toBe('existing-session');
      expect(ctx.messages).toHaveLength(1);
      expect(ctx.currentTopic).toBe('公司注册');
      expect(ctx.detectedLanguage).toBe('zh');
    });
  });

  // ── updateContext ───────────────────────────────────────

  describe('updateContext', () => {
    it('adds a message to an empty context', async () => {
      const msg = makeMessage('user', '我想咨询公司注册');
      await manager.updateContext('session-1', msg);

      const ctx = await manager.getContext('session-1');
      expect(ctx.messages).toHaveLength(1);
      expect(ctx.messages[0]!.content).toBe('我想咨询公司注册');
      expect(ctx.messages[0]!.role).toBe('user');
    });

    it('appends multiple messages in order', async () => {
      await manager.updateContext('session-2', makeMessage('user', '第一条消息'));
      await manager.updateContext('session-2', makeMessage('assistant', '第二条消息'));
      await manager.updateContext('session-2', makeMessage('user', '第三条消息'));

      const ctx = await manager.getContext('session-2');
      expect(ctx.messages).toHaveLength(3);
      expect(ctx.messages[0]!.content).toBe('第一条消息');
      expect(ctx.messages[1]!.content).toBe('第二条消息');
      expect(ctx.messages[2]!.content).toBe('第三条消息');
    });

    it('updates the updatedAt timestamp', async () => {
      await manager.updateContext('session-ts', makeMessage('user', 'hello'));
      const ctx1 = await manager.getContext('session-ts');
      const firstUpdate = ctx1.updatedAt;

      // Small delay to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 10));

      await manager.updateContext('session-ts', makeMessage('assistant', 'hi'));
      const ctx2 = await manager.getContext('session-ts');
      expect(ctx2.updatedAt.getTime()).toBeGreaterThanOrEqual(firstUpdate.getTime());
    });

    it('preserves message metadata', async () => {
      const msg = makeMessage('user', 'test', { source: 'web', intent: 'corporate' });
      await manager.updateContext('session-meta', msg);

      const ctx = await manager.getContext('session-meta');
      expect(ctx.messages[0]!.metadata).toEqual({ source: 'web', intent: 'corporate' });
    });
  });

  // ── Context window (max 20 messages) ───────────────────

  describe('context window management', () => {
    it('limits messages to MAX_CONTEXT_MESSAGES', async () => {
      // Add more than MAX_CONTEXT_MESSAGES messages
      for (let i = 0; i < MAX_CONTEXT_MESSAGES + 5; i++) {
        await manager.updateContext(
          'session-window',
          makeMessage('user', `Message ${i}`),
        );
      }

      const ctx = await manager.getContext('session-window');
      expect(ctx.messages).toHaveLength(MAX_CONTEXT_MESSAGES);
    });

    it('keeps the most recent messages when window overflows', async () => {
      const total = MAX_CONTEXT_MESSAGES + 10;
      for (let i = 0; i < total; i++) {
        await manager.updateContext(
          'session-recent',
          makeMessage('user', `Message ${i}`),
        );
      }

      const ctx = await manager.getContext('session-recent');
      // The oldest retained message should be Message (total - MAX_CONTEXT_MESSAGES)
      const expectedFirst = `Message ${total - MAX_CONTEXT_MESSAGES}`;
      expect(ctx.messages[0]!.content).toBe(expectedFirst);
      // The newest message should be the last one added
      expect(ctx.messages[ctx.messages.length - 1]!.content).toBe(`Message ${total - 1}`);
    });

    it('MAX_CONTEXT_MESSAGES is 20', () => {
      expect(MAX_CONTEXT_MESSAGES).toBe(20);
    });
  });

  // ── Key fact extraction ────────────────────────────────

  describe('key fact extraction', () => {
    it('extracts dates from messages', async () => {
      await manager.updateContext(
        'session-facts',
        makeMessage('user', '合同签订日期是2024-03-15，到期日是2025/06/30'),
      );

      const ctx = await manager.getContext('session-facts');
      expect(ctx.keyFacts.some((f) => f.includes('2024-03-15'))).toBe(true);
      expect(ctx.keyFacts.some((f) => f.includes('2025/06/30'))).toBe(true);
    });

    it('extracts monetary amounts', async () => {
      await manager.updateContext(
        'session-money',
        makeMessage('user', '合同金额为¥500000，另外还有$10000的保证金'),
      );

      const ctx = await manager.getContext('session-money');
      expect(ctx.keyFacts.some((f) => f.includes('¥500000'))).toBe(true);
      expect(ctx.keyFacts.some((f) => f.includes('$10000'))).toBe(true);
    });

    it('extracts Chinese company names', async () => {
      await manager.updateContext(
        'session-company',
        makeMessage('user', '我们是北京科技创新有限公司，与泰国合作方签订了合同'),
      );

      const ctx = await manager.getContext('session-company');
      expect(ctx.keyFacts.some((f) => f.includes('有限公司'))).toBe(true);
    });

    it('extracts amounts with Chinese units', async () => {
      await manager.updateContext(
        'session-cny',
        makeMessage('user', '赔偿金额为50万元，泰方要求200000泰铢'),
      );

      const ctx = await manager.getContext('session-cny');
      expect(ctx.keyFacts.some((f) => f.includes('万元'))).toBe(true);
      expect(ctx.keyFacts.some((f) => f.includes('泰铢'))).toBe(true);
    });

    it('deduplicates extracted facts', () => {
      const messages: ConversationMessage[] = [
        makeMessage('user', '合同日期2024-01-01'),
        makeMessage('assistant', '您提到的日期2024-01-01已记录'),
      ];
      const facts = extractKeyFacts(messages);
      const dateOccurrences = facts.filter((f) => f === '2024-01-01');
      expect(dateOccurrences).toHaveLength(1);
    });

    it('returns empty array when no facts found', () => {
      const messages: ConversationMessage[] = [
        makeMessage('user', 'hello'),
        makeMessage('assistant', 'hi there'),
      ];
      const facts = extractKeyFacts(messages);
      expect(facts).toEqual([]);
    });
  });

  // ── clearContext ────────────────────────────────────────

  describe('clearContext', () => {
    it('removes context from store', async () => {
      await manager.updateContext('session-clear', makeMessage('user', 'test'));
      const before = await manager.getContext('session-clear');
      expect(before.messages).toHaveLength(1);

      await manager.clearContext('session-clear');

      const after = await manager.getContext('session-clear');
      expect(after.messages).toEqual([]);
      expect(after.keyFacts).toEqual([]);
    });

    it('is safe to call on non-existent session', async () => {
      // Should not throw
      await expect(manager.clearContext('nonexistent')).resolves.toBeUndefined();
    });
  });

  // ── Context preserves session metadata ─────────────────

  describe('context preserves session metadata', () => {
    it('preserves currentTopic across updates', async () => {
      const initial: ConversationContext = {
        sessionId: 'session-topic',
        messages: [],
        keyFacts: [],
        currentTopic: '签证咨询',
        detectedLanguage: 'zh',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await store.set(buildContextKey('session-topic'), initial);

      await manager.updateContext('session-topic', makeMessage('user', '我想续签工作签'));

      const ctx = await manager.getContext('session-topic');
      expect(ctx.currentTopic).toBe('签证咨询');
      expect(ctx.detectedLanguage).toBe('zh');
      expect(ctx.messages).toHaveLength(1);
    });

    it('preserves createdAt across updates', async () => {
      const createdAt = new Date('2024-01-01T00:00:00Z');
      const initial: ConversationContext = {
        sessionId: 'session-created',
        messages: [],
        keyFacts: [],
        createdAt,
        updatedAt: createdAt,
      };
      await store.set(buildContextKey('session-created'), initial);

      await manager.updateContext('session-created', makeMessage('user', 'test'));

      const ctx = await manager.getContext('session-created');
      expect(ctx.createdAt.getTime()).toBe(createdAt.getTime());
    });
  });
});

// ─── InMemoryContextStore Tests ─────────────────────────────

describe('InMemoryContextStore', () => {
  it('returns null for missing keys', async () => {
    const store = new InMemoryContextStore();
    expect(await store.get('missing')).toBeNull();
  });

  it('stores and retrieves context', async () => {
    const store = new InMemoryContextStore();
    const ctx: ConversationContext = {
      sessionId: 'test',
      messages: [],
      keyFacts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await store.set('key', ctx);
    expect(await store.get('key')).toEqual(ctx);
  });

  it('deletes context', async () => {
    const store = new InMemoryContextStore();
    const ctx: ConversationContext = {
      sessionId: 'test',
      messages: [],
      keyFacts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await store.set('key', ctx);
    await store.delete('key');
    expect(await store.get('key')).toBeNull();
  });

  it('reports correct size', async () => {
    const store = new InMemoryContextStore();
    expect(store.size).toBe(0);
    const ctx: ConversationContext = {
      sessionId: 'test',
      messages: [],
      keyFacts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await store.set('a', ctx);
    await store.set('b', ctx);
    expect(store.size).toBe(2);
  });
});

// ─── buildContextKey Tests ──────────────────────────────────

describe('buildContextKey', () => {
  it('builds correct Redis key format', () => {
    expect(buildContextKey('abc-123')).toBe('conversation:abc-123:context');
  });

  it('uses correct prefix and suffix', () => {
    const key = buildContextKey('session-id');
    expect(key.startsWith(CONTEXT_KEY_PREFIX)).toBe(true);
    expect(key.endsWith(CONTEXT_KEY_SUFFIX)).toBe(true);
  });
});
