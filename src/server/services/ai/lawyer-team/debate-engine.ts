/**
 * AI Lawyer Team — Multi-Round Debate Engine
 * Orchestrates sequential LLM calls for each lawyer role per round.
 * Requirements: 23.3, 23.6, 23.7
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';
import {
  ALL_ROLES,
  getAgent,
  type LawyerRole,
  type DebateRound,
  type DebateArgument,
} from './roles';

// ─── Constants ──────────────────────────────────────────────

const SINGLE_ROUND_TIMEOUT_MS = 30_000;
const TOTAL_DEBATE_TIMEOUT_MS = 120_000;

// ─── Debate State ───────────────────────────────────────────

interface DebateState {
  id: string;
  caseInfo: CaseSubmission;
  rounds: DebateRound[];
  startedAt: number;
}

const debateStore = new Map<string, DebateState>();

// ─── Helpers ────────────────────────────────────────────────

function generateDebateId(): string {
  return `debate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatCaseContext(caseInfo: CaseSubmission): string {
  return [
    `案件类型: ${caseInfo.caseType}`,
    `法域: ${caseInfo.jurisdiction === 'china' ? '中国' : '泰国'}`,
    `案件事实:\n${caseInfo.facts}`,
    `证据:\n${caseInfo.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
    `法律依据:\n${caseInfo.legalBasis.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
  ].join('\n\n');
}

function formatPreviousRound(round: DebateRound): string {
  return round.arguments
    .map((a) => {
      const agent = getAgent(a.role);
      let text = `【${agent.name}】论点：${a.argument}`;
      if (a.rebuttal) text += `\n反驳：${a.rebuttal}`;
      if (a.newEvidence) text += `\n新证据：${a.newEvidence}`;
      return text;
    })
    .join('\n\n');
}

function parseArgument(raw: string, role: LawyerRole): DebateArgument {
  try {
    const parsed = JSON.parse(raw);
    return {
      role,
      argument: typeof parsed.argument === 'string' ? parsed.argument : raw,
      rebuttal: typeof parsed.rebuttal === 'string' ? parsed.rebuttal : undefined,
      newEvidence: typeof parsed.newEvidence === 'string' ? parsed.newEvidence : undefined,
    };
  } catch {
    return { role, argument: raw };
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

// ─── Core Debate Logic ──────────────────────────────────────

async function executeRound(
  roundNumber: number,
  caseInfo: CaseSubmission,
  previousRounds: DebateRound[],
): Promise<DebateRound> {
  const gateway = getLLMGateway();
  const caseContext = formatCaseContext(caseInfo);
  const args: DebateArgument[] = [];

  const prevContext =
    previousRounds.length > 0
      ? previousRounds.map((r) => `--- 第 ${r.roundNumber} 轮 ---\n${formatPreviousRound(r)}`).join('\n\n')
      : '';

  // Accumulate arguments within this round so each role sees prior roles' output
  for (const role of ALL_ROLES) {
    const agent = getAgent(role);

    const withinRoundContext =
      args.length > 0
        ? '\n\n本轮已有论点：\n' +
          args.map((a) => `【${getAgent(a.role).name}】${a.argument}`).join('\n')
        : '';

    const userContent = [
      `案件信息：\n${caseContext}`,
      prevContext ? `历史辩论记录：\n${prevContext}` : '',
      withinRoundContext,
      roundNumber === 1
        ? '这是第一轮辩论，请从你的角色视角提出核心论点。'
        : `这是第 ${roundNumber} 轮辩论，请针对上一轮其他角色的论点进行反驳，并补充新论据。rebuttal 字段必须包含对其他角色论点的具体反驳。`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const messages: LLMMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: userContent },
    ];

    const response = await withTimeout(
      gateway.chat(messages, { temperature: 0.4, responseFormat: 'json_object' }),
      SINGLE_ROUND_TIMEOUT_MS,
    );

    args.push(parseArgument(response.content, role));
  }

  return { roundNumber, arguments: args };
}

// ─── Timeout Helper ─────────────────────────────────────────

function appendTimeoutNote(rounds: DebateRound[]): void {
  const last = rounds[rounds.length - 1];
  if (!last) return;
  last.arguments.push({
    role: 'LEGAL_ADVISOR',
    argument: '辩论因时间限制提前结束。以上为已完成轮次的辩论记录。',
  });
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Start a multi-round debate among all 4 lawyer roles.
 * Each role's input includes the previous role's output (sequential LLM calls).
 * Timeout: 30s per role call, 120s total.
 * On timeout, returns completed rounds with a note.
 */
export async function startDebate(
  caseInfo: CaseSubmission,
  rounds: number,
): Promise<{ debateId: string; rounds: DebateRound[] }> {
  const debateId = generateDebateId();
  const completedRounds: DebateRound[] = [];
  const startedAt = Date.now();

  for (let i = 1; i <= rounds; i++) {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= TOTAL_DEBATE_TIMEOUT_MS) {
      // Timeout — return what we have with a note
      appendTimeoutNote(completedRounds);
      break;
    }

    try {
      const round = await executeRound(i, caseInfo, completedRounds);
      completedRounds.push(round);
    } catch (err) {
      if ((err as Error).message === 'TIMEOUT') {
        appendTimeoutNote(completedRounds);
        break;
      }
      throw err;
    }
  }

  debateStore.set(debateId, { id: debateId, caseInfo, rounds: completedRounds, startedAt });
  return { debateId, rounds: completedRounds };
}

/**
 * Update an existing debate with new facts and re-run remaining rounds.
 */
export async function updateWithNewFacts(
  debateId: string,
  newFacts: string,
): Promise<DebateRound[]> {
  const state = debateStore.get(debateId);
  if (!state) {
    throw new Error(`Debate not found: ${debateId}`);
  }

  const updatedCaseInfo: CaseSubmission = {
    ...state.caseInfo,
    facts: `${state.caseInfo.facts}\n\n【新事实补充】${newFacts}`,
  };

  // Re-run one additional round with updated facts
  const newRound = await executeRound(
    state.rounds.length + 1,
    updatedCaseInfo,
    state.rounds,
  );

  state.rounds.push(newRound);
  state.caseInfo = updatedCaseInfo;
  return state.rounds;
}

/**
 * Get a stored debate by ID.
 */
export function getDebate(debateId: string): DebateState | undefined {
  return debateStore.get(debateId);
}
