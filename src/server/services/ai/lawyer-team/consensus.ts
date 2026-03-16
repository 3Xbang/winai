/**
 * AI Lawyer Team — Consensus Report & Role Consultation
 * Generates unified strategy reports from debate rounds and provides single-role deep analysis.
 * Requirements: 23.4, 23.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { CaseSubmission } from '@/server/services/ai/paralegal/case-scorer';
import {
  getAgent,
  type LawyerRole,
  type DebateRound,
  type ConsensusReport,
} from './roles';

// ─── Prompts ────────────────────────────────────────────────

const CONSENSUS_PROMPT = `你是一位资深法律分析专家，负责综合多位律师角色的辩论记录，生成统一的策略报告。

请分析以下辩论记录，生成 JSON 格式的共识报告，包含以下字段：
- "roleViewpoints": 数组，每个元素包含 "role"（角色标识）和 "coreArguments"（核心论点数组，至少一条）
- "multiAngleAnalysis": 多角度综合分析（详细分析各角色观点的异同和互补之处）
- "consensusConclusions": 共识结论数组（各角色达成一致的结论）
- "disagreementPoints": 分歧点数组（各角色存在分歧的问题）
- "unifiedStrategy": 统一策略建议（综合各角色观点后的最终策略建议）

要求：
- roleViewpoints 必须包含所有参与辩论的角色
- 每个角色的 coreArguments 至少包含一条核心论点
- multiAngleAnalysis、consensusConclusions、unifiedStrategy 不得为空
- 仅输出 JSON 对象`;

// ─── Helpers ────────────────────────────────────────────────

function formatDebateHistory(rounds: DebateRound[]): string {
  return rounds
    .map((r) => {
      const args = r.arguments
        .map((a) => {
          const agent = getAgent(a.role);
          let text = `【${agent.name} (${a.role})】论点：${a.argument}`;
          if (a.rebuttal) text += `\n反驳：${a.rebuttal}`;
          return text;
        })
        .join('\n\n');
      return `=== 第 ${r.roundNumber} 轮 ===\n${args}`;
    })
    .join('\n\n');
}

function parseConsensusReport(raw: string): ConsensusReport {
  const DEFAULT: ConsensusReport = {
    roleViewpoints: [],
    multiAngleAnalysis: '',
    consensusConclusions: [],
    disagreementPoints: [],
    unifiedStrategy: '',
  };

  try {
    const parsed = JSON.parse(raw);

    const roleViewpoints = Array.isArray(parsed.roleViewpoints)
      ? (parsed.roleViewpoints as Array<{ role?: string; coreArguments?: unknown[] }>)
          .filter((v) => v && typeof v.role === 'string')
          .map((v) => ({
            role: v.role as LawyerRole,
            coreArguments: Array.isArray(v.coreArguments)
              ? v.coreArguments.filter((a): a is string => typeof a === 'string')
              : [],
          }))
      : [];

    return {
      roleViewpoints,
      multiAngleAnalysis:
        typeof parsed.multiAngleAnalysis === 'string' ? parsed.multiAngleAnalysis : '',
      consensusConclusions: Array.isArray(parsed.consensusConclusions)
        ? parsed.consensusConclusions.filter((c: unknown): c is string => typeof c === 'string')
        : [],
      disagreementPoints: Array.isArray(parsed.disagreementPoints)
        ? parsed.disagreementPoints.filter((d: unknown): d is string => typeof d === 'string')
        : [],
      unifiedStrategy:
        typeof parsed.unifiedStrategy === 'string' ? parsed.unifiedStrategy : '',
    };
  } catch {
    return DEFAULT;
  }
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Generate a consensus report from completed debate rounds.
 * Sends all debate history to LLM for synthesis.
 */
export async function generateConsensusReport(
  debateRounds: DebateRound[],
): Promise<ConsensusReport> {
  const gateway = getLLMGateway();
  const history = formatDebateHistory(debateRounds);

  const messages: LLMMessage[] = [
    { role: 'system', content: CONSENSUS_PROMPT },
    { role: 'user', content: `辩论记录：\n\n${history}` },
  ];

  try {
    const response = await gateway.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
    });
    return parseConsensusReport(response.content);
  } catch {
    return {
      roleViewpoints: [],
      multiAngleAnalysis: '',
      consensusConclusions: [],
      disagreementPoints: [],
      unifiedStrategy: '',
    };
  }
}

/**
 * Consult a specific lawyer role for deep analysis on a case.
 * Uses the role's specialized System Prompt for targeted analysis.
 */
export async function consultRole(
  role: LawyerRole,
  caseInfo: CaseSubmission,
): Promise<string> {
  const gateway = getLLMGateway();
  const agent = getAgent(role);

  const userContent = [
    `请以${agent.name}的专业视角，对以下案件进行深度分析：`,
    `案件类型: ${caseInfo.caseType}`,
    `法域: ${caseInfo.jurisdiction === 'china' ? '中国' : '泰国'}`,
    `案件事实:\n${caseInfo.facts}`,
    `证据:\n${caseInfo.evidence.map((e, i) => `${i + 1}. ${e}`).join('\n')}`,
    `法律依据:\n${caseInfo.legalBasis.map((l, i) => `${i + 1}. ${l}`).join('\n')}`,
    '',
    '请提供详细的分析意见，包括你的核心观点、法律依据和策略建议。以纯文本格式回复。',
  ].join('\n\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: agent.systemPrompt },
    { role: 'user', content: userContent },
  ];

  try {
    const response = await gateway.chat(messages, { temperature: 0.4 });
    return response.content;
  } catch {
    return `${agent.name}分析服务暂时不可用，请稍后重试。`;
  }
}
