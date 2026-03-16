/**
 * Conversation Context Manager (多轮对话上下文管理器)
 * Manages multi-turn conversation context with configurable storage backend.
 * Supports context window management (last N messages + key facts summary).
 *
 * Redis cache strategy: `conversation:{sessionId}:context` TTL 24h
 *
 * Requirements: 21.1
 */

// ─── Types ──────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  sessionId: string;
  messages: ConversationMessage[];
  keyFacts: string[];
  currentTopic?: string;
  detectedLanguage?: 'zh' | 'th' | 'en';
  createdAt: Date;
  updatedAt: Date;
}

export interface ContextStore {
  get(key: string): Promise<ConversationContext | null>;
  set(key: string, context: ConversationContext, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
}

// ─── Constants ──────────────────────────────────────────────

/** Maximum number of messages to retain in the context window */
export const MAX_CONTEXT_MESSAGES = 20;

/** Redis cache TTL in seconds (24 hours) */
export const CONTEXT_TTL_SECONDS = 24 * 60 * 60;

/** Redis key prefix for conversation context */
export const CONTEXT_KEY_PREFIX = 'conversation:';
export const CONTEXT_KEY_SUFFIX = ':context';

// ─── Key Fact Extraction ────────────────────────────────────

/**
 * Patterns for extracting key facts from conversation messages.
 * Covers names, dates, monetary amounts, and locations in zh/th/en.
 */
const KEY_FACT_PATTERNS: RegExp[] = [
  // Dates: YYYY-MM-DD, YYYY/MM/DD, YYYY年M月D日
  /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/g,
  // Monetary amounts: ¥123, $456, ฿789, 123元, 123泰铢, 123 USD/CNY/THB
  /[¥$฿]\s?\d[\d,]*\.?\d*/g,
  /\d[\d,]*\.?\d*\s*(?:元|万元|泰铢|บาท|USD|CNY|THB|RMB)/g,
  // Chinese names (2-4 chars preceded by common titles)
  /(?:原告|被告|甲方|乙方|当事人|委托人|先生|女士|公司)\s*[：:]\s*[\u4e00-\u9fff]{2,10}/g,
  // Company names (ending with common suffixes)
  /[\u4e00-\u9fff]{2,20}(?:有限公司|股份有限公司|集团|企业)/g,
  // Locations
  /(?:位于|地址[：:]|在)\s*[\u4e00-\u9fff]{2,20}(?:省|市|区|县|路|街|号)/g,
  // Thai locations
  /(?:จังหวัด|อำเภอ|ตำบล|ถนน)[\u0e00-\u0e7f\s]+/g,
];

/**
 * Extract key facts (names, dates, amounts, locations) from messages.
 * Uses regex-based extraction for deterministic, testable behavior.
 */
export function extractKeyFacts(messages: ConversationMessage[]): string[] {
  const facts = new Set<string>();

  for (const msg of messages) {
    for (const pattern of KEY_FACT_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      const matches = msg.content.match(pattern);
      if (matches) {
        for (const match of matches) {
          const trimmed = match.trim();
          if (trimmed.length > 0) {
            facts.add(trimmed);
          }
        }
      }
    }
  }

  return Array.from(facts);
}

// ─── Context Key Helper ─────────────────────────────────────

/** Build the cache key for a session's context */
export function buildContextKey(sessionId: string): string {
  return `${CONTEXT_KEY_PREFIX}${sessionId}${CONTEXT_KEY_SUFFIX}`;
}

// ─── InMemoryContextStore ───────────────────────────────────

/**
 * In-memory implementation of ContextStore for testing and development.
 */
export class InMemoryContextStore implements ContextStore {
  private store = new Map<string, { context: ConversationContext; expiresAt?: number }>();

  async get(key: string): Promise<ConversationContext | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.context;
  }

  async set(key: string, context: ConversationContext, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { context, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Helper for tests: get the raw store size */
  get size(): number {
    return this.store.size;
  }
}

// ─── ContextManager ─────────────────────────────────────────

/**
 * Manages multi-turn conversation context.
 * - Retrieves context from store (Redis cache / in-memory), returns empty context if not found.
 * - Updates context by appending messages, managing the sliding window, and extracting key facts.
 * - Clears context on demand.
 */
export class ContextManager {
  constructor(private readonly store: ContextStore) {}

  /**
   * Get conversation context for a session.
   * Returns an empty context if none exists.
   */
  async getContext(sessionId: string): Promise<ConversationContext> {
    const key = buildContextKey(sessionId);
    const existing = await this.store.get(key);
    if (existing) return existing;

    // Return a fresh empty context
    const now = new Date();
    return {
      sessionId,
      messages: [],
      keyFacts: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Add a message to the conversation context.
   * Enforces the sliding window (last MAX_CONTEXT_MESSAGES) and re-extracts key facts.
   */
  async updateContext(sessionId: string, message: ConversationMessage): Promise<void> {
    const context = await this.getContext(sessionId);

    // Append the new message
    context.messages.push(message);

    // Enforce sliding window — keep only the last N messages
    if (context.messages.length > MAX_CONTEXT_MESSAGES) {
      context.messages = context.messages.slice(-MAX_CONTEXT_MESSAGES);
    }

    // Re-extract key facts from all retained messages
    context.keyFacts = extractKeyFacts(context.messages);

    // Update timestamp
    context.updatedAt = new Date();

    // Persist with TTL
    const key = buildContextKey(sessionId);
    await this.store.set(key, context, CONTEXT_TTL_SECONDS);
  }

  /**
   * Delete conversation context for a session.
   */
  async clearContext(sessionId: string): Promise<void> {
    const key = buildContextKey(sessionId);
    await this.store.delete(key);
  }
}
