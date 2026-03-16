/**
 * FAQ Manager — Semantic FAQ matching for common legal questions
 * Requirements: 28.3
 */

// ─── Types ──────────────────────────────────────────────────

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  jurisdiction: 'china' | 'thailand' | 'both';
  lawReferences: string[];
}

// ─── Seed Data ──────────────────────────────────────────────

export const FAQ_SEED: FAQEntry[] = [
  {
    id: 'faq-cn-01',
    question: '劳动合同到期不续签，公司需要支付经济补偿吗？',
    answer: '根据《劳动合同法》第46条，劳动合同期满后，除用人单位维持或提高劳动合同约定条件续订而劳动者不同意的情形外，用人单位应当支付经济补偿。',
    category: '劳动法',
    jurisdiction: 'china',
    lawReferences: ['劳动合同法第46条', '劳动合同法第47条'],
  },
  {
    id: 'faq-cn-02',
    question: '借款合同没有约定利息怎么办？',
    answer: '根据《民法典》第680条，自然人之间的借款合同对支付利息没有约定或约定不明确的，视为不支付利息。',
    category: '合同法',
    jurisdiction: 'china',
    lawReferences: ['民法典第680条'],
  },
  {
    id: 'faq-th-01',
    question: '在泰国购买房产外国人有什么限制？',
    answer: '根据泰国《公寓法》，外国人可以购买公寓单元，但外国人持有比例不得超过该公寓项目总面积的49%。外国人不能直接拥有土地。',
    category: '房产法',
    jurisdiction: 'thailand',
    lawReferences: ['泰国公寓法第19条'],
  },
  {
    id: 'faq-th-02',
    question: '泰国工作签证需要什么条件？',
    answer: '外国人在泰国工作需要获得工作许可证（Work Permit），需由雇主担保申请，公司注册资本每雇佣一名外国人需至少200万泰铢。',
    category: '签证与工作许可',
    jurisdiction: 'thailand',
    lawReferences: ['泰国外国人工作法'],
  },
  {
    id: 'faq-cn-03',
    question: '交通事故责任如何划分？',
    answer: '根据《道路交通安全法》第76条，机动车之间发生交通事故的，由有过错的一方承担赔偿责任；双方都有过错的，按照各自过错的比例分担责任。',
    category: '侵权法',
    jurisdiction: 'china',
    lawReferences: ['道路交通安全法第76条'],
  },
];

// ─── Public API ─────────────────────────────────────────────

/**
 * Search FAQ entries by keyword matching.
 * In production, use vector similarity search via pgvector.
 */
export function searchFAQ(
  query: string,
  jurisdiction?: 'china' | 'thailand',
): FAQEntry[] {
  const lowerQuery = query.toLowerCase();

  return FAQ_SEED.filter((entry) => {
    if (jurisdiction && entry.jurisdiction !== 'both' && entry.jurisdiction !== jurisdiction) {
      return false;
    }
    return (
      entry.question.toLowerCase().includes(lowerQuery) ||
      entry.answer.toLowerCase().includes(lowerQuery) ||
      entry.category.toLowerCase().includes(lowerQuery) ||
      entry.lawReferences.some((ref) => ref.toLowerCase().includes(lowerQuery))
    );
  });
}
