/**
 * Clarifier (追问生成器)
 * Analyzes conversation context for missing key information and generates
 * targeted clarifying questions to guide the user.
 *
 * Uses rule-based detection: checks if keyFacts contain dates, amounts,
 * parties, locations, and legal basis. Generates questions for missing info.
 *
 * Requirements: 21.3, 21.4
 */

import type { ConversationContext } from './context-manager';

// ─── Types ──────────────────────────────────────────────────

export interface ClarifyingResult {
  questions: string[];
  missingInfo: string[];
}

// ─── Info Category Definitions ──────────────────────────────

export type InfoCategory = 'date' | 'amount' | 'parties' | 'location' | 'legalBasis';

/**
 * Patterns to detect whether a given info category is present in keyFacts or messages.
 */
const INFO_DETECTION_PATTERNS: Record<InfoCategory, RegExp[]> = {
  date: [
    /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?/,
    /\d{1,2}月\d{1,2}日/,
    /\d{4}年/,
  ],
  amount: [
    /[¥$฿]\s?\d/,
    /\d[\d,]*\.?\d*\s*(?:元|万元|泰铢|บาท|USD|CNY|THB|RMB)/,
  ],
  parties: [
    /(?:原告|被告|甲方|乙方|当事人|委托人)[：:]/,
    /[\u4e00-\u9fff]{2,20}(?:有限公司|股份有限公司|集团|企业)/,
    /(?:先生|女士|公司)\s*[：:]/,
    /plaintiff|defendant|party/i,
  ],
  location: [
    /(?:位于|地址[：:]|在)\s*[\u4e00-\u9fff]/,
    /[\u4e00-\u9fff]+(?:省|市|区|县|路|街|号)/,
    /(?:จังหวัด|อำเภอ|ตำบล|ถนน)/,
    /(?:bangkok|chiang mai|phuket|beijing|shanghai)/i,
  ],
  legalBasis: [
    /(?:民法典|刑法|公司法|劳动法|合同法|外商投资法)/,
    /第\s*\d+\s*条/,
    /(?:article|section)\s*\d+/i,
    /พ\.ร\.บ\./,
  ],
};

/**
 * Question templates for each missing info category.
 * Supports Chinese as the primary output language.
 */
const QUESTION_TEMPLATES: Record<InfoCategory, string> = {
  date: '请问事件发生的具体时间或日期是什么？',
  amount: '涉及的金额大约是多少？',
  parties: '请问涉及的当事人（个人或公司）有哪些？',
  location: '事件发生的地点在哪里？',
  legalBasis: '您是否了解可能适用的法律条文或法规？',
};

// ─── Detection Logic ────────────────────────────────────────

/**
 * Check if a given info category is present in the context.
 * Searches both keyFacts and raw message content.
 */
export function hasInfoCategory(
  category: InfoCategory,
  context: ConversationContext,
): boolean {
  const patterns = INFO_DETECTION_PATTERNS[category];
  const textsToSearch = [
    ...context.keyFacts,
    ...context.messages.map((m) => m.content),
  ];

  for (const text of textsToSearch) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Detect which info categories are missing from the conversation context.
 */
export function detectMissingInfo(context: ConversationContext): InfoCategory[] {
  const categories: InfoCategory[] = ['date', 'amount', 'parties', 'location', 'legalBasis'];
  return categories.filter((cat) => !hasInfoCategory(cat, context));
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate clarifying questions based on missing information in the context.
 * Returns empty questions array if context appears complete.
 */
export function generateClarifyingQuestions(
  context: ConversationContext,
): ClarifyingResult {
  // If there are no messages, nothing to clarify
  if (context.messages.length === 0) {
    return { questions: [], missingInfo: [] };
  }

  const missing = detectMissingInfo(context);

  return {
    questions: missing.map((cat) => QUESTION_TEMPLATES[cat]),
    missingInfo: missing,
  };
}
