/**
 * Unit tests for AI Lawyer Team — Consensus Report & Role Consultation
 * Requirements: 23.4, 23.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateConsensusReport,
  consultRole,
} from '@/server/services/ai/lawyer-team/consensus';
import type { DebateRound } from '@/server/services/ai/lawyer-team/roles';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';

// ─── Mock LLM Gateway ───────────────────────────────────────

const mockChat = vi.fn();

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: () => ({
    chat: mockChat,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Test Data ──────────────────────────────────────────────

const sampleCase: CaseSubmission = {
  caseType: 'contract',
  jurisdiction: 'china',
  facts: '甲方与乙方签订买卖合同，乙方未按期交付货物。',
  evidence: ['买卖合同原件'],
  legalBasis: ['《民法典》第577条'],
};

const sampleRounds: DebateRound[] = [
  {
    roundNumber: 1,
    arguments: [
      { role: 'PLAINTIFF_LAWYER', argument: '原告论点...' },
      { role: 'DEFENDANT_LAWYER', argument: '被告论点...' },
      { role: 'JUDGE', argument: '法官分析...' },
      { role: 'LEGAL_ADVISOR', argument: '顾问建议...' },
    ],
  },
];

const sampleConsensusJSON = {
  roleViewpoints: [
    { role: 'PLAINTIFF_LAWYER', coreArguments: ['证据充分支持原告主张'] },
    { role: 'DEFENDANT_LAWYER', coreArguments: ['程序存在瑕疵'] },
    { role: 'JUDGE', coreArguments: ['法律适用明确'] },
    { role: 'LEGAL_ADVISOR', coreArguments: ['建议和解'] },
  ],
  multiAngleAnalysis: '综合分析：各角色从不同视角分析了案件...',
  consensusConclusions: ['原告主张有法律依据', '建议先尝试调解'],
  disagreementPoints: ['赔偿金额存在分歧'],
  unifiedStrategy: '建议先进行调解，如调解失败再提起诉讼。',
};

// ─── Tests ──────────────────────────────────────────────────

describe('Consensus Report', () => {
  it('generates report with all required fields', async () => {
    mockChat.mockResolvedValue({
      content: JSON.stringify(sampleConsensusJSON),
      model: 'gpt-4',
      provider: 'openai',
    });

    const report = await generateConsensusReport(sampleRounds);

    expect(report.roleViewpoints).toHaveLength(4);
    expect(report.multiAngleAnalysis).toBeTruthy();
    expect(report.consensusConclusions.length).toBeGreaterThan(0);
    expect(report.disagreementPoints.length).toBeGreaterThan(0);
    expect(report.unifiedStrategy).toBeTruthy();
  });

  it('roleViewpoints contain all 4 roles with non-empty coreArguments', async () => {
    mockChat.mockResolvedValue({
      content: JSON.stringify(sampleConsensusJSON),
      model: 'gpt-4',
      provider: 'openai',
    });

    const report = await generateConsensusReport(sampleRounds);
    const roles = report.roleViewpoints.map((v) => v.role);

    expect(roles).toContain('PLAINTIFF_LAWYER');
    expect(roles).toContain('DEFENDANT_LAWYER');
    expect(roles).toContain('JUDGE');
    expect(roles).toContain('LEGAL_ADVISOR');

    for (const vp of report.roleViewpoints) {
      expect(vp.coreArguments.length).toBeGreaterThan(0);
    }
  });

  it('handles LLM failure gracefully', async () => {
    mockChat.mockRejectedValue(new Error('LLM unavailable'));

    const report = await generateConsensusReport(sampleRounds);

    expect(report.roleViewpoints).toEqual([]);
    expect(report.multiAngleAnalysis).toBe('');
    expect(report.consensusConclusions).toEqual([]);
    expect(report.unifiedStrategy).toBe('');
  });

  it('handles malformed JSON gracefully', async () => {
    mockChat.mockResolvedValue({
      content: 'not valid json',
      model: 'gpt-4',
      provider: 'openai',
    });

    const report = await generateConsensusReport(sampleRounds);

    expect(report.roleViewpoints).toEqual([]);
    expect(report.multiAngleAnalysis).toBe('');
  });
});

describe('Role Consultation', () => {
  it('returns analysis from specified role', async () => {
    mockChat.mockResolvedValue({
      content: '从原告律师角度分析，本案证据充分...',
      model: 'gpt-4',
      provider: 'openai',
    });

    const result = await consultRole('PLAINTIFF_LAWYER', sampleCase);

    expect(result).toContain('证据充分');
    expect(mockChat).toHaveBeenCalledTimes(1);

    // Verify system prompt is the role's prompt
    const messages = mockChat.mock.calls[0][0];
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('原告律师');
  });

  it('uses correct system prompt for each role', async () => {
    mockChat.mockResolvedValue({ content: '分析结果', model: 'gpt-4', provider: 'openai' });

    await consultRole('JUDGE', sampleCase);

    const messages = mockChat.mock.calls[0][0];
    expect(messages[0].content).toContain('法官');
    expect(messages[0].content).toContain('裁判一致性');
  });

  it('handles LLM failure with fallback message', async () => {
    mockChat.mockRejectedValue(new Error('LLM unavailable'));

    const result = await consultRole('LEGAL_ADVISOR', sampleCase);

    expect(result).toContain('法律顾问');
    expect(result).toContain('不可用');
  });
});
