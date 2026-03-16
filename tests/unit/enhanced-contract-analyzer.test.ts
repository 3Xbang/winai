/**
 * Tests for Enhanced Contract Analyzer
 * Tasks 28.1, 28.4, 28.6
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
  scoreClauseRisks,
  detectMissingClauses,
} from '@/server/services/ai/contract/enhanced-analyzer';

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── scoreClauseRisks Tests ─────────────────────────────────

describe('scoreClauseRisks', () => {
  it('returns clause scores with computed overallScore', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        clauses: [
          {
            clauseIndex: 1,
            clauseText: '甲方应在30日内交付货物',
            scores: { legalCompliance: 80, fairness: 70, enforceability: 90, completeness: 60 },
          },
          {
            clauseIndex: 2,
            clauseText: '违约金为合同总额的20%',
            scores: { legalCompliance: 60, fairness: 40, enforceability: 70, completeness: 50 },
          },
        ],
      }),
    });

    const result = await scoreClauseRisks('合同内容...', '中国');
    expect(result).toHaveLength(2);
    expect(result[0].overallScore).toBe(75); // (80+70+90+60)/4
    expect(result[1].overallScore).toBe(55); // (60+40+70+50)/4
    expect(result[0].scores.legalCompliance).toBe(80);
  });

  it('clamps scores to 0-100', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        clauses: [{
          clauseIndex: 1,
          clauseText: 'test',
          scores: { legalCompliance: 150, fairness: -10, enforceability: 50, completeness: 200 },
        }],
      }),
    });

    const result = await scoreClauseRisks('test', '中国');
    expect(result[0].scores.legalCompliance).toBe(100);
    expect(result[0].scores.fairness).toBe(0);
    expect(result[0].scores.completeness).toBe(100);
  });

  it('returns empty array on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await scoreClauseRisks('test', '中国');
    expect(result).toEqual([]);
  });
});

// ─── detectMissingClauses Tests ─────────────────────────────

describe('detectMissingClauses', () => {
  it('returns missing clauses with legal basis', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        missingClauses: [
          {
            clauseType: '不可抗力条款',
            importance: 'CRITICAL',
            recommendedText: '因不可抗力导致合同无法履行...',
            legalBasis: [{ lawName: '合同法', article: '第117条' }],
          },
          {
            clauseType: '保密条款',
            importance: 'IMPORTANT',
            recommendedText: '双方应对合同内容保密...',
            legalBasis: [],
          },
        ],
      }),
    });

    const result = await detectMissingClauses('合同内容...', '技术服务合同');
    expect(result).toHaveLength(2);
    expect(result[0].clauseType).toBe('不可抗力条款');
    expect(result[0].importance).toBe('CRITICAL');
    expect(result[0].legalBasis).toHaveLength(1);
    expect(result[1].importance).toBe('IMPORTANT');
  });

  it('defaults invalid importance to RECOMMENDED', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        missingClauses: [{
          clauseType: '测试条款',
          importance: 'INVALID',
          recommendedText: '...',
          legalBasis: [],
        }],
      }),
    });

    const result = await detectMissingClauses('test', '租赁合同');
    expect(result[0].importance).toBe('RECOMMENDED');
  });

  it('returns empty array on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await detectMissingClauses('test', '租赁合同');
    expect(result).toEqual([]);
  });
});


import {
  detectUnfairTerms,
  crossReferenceWithLaw,
} from '@/server/services/ai/contract/enhanced-analyzer';

// ─── detectUnfairTerms Tests ────────────────────────────────

describe('detectUnfairTerms', () => {
  it('returns unfair terms with levels and alternatives', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        unfairTerms: [
          {
            clauseIndex: 3,
            clauseText: '甲方可随时终止合同，乙方不得终止',
            unfairnessLevel: 'SEVERE',
            explanation: '单方面终止权不对等',
            balancedAlternative: '双方均可提前30日书面通知终止合同',
          },
          {
            clauseIndex: 5,
            clauseText: '违约金仅适用于乙方',
            unfairnessLevel: 'MODERATE',
            explanation: '违约责任不对称',
            balancedAlternative: '双方违约均应承担违约金',
          },
        ],
      }),
    });

    const result = await detectUnfairTerms('合同内容...');
    expect(result).toHaveLength(2);
    expect(result[0].unfairnessLevel).toBe('SEVERE');
    expect(result[0].balancedAlternative).toBeTruthy();
    expect(result[1].unfairnessLevel).toBe('MODERATE');
  });

  it('defaults invalid unfairnessLevel to MINOR', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        unfairTerms: [{
          clauseIndex: 1,
          clauseText: 'test',
          unfairnessLevel: 'INVALID',
          explanation: '',
          balancedAlternative: '',
        }],
      }),
    });

    const result = await detectUnfairTerms('test');
    expect(result[0].unfairnessLevel).toBe('MINOR');
  });

  it('returns empty array on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await detectUnfairTerms('test');
    expect(result).toEqual([]);
  });
});

// ─── crossReferenceWithLaw Tests ────────────────────────────

describe('crossReferenceWithLaw', () => {
  it('returns cross-references with compliance status', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        references: [
          {
            clauseIndex: 1,
            clauseText: '竞业限制期限为5年',
            relatedLaws: [{ lawName: '劳动合同法', article: '第24条' }],
            complianceStatus: 'NON_COMPLIANT',
            analysis: '竞业限制期限不得超过2年',
          },
        ],
      }),
    });

    const result = await crossReferenceWithLaw('合同内容...', '中国');
    expect(result).toHaveLength(1);
    expect(result[0].complianceStatus).toBe('NON_COMPLIANT');
    expect(result[0].relatedLaws).toHaveLength(1);
    expect(result[0].analysis).toBeTruthy();
  });

  it('defaults invalid complianceStatus to UNCERTAIN', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        references: [{
          clauseIndex: 1,
          clauseText: 'test',
          relatedLaws: [],
          complianceStatus: 'UNKNOWN',
          analysis: '',
        }],
      }),
    });

    const result = await crossReferenceWithLaw('test', '中国');
    expect(result[0].complianceStatus).toBe('UNCERTAIN');
  });

  it('returns empty array on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await crossReferenceWithLaw('test', '中国');
    expect(result).toEqual([]);
  });
});


import {
  compareContracts,
  getNegotiationAdvice,
} from '@/server/services/ai/contract/enhanced-analyzer';

// ─── compareContracts Tests ─────────────────────────────────

describe('compareContracts', () => {
  it('returns additions, deletions, and modifications', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        additions: [{ clauseIndex: 5, newText: '新增保密条款', changeType: 'ADDED', legalImpact: '增强保护', riskChange: 'DECREASED' }],
        deletions: [{ clauseIndex: 3, oldText: '旧违约条款', changeType: 'DELETED', legalImpact: '减少保护', riskChange: 'INCREASED' }],
        modifications: [{ clauseIndex: 1, oldText: '原文', newText: '修改后', changeType: 'MODIFIED', legalImpact: '中性', riskChange: 'NEUTRAL' }],
        legalImpactSummary: '整体风险中性',
      }),
    });

    const result = await compareContracts('v1', 'v2');
    expect(result.additions).toHaveLength(1);
    expect(result.deletions).toHaveLength(1);
    expect(result.modifications).toHaveLength(1);
    expect(result.additions[0].riskChange).toBe('DECREASED');
    expect(result.legalImpactSummary).toBe('整体风险中性');
  });

  it('returns empty on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await compareContracts('v1', 'v2');
    expect(result.additions).toEqual([]);
    expect(result.deletions).toEqual([]);
    expect(result.modifications).toEqual([]);
  });
});

// ─── getNegotiationAdvice Tests ─────────────────────────────

describe('getNegotiationAdvice', () => {
  it('returns advice with concessions and bottom line', async () => {
    mockGateway.chat.mockResolvedValue({
      content: JSON.stringify({
        advice: [
          {
            clauseIndex: 2,
            suggestedPosition: '要求将违约金降至10%',
            acceptableConcessions: ['可接受12%', '可接受附加条件'],
            bottomLine: '不超过15%',
          },
        ],
      }),
    });

    const result = await getNegotiationAdvice('合同内容', '乙方');
    expect(result).toHaveLength(1);
    expect(result[0].suggestedPosition).toBeTruthy();
    expect(result[0].acceptableConcessions).toHaveLength(2);
    expect(result[0].bottomLine).toBe('不超过15%');
  });

  it('returns empty on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('fail'));
    const result = await getNegotiationAdvice('test', '甲方');
    expect(result).toEqual([]);
  });
});
