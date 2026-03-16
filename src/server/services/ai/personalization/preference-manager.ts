/**
 * User Preference Manager — Preferences with Redis cache + DB fallback
 * Manages terminology level, response style, and language preferences.
 * Requirements: 29.1, 29.5
 */

// ─── Types ──────────────────────────────────────────────────

export type TerminologyLevel = 'LAYPERSON' | 'PROFESSIONAL' | 'EXPERT';

export interface UserPreference {
  userId: string;
  responseStyle: 'concise' | 'detailed' | 'comprehensive';
  terminologyLevel: TerminologyLevel;
  preferredLanguage: 'zh' | 'th' | 'en';
  reportFormat: 'summary' | 'full' | 'executive';
}

const DEFAULT_PREFERENCE: Omit<UserPreference, 'userId'> = {
  responseStyle: 'detailed',
  terminologyLevel: 'LAYPERSON',
  preferredLanguage: 'zh',
  reportFormat: 'summary',
};

// ─── In-Memory Store (production: Redis + DB) ───────────────

const prefStore = new Map<string, UserPreference>();

// ─── Public API ─────────────────────────────────────────────

/**
 * Get user preferences. In production: Redis cache → DB fallback.
 */
export function getUserPreferences(userId: string): UserPreference {
  return prefStore.get(userId) ?? { userId, ...DEFAULT_PREFERENCE };
}

/**
 * Update user preferences. In production: updates both Redis and DB.
 */
export function updatePreferences(
  userId: string,
  prefs: Partial<Omit<UserPreference, 'userId'>>,
): UserPreference {
  const current = getUserPreferences(userId);
  const updated: UserPreference = { ...current, ...prefs, userId };
  prefStore.set(userId, updated);
  return updated;
}

/**
 * Get terminology level for a user.
 */
export function getTerminologyLevel(userId: string): TerminologyLevel {
  return getUserPreferences(userId).terminologyLevel;
}

/**
 * Build a system prompt injection based on user preferences.
 */
export function buildPreferencePromptInjection(userId: string): string {
  const prefs = getUserPreferences(userId);
  const parts: string[] = [];

  if (prefs.responseStyle === 'concise') parts.push('请简洁回答，避免冗长解释。');
  else if (prefs.responseStyle === 'comprehensive') parts.push('请提供全面详细的分析和解释。');

  if (prefs.terminologyLevel === 'LAYPERSON') parts.push('请使用通俗易懂的语言，避免专业术语。');
  else if (prefs.terminologyLevel === 'EXPERT') parts.push('可以使用专业法律术语，无需额外解释。');

  if (prefs.preferredLanguage === 'th') parts.push('请使用泰语回答。');
  else if (prefs.preferredLanguage === 'en') parts.push('Please respond in English.');

  return parts.join('\n');
}

/**
 * Clear all preferences (for testing).
 */
export function clearPreferences(): void {
  prefStore.clear();
}
