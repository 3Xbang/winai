/**
 * Tests for Smart QA & FAQ Manager
 * Task 31.1 — 快速问答与深度分析模式
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: vi.fn(() => mockGateway),
}));

const mockGateway = {
  chat: vi.fn(),
  parseJSON: vi.fn((resp: { content: string }) => JSON.parse(resp.content)),
};

import { quickAnswer, deepAnalysis } from '@/server/services/ai/qa/smart-qa';
import { searchFAQ, FAQ_SEED } from '@/server/services/ai/qa/faq-manager';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('quickAnswer', () => {
  it('returns concise answer from LLM', async () => {
    mockGateway.chat.mockResolvedValue({ content: '根据合同法第107条，违约方应承担违约责任。' });
    const result = await quickAnswer({ question: '违约怎么办？', jurisdiction: 'china' });
    expect(result).toContain('违约');
  });

  it('returns empty on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('timeout'));
    const result = await quickAnswer({ question: 'test' });
    expect(result).toBe('');
  });
});

describe('deepAnalysis', () => {
  it('returns five-step analysis result', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        factExtraction: '甲方未交付货物',
        lawApplication: '适用合同法第107条',
        riskAssessment: '胜诉概率较高',
        strategySuggestion: '建议先发律师函',
        actionPlan: ['发送律师函', '收集证据', '提起诉讼'],
      }),
    });

    const result = await deepAnalysis({
      question: '合同违约如何维权？',
      jurisdiction: 'china',
      facts: '甲方未按期交货',
    });

    expect(result.factExtraction).toBeTruthy();
    expect(result.lawApplication).toBeTruthy();
    expect(result.riskAssessment).toBeTruthy();
    expect(result.strategySuggestion).toBeTruthy();
    expect(result.actionPlan.length).toBeGreaterThanOrEqual(1);
  });

  it('returns defaults on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await deepAnalysis({ question: 'test', jurisdiction: 'china' });
    expect(result.factExtraction).toBe('');
    expect(result.actionPlan).toEqual([]);
  });
});

describe('FAQ Manager', () => {
  it('has seed data for both jurisdictions', () => {
    const cnFAQs = FAQ_SEED.filter((f) => f.jurisdiction === 'china');
    const thFAQs = FAQ_SEED.filter((f) => f.jurisdiction === 'thailand');
    expect(cnFAQs.length).toBeGreaterThanOrEqual(1);
    expect(thFAQs.length).toBeGreaterThanOrEqual(1);
  });

  it('each FAQ has law references', () => {
    for (const faq of FAQ_SEED) {
      expect(faq.lawReferences.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('searches by keyword', () => {
    const results = searchFAQ('劳动合同');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].category).toBe('劳动法');
  });

  it('filters by jurisdiction', () => {
    const results = searchFAQ('工作', 'thailand');
    expect(results.every((r) => r.jurisdiction === 'thailand' || r.jurisdiction === 'both')).toBe(true);
  });

  it('returns empty for no match', () => {
    const results = searchFAQ('完全不相关的查询xyz');
    expect(results).toHaveLength(0);
  });
});
