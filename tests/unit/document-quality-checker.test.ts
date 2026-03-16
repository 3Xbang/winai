/**
 * Tests for Document Quality Checker
 * Task 30.5 — 术语一致性检查与法域合规性检查
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: vi.fn(() => mockGateway),
}));

const mockGateway = {
  chat: vi.fn(),
  parseJSON: vi.fn((resp: { content: string }) => JSON.parse(resp.content)),
};

import {
  checkTerminologyConsistency,
  checkJurisdictionCompliance,
} from '@/server/services/ai/document/quality-checker';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkTerminologyConsistency', () => {
  it('detects inconsistent terminology', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        isConsistent: false,
        inconsistencies: [{
          term: '违约金',
          variants: ['违约金', '违约赔偿金'],
          suggestedUniform: '违约金',
          locations: ['第3条', '第7条'],
        }],
      }),
    });

    const result = await checkTerminologyConsistency('文书内容');
    expect(result.isConsistent).toBe(false);
    expect(result.inconsistencies).toHaveLength(1);
    expect(result.inconsistencies[0].variants).toHaveLength(2);
    expect(result.inconsistencies[0].suggestedUniform).toBe('违约金');
  });

  it('returns consistent when no issues found', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({ isConsistent: true, inconsistencies: [] }),
    });

    const result = await checkTerminologyConsistency('文书内容');
    expect(result.isConsistent).toBe(true);
    expect(result.inconsistencies).toHaveLength(0);
  });

  it('returns consistent on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await checkTerminologyConsistency('test');
    expect(result.isConsistent).toBe(true);
  });
});

describe('checkJurisdictionCompliance', () => {
  it('detects compliance issues', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        isCompliant: false,
        issues: [{
          section: '诉讼请求',
          issue: '缺少具体金额',
          requirement: '中国民事诉讼法要求诉讼请求明确具体',
          suggestion: '请补充具体赔偿金额',
        }],
      }),
    });

    const result = await checkJurisdictionCompliance('文书内容', '中国');
    expect(result.isCompliant).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].section).toBe('诉讼请求');
    expect(result.issues[0].suggestion).toBeTruthy();
    expect(result.jurisdiction).toBe('中国');
  });

  it('returns compliant when no issues', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({ isCompliant: true, issues: [] }),
    });

    const result = await checkJurisdictionCompliance('文书内容', '泰国');
    expect(result.isCompliant).toBe(true);
    expect(result.jurisdiction).toBe('泰国');
  });

  it('returns compliant on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await checkJurisdictionCompliance('test', '中国');
    expect(result.isCompliant).toBe(true);
  });
});
