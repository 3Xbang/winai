/**
 * Unit tests for AI Lawyer Team — Debate Engine
 * Requirements: 23.3, 23.6, 23.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { startDebate, updateWithNewFacts } from '@/server/services/ai/lawyer-team/debate-engine';
import { ALL_ROLES } from '@/server/services/ai/lawyer-team/roles';
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
  evidence: ['买卖合同原件', '催货函'],
  legalBasis: ['《民法典》第577条'],
};

function mockLLMResponse(role: string, round: number) {
  const base: Record<string, unknown> = {
    argument: `${role} 第${round}轮论点：基于案件事实分析...`,
  };
  if (round > 1) {
    base.rebuttal = `${role} 对上一轮论点的反驳...`;
  }
  return { content: JSON.stringify(base), model: 'gpt-4', provider: 'openai' };
}

// ─── Tests ──────────────────────────────────────────────────

describe('Debate Engine', () => {
  it('startDebate returns debateId and rounds', async () => {
    let callIndex = 0;
    mockChat.mockImplementation(() => {
      const roleIdx = callIndex % 4;
      const roundNum = Math.floor(callIndex / 4) + 1;
      callIndex++;
      return Promise.resolve(mockLLMResponse(ALL_ROLES[roleIdx], roundNum));
    });

    const result = await startDebate(sampleCase, 2);

    expect(result.debateId).toBeTruthy();
    expect(result.debateId).toMatch(/^debate-/);
    expect(result.rounds).toHaveLength(2);
  });

  it('each round contains arguments from all 4 roles', async () => {
    let callIndex = 0;
    mockChat.mockImplementation(() => {
      const roleIdx = callIndex % 4;
      callIndex++;
      return Promise.resolve(mockLLMResponse(ALL_ROLES[roleIdx], 1));
    });

    const result = await startDebate(sampleCase, 1);
    const round = result.rounds[0];

    expect(round.roundNumber).toBe(1);
    expect(round.arguments).toHaveLength(4);

    const roles = round.arguments.map((a) => a.role);
    expect(roles).toContain('PLAINTIFF_LAWYER');
    expect(roles).toContain('DEFENDANT_LAWYER');
    expect(roles).toContain('JUDGE');
    expect(roles).toContain('LEGAL_ADVISOR');
  });

  it('round 2+ arguments include rebuttal from LLM', async () => {
    let callIndex = 0;
    mockChat.mockImplementation(() => {
      const roleIdx = callIndex % 4;
      const roundNum = Math.floor(callIndex / 4) + 1;
      callIndex++;
      return Promise.resolve(mockLLMResponse(ALL_ROLES[roleIdx], roundNum));
    });

    const result = await startDebate(sampleCase, 2);
    const round2 = result.rounds[1];

    // Round 2 arguments should have rebuttals (from our mock)
    for (const arg of round2.arguments) {
      expect(arg.argument).toBeTruthy();
      expect(arg.rebuttal).toBeTruthy();
    }
  });

  it('round 1 arguments do not require rebuttal', async () => {
    let callIndex = 0;
    mockChat.mockImplementation(() => {
      const roleIdx = callIndex % 4;
      callIndex++;
      return Promise.resolve(mockLLMResponse(ALL_ROLES[roleIdx], 1));
    });

    const result = await startDebate(sampleCase, 1);
    const round1 = result.rounds[0];

    for (const arg of round1.arguments) {
      expect(arg.argument).toBeTruthy();
      // rebuttal is undefined for round 1
      expect(arg.rebuttal).toBeUndefined();
    }
  });

  it('handles LLM returning non-JSON gracefully', async () => {
    mockChat.mockResolvedValue({
      content: '这是一段纯文本论点，不是JSON格式',
      model: 'gpt-4',
      provider: 'openai',
    });

    const result = await startDebate(sampleCase, 1);
    const round = result.rounds[0];

    // Should still produce arguments (fallback to raw text)
    expect(round.arguments).toHaveLength(4);
    for (const arg of round.arguments) {
      expect(arg.argument).toBeTruthy();
    }
  });

  it('updateWithNewFacts adds a new round with updated facts', async () => {
    let callIndex = 0;
    mockChat.mockImplementation(() => {
      const roleIdx = callIndex % 4;
      const roundNum = Math.floor(callIndex / 4) + 1;
      callIndex++;
      return Promise.resolve(mockLLMResponse(ALL_ROLES[roleIdx], roundNum));
    });

    const initial = await startDebate(sampleCase, 1);
    expect(initial.rounds).toHaveLength(1);

    const updated = await updateWithNewFacts(initial.debateId, '发现乙方存在欺诈行为');
    expect(updated).toHaveLength(2);
    expect(updated[1].roundNumber).toBe(2);
    expect(updated[1].arguments).toHaveLength(4);
  });

  it('updateWithNewFacts throws for unknown debateId', async () => {
    await expect(updateWithNewFacts('nonexistent-id', 'new facts')).rejects.toThrow(
      'Debate not found',
    );
  });

  it('sequential LLM calls — each role called with system prompt', async () => {
    let callIndex = 0;
    mockChat.mockImplementation(() => {
      callIndex++;
      return Promise.resolve(mockLLMResponse('role', 1));
    });

    await startDebate(sampleCase, 1);

    // 4 roles × 1 round = 4 LLM calls
    expect(mockChat).toHaveBeenCalledTimes(4);

    // Each call should have system + user messages
    for (let i = 0; i < 4; i++) {
      const messages = mockChat.mock.calls[i][0];
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
    }
  });

  it('handles timeout gracefully by returning completed rounds', async () => {
    let callIndex = 0;
    mockChat.mockImplementation(() => {
      callIndex++;
      if (callIndex > 4) {
        // Simulate timeout on round 2
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('TIMEOUT')), 10);
        });
      }
      return Promise.resolve(mockLLMResponse('role', 1));
    });

    const result = await startDebate(sampleCase, 3);

    // Should have at least round 1 completed
    expect(result.rounds.length).toBeGreaterThanOrEqual(1);
    expect(result.debateId).toBeTruthy();
  });
});
