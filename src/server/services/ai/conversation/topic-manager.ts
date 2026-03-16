/**
 * Topic Manager (主题切换管理器)
 * Manages topic branching within a conversation session.
 * Supports switching topics, restoring previous topics, and detecting topic switches.
 *
 * Topic branches are stored independently per session.
 * Redis key pattern: `conversation:{sessionId}:topics`
 *
 * Requirements: 21.3, 21.4
 */

import type { ConversationContext } from './context-manager';

// ─── Types ──────────────────────────────────────────────────

export interface TopicBranch {
  topicId: string;
  topicName: string;
  context: ConversationContext;
  createdAt: Date;
}

export interface TopicManagerStore {
  getTopics(sessionId: string): Promise<TopicBranch[]>;
  saveTopic(sessionId: string, topic: TopicBranch): Promise<void>;
  deleteTopic(sessionId: string, topicId: string): Promise<void>;
}

// ─── Constants ──────────────────────────────────────────────

export const TOPIC_KEY_PREFIX = 'conversation:';
export const TOPIC_KEY_SUFFIX = ':topics';

/** Keywords that signal a topic switch in Chinese, Thai, and English */
const TOPIC_SWITCH_KEYWORDS: string[] = [
  // Chinese
  '另外', '还有一个问题', '换个话题', '我想问另一个', '另一个问题',
  '顺便问一下', '还想咨询', '除此之外', '另外一件事',
  // Thai
  'อีกเรื่อง', 'เปลี่ยนเรื่อง', 'นอกจากนี้',
  // English
  'another question', 'different topic', 'change of subject',
  'by the way', 'on another note', 'switching topics',
  'also want to ask', 'separate issue',
];

// ─── Topic Key Helper ───────────────────────────────────────

export function buildTopicKey(sessionId: string): string {
  return `${TOPIC_KEY_PREFIX}${sessionId}${TOPIC_KEY_SUFFIX}`;
}

// ─── InMemoryTopicStore ─────────────────────────────────────

/**
 * In-memory implementation of TopicManagerStore for testing.
 */
export class InMemoryTopicStore implements TopicManagerStore {
  private store = new Map<string, TopicBranch[]>();

  async getTopics(sessionId: string): Promise<TopicBranch[]> {
    return this.store.get(sessionId) ?? [];
  }

  async saveTopic(sessionId: string, topic: TopicBranch): Promise<void> {
    const topics = this.store.get(sessionId) ?? [];
    // Replace if same topicId exists, otherwise append
    const idx = topics.findIndex((t) => t.topicId === topic.topicId);
    if (idx >= 0) {
      topics[idx] = topic;
    } else {
      topics.push(topic);
    }
    this.store.set(sessionId, topics);
  }

  async deleteTopic(sessionId: string, topicId: string): Promise<void> {
    const topics = this.store.get(sessionId) ?? [];
    this.store.set(
      sessionId,
      topics.filter((t) => t.topicId !== topicId),
    );
  }

  get size(): number {
    return this.store.size;
  }
}

// ─── Topic Switch Detection ─────────────────────────────────

/**
 * Detect whether the current message signals a topic switch.
 * Uses simple keyword-based detection.
 */
export function detectTopicSwitch(
  currentMessage: string,
  _context: ConversationContext,
): boolean {
  const normalized = currentMessage.toLowerCase();
  return TOPIC_SWITCH_KEYWORDS.some((kw) => normalized.includes(kw.toLowerCase()));
}

// ─── TopicManager ───────────────────────────────────────────

let topicIdCounter = 0;

function generateTopicId(): string {
  topicIdCounter++;
  return `topic-${Date.now()}-${topicIdCounter}`;
}

/**
 * Manages topic branches for conversation sessions.
 * Allows switching to a new topic (saving current context as a branch),
 * restoring a previous topic, and listing all branches.
 */
export class TopicManager {
  constructor(
    private readonly contextStore: import('./context-manager').ContextStore,
    private readonly topicStore: TopicManagerStore,
  ) {}

  /**
   * Switch to a new topic.
   * Saves the current context as a topic branch, then creates a fresh context.
   */
  async switchTopic(
    sessionId: string,
    newTopicName: string,
  ): Promise<TopicBranch> {
    // Load current context
    const { buildContextKey } = await import('./context-manager');
    const key = buildContextKey(sessionId);
    const currentContext = await this.contextStore.get(key);

    // Save current context as a topic branch (if it has messages)
    if (currentContext && currentContext.messages.length > 0) {
      const branch: TopicBranch = {
        topicId: generateTopicId(),
        topicName: currentContext.currentTopic ?? 'default',
        context: { ...currentContext },
        createdAt: new Date(),
      };
      await this.topicStore.saveTopic(sessionId, branch);
    }

    // Create a new empty context for the new topic
    const now = new Date();
    const newContext: ConversationContext = {
      sessionId,
      messages: [],
      keyFacts: [],
      currentTopic: newTopicName,
      createdAt: now,
      updatedAt: now,
    };
    await this.contextStore.set(key, newContext);

    // Create and save the new topic branch
    const newBranch: TopicBranch = {
      topicId: generateTopicId(),
      topicName: newTopicName,
      context: newContext,
      createdAt: now,
    };
    await this.topicStore.saveTopic(sessionId, newBranch);

    return newBranch;
  }

  /**
   * Restore a previous topic's context as the active context.
   */
  async restoreTopic(
    sessionId: string,
    topicId: string,
  ): Promise<ConversationContext> {
    const topics = await this.topicStore.getTopics(sessionId);
    const branch = topics.find((t) => t.topicId === topicId);

    if (!branch) {
      throw new Error(`Topic branch not found: ${topicId}`);
    }

    // Set the branch's context as the active context
    const { buildContextKey } = await import('./context-manager');
    const key = buildContextKey(sessionId);
    await this.contextStore.set(key, { ...branch.context, updatedAt: new Date() });

    return branch.context;
  }

  /**
   * List all topic branches for a session.
   */
  async getTopicBranches(sessionId: string): Promise<TopicBranch[]> {
    return this.topicStore.getTopics(sessionId);
  }
}
