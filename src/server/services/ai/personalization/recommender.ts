/**
 * Recommender — Personalized recommendations based on consultation history
 * Requirements: 29.4
 */

// ─── Types ──────────────────────────────────────────────────

export interface Recommendation {
  type: 'article' | 'case' | 'template';
  title: string;
  relevanceScore: number; // 0-1
  reason: string;
}

// ─── In-Memory Store (production: pgvector similarity search) ─

const historyStore = new Map<string, string[]>();

// ─── Public API ─────────────────────────────────────────────

/**
 * Record a consultation topic for a user.
 */
export function recordConsultation(userId: string, topic: string): void {
  const history = historyStore.get(userId) ?? [];
  history.push(topic);
  historyStore.set(userId, history);
}

/**
 * Get recommendations based on user's consultation history.
 * In production, uses vector similarity search.
 */
export function getRecommendations(userId: string): Recommendation[] {
  const history = historyStore.get(userId);
  if (!history || history.length === 0) return [];

  // Simple keyword-based recommendations (production: vector similarity)
  const lastTopic = history[history.length - 1];
  return [
    {
      type: 'article',
      title: `${lastTopic}相关法律知识`,
      relevanceScore: 0.85,
      reason: `基于您最近咨询的"${lastTopic}"主题`,
    },
    {
      type: 'case',
      title: `${lastTopic}类似案例参考`,
      relevanceScore: 0.75,
      reason: '相关案例推荐',
    },
  ];
}

export function clearHistory(): void {
  historyStore.clear();
}
