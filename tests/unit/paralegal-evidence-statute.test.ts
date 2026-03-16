/**
 * Unit tests for AI Paralegal — Evidence Checklist & Statute Calculator
 * Requirements: 22.5, 22.6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EVIDENCE_CHECKLIST_PROMPT,
  generateEvidenceChecklist,
  type CaseAnalysisResult,
  type EvidenceChecklistItem,
} from '@/server/services/ai/paralegal/evidence-checklist';
import {
  STATUTE_RULES,
  calculateStatuteOfLimitations,
} from '@/server/services/ai/paralegal/statute-calculator';

// ─── Mock LLM Gateway ───────────────────────────────────────

const mockChat = vi.fn();
const mockParseJSON = vi.fn();

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: () => ({
    chat: mockChat,
    parseJSON: mockParseJSON,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Evidence Checklist Tests ───────────────────────────────

describe('Evidence Checklist Generator', () => {
  const sampleCase: CaseAnalysisResult = {
    caseType: 'contract',
    jurisdiction: 'china',
    facts: '甲方与乙方签订买卖合同，乙方未按期交付货物，造成甲方经济损失。',
    parties: ['甲方公司', '乙方公司'],
  };

  it('generates checklist with valid priorities', async () => {
    const items: EvidenceChecklistItem[] = [
      {
        name: '买卖合同原件',
        description: '双方签订的买卖合同，证明合同关系成立',
        priority: 'ESSENTIAL',
        evidenceType: 'documentary',
        collectionSuggestion: '从公司档案室调取合同原件',
        isObtained: false,
      },
      {
        name: '催货函',
        description: '甲方向乙方发送的催货通知',
        priority: 'IMPORTANT',
        evidenceType: 'documentary',
        collectionSuggestion: '从邮件系统导出催货记录',
        isObtained: false,
      },
      {
        name: '行业惯例证明',
        description: '同行业交付时间的惯例说明',
        priority: 'SUPPLEMENTARY',
        evidenceType: 'testimonial',
        collectionSuggestion: '联系行业协会出具证明',
        isObtained: false,
      },
    ];

    mockChat.mockResolvedValue({ content: JSON.stringify(items) });
    mockParseJSON.mockReturnValue(items);

    const result = await generateEvidenceChecklist(sampleCase);

    expect(result).toHaveLength(3);
    result.forEach((item) => {
      expect(['ESSENTIAL', 'IMPORTANT', 'SUPPLEMENTARY']).toContain(item.priority);
    });
  });

  it('each item has name, description, evidenceType, collectionSuggestion', async () => {
    const items: EvidenceChecklistItem[] = [
      {
        name: '合同文本',
        description: '证明合同关系',
        priority: 'ESSENTIAL',
        evidenceType: 'documentary',
        collectionSuggestion: '从档案调取',
        isObtained: false,
      },
    ];

    mockChat.mockResolvedValue({ content: JSON.stringify(items) });
    mockParseJSON.mockReturnValue(items);

    const result = await generateEvidenceChecklist(sampleCase);

    expect(result).toHaveLength(1);
    const item = result[0]!;
    expect(item.name).toBeTruthy();
    expect(item.description).toBeTruthy();
    expect(item.evidenceType).toBeTruthy();
    expect(item.collectionSuggestion).toBeTruthy();
    expect(item.isObtained).toBe(false);
  });

  it('handles LLM failure gracefully', async () => {
    mockChat.mockRejectedValue(new Error('LLM service unavailable'));

    const result = await generateEvidenceChecklist(sampleCase);

    expect(result).toEqual([]);
  });

  it('handles parse failure gracefully', async () => {
    mockChat.mockResolvedValue({ content: 'not json' });
    mockParseJSON.mockImplementation(() => {
      throw new Error('Failed to parse');
    });

    const result = await generateEvidenceChecklist(sampleCase);

    expect(result).toEqual([]);
  });

  it('normalizes invalid priority to SUPPLEMENTARY', async () => {
    const items = [
      {
        name: '证据',
        description: '描述',
        priority: 'INVALID_PRIORITY',
        evidenceType: 'documentary',
        collectionSuggestion: '建议',
        isObtained: false,
      },
    ];

    mockChat.mockResolvedValue({ content: JSON.stringify(items) });
    mockParseJSON.mockReturnValue(items);

    const result = await generateEvidenceChecklist(sampleCase);

    expect(result[0]!.priority).toBe('SUPPLEMENTARY');
  });

  it('system prompt contains required instructions', () => {
    expect(EVIDENCE_CHECKLIST_PROMPT).toContain('ESSENTIAL');
    expect(EVIDENCE_CHECKLIST_PROMPT).toContain('IMPORTANT');
    expect(EVIDENCE_CHECKLIST_PROMPT).toContain('SUPPLEMENTARY');
    expect(EVIDENCE_CHECKLIST_PROMPT).toContain('evidenceType');
    expect(EVIDENCE_CHECKLIST_PROMPT).toContain('collectionSuggestion');
    expect(EVIDENCE_CHECKLIST_PROMPT).toContain('priority');
    expect(EVIDENCE_CHECKLIST_PROMPT).toContain('JSON');
  });
});

// ─── Statute Calculator Tests ───────────────────────────────

describe('Statute of Limitations Calculator', () => {
  it('China general civil: 3 years limitation', async () => {
    const result = await calculateStatuteOfLimitations('general-civil', 'china', new Date('2024-01-01'));

    expect(result.limitationYears).toBe(3);
    expect(result.legalBasis).toContain('民法典');
    expect(result.legalBasis).toContain('188');
  });

  it('Thailand general civil: 10 years limitation', async () => {
    const result = await calculateStatuteOfLimitations('general-civil', 'thailand', new Date('2024-01-01'));

    expect(result.limitationYears).toBe(10);
    expect(result.legalBasis).toContain('193/30');
  });

  it('correctly calculates expiry date', async () => {
    const startDate = new Date('2024-06-15');
    const result = await calculateStatuteOfLimitations('contract', 'china', startDate);

    expect(result.expiryDate.getFullYear()).toBe(2027);
    expect(result.expiryDate.getMonth()).toBe(5); // June = 5
    expect(result.expiryDate.getDate()).toBe(15);
  });

  it('correctly calculates remaining days', async () => {
    // Use a future start date so it's not expired
    const futureStart = new Date();
    futureStart.setFullYear(futureStart.getFullYear() + 1);

    const result = await calculateStatuteOfLimitations('contract', 'china', futureStart);

    // 3 years from a date 1 year in the future = ~2 years remaining
    expect(result.remainingDays).toBeGreaterThan(0);
    expect(result.isExpired).toBe(false);
  });

  it('isExpired = true for past dates', async () => {
    const pastDate = new Date('2018-01-01');
    const result = await calculateStatuteOfLimitations('contract', 'china', pastDate);

    expect(result.isExpired).toBe(true);
    expect(result.remainingDays).toBe(0);
  });

  it('reminder dates include 30, 7, 1 day before expiry', async () => {
    const startDate = new Date('2024-01-01');
    const result = await calculateStatuteOfLimitations('contract', 'china', startDate);

    expect(result.reminderDates).toHaveLength(3);

    const expiryTime = result.expiryDate.getTime();
    const msPerDay = 24 * 60 * 60 * 1000;

    // 30 days before
    const diff30 = Math.round((expiryTime - result.reminderDates[0]!.getTime()) / msPerDay);
    expect(diff30).toBe(30);

    // 7 days before
    const diff7 = Math.round((expiryTime - result.reminderDates[1]!.getTime()) / msPerDay);
    expect(diff7).toBe(7);

    // 1 day before
    const diff1 = Math.round((expiryTime - result.reminderDates[2]!.getTime()) / msPerDay);
    expect(diff1).toBe(1);
  });

  it('same input always returns same result (deterministic)', async () => {
    const startDate = new Date('2024-03-15');
    const result1 = await calculateStatuteOfLimitations('contract', 'thailand', startDate);
    const result2 = await calculateStatuteOfLimitations('contract', 'thailand', startDate);

    expect(result1.limitationYears).toBe(result2.limitationYears);
    expect(result1.expiryDate.getTime()).toBe(result2.expiryDate.getTime());
    expect(result1.legalBasis).toBe(result2.legalBasis);
    expect(result1.reminderDates[0]!.getTime()).toBe(result2.reminderDates[0]!.getTime());
    expect(result1.reminderDates[1]!.getTime()).toBe(result2.reminderDates[1]!.getTime());
    expect(result1.reminderDates[2]!.getTime()).toBe(result2.reminderDates[2]!.getTime());
  });

  it('unknown case type falls back to default rule', async () => {
    const result = await calculateStatuteOfLimitations('unknown-type', 'china', new Date('2024-01-01'));

    // Should use China default: 3 years
    expect(result.limitationYears).toBe(3);
    expect(result.legalBasis).toContain('民法典');
  });

  it('STATUTE_RULES contains expected case types', () => {
    // China rules
    expect(STATUTE_RULES['china']!['general-civil']!.years).toBe(3);
    expect(STATUTE_RULES['china']!['personal-injury']!.years).toBe(3);
    expect(STATUTE_RULES['china']!['contract']!.years).toBe(3);
    expect(STATUTE_RULES['china']!['labor-dispute']!.years).toBe(1);
    expect(STATUTE_RULES['china']!['ip']!.years).toBe(3);

    // Thailand rules
    expect(STATUTE_RULES['thailand']!['general-civil']!.years).toBe(10);
    expect(STATUTE_RULES['thailand']!['personal-injury']!.years).toBe(3);
    expect(STATUTE_RULES['thailand']!['contract']!.years).toBe(10);
    expect(STATUTE_RULES['thailand']!['labor-dispute']!.years).toBe(2);
    expect(STATUTE_RULES['thailand']!['tort']!.years).toBe(1);
  });
});
