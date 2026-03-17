import type { CourtJurisdiction, CourtPhase, DifficultyLevel } from '@prisma/client';
import type { LLMGateway } from '../llm/gateway';
import type { LLMMessage } from '../llm/types';
import type { AIResponse, CourtContext } from '@/types/mock-court';
import {
  JUDGE_SYSTEM_PROMPT,
  OPPOSING_COUNSEL_SYSTEM_PROMPT,
  WITNESS_SYSTEM_PROMPT,
  JURISDICTION_RULES,
  DIFFICULTY_STRATEGIES,
  LANGUAGE_INSTRUCTIONS,
  buildPrompt,
} from './prompts';

export type AICourtRole = 'JUDGE' | 'OPPOSING_COUNSEL' | 'WITNESS';

const ROLE_TEMPLATES: Record<AICourtRole, string> = {
  JUDGE: JUDGE_SYSTEM_PROMPT,
  OPPOSING_COUNSEL: OPPOSING_COUNSEL_SYSTEM_PROMPT,
  WITNESS: WITNESS_SYSTEM_PROMPT,
};

export class CourtAIService {
  constructor(private readonly llm: LLMGateway) {}

  /**
   * Build the system prompt for a given AI role, injecting jurisdiction rules,
   * difficulty strategy (opposing counsel only), language instruction, and
   * filling {{caseConfig}} / {{currentPhase}} placeholders.
   */
  buildSystemPrompt(
    role: AICourtRole,
    config: {
      caseType: string;
      caseDescription: string;
      jurisdiction: CourtJurisdiction;
      difficulty: DifficultyLevel;
    },
    phase: CourtPhase,
    locale: string,
  ): string {
    let prompt = ROLE_TEMPLATES[role];

    // Append jurisdiction rules
    prompt += '\n\n' + JURISDICTION_RULES[config.jurisdiction];

    // Append difficulty strategy for opposing counsel
    if (role === 'OPPOSING_COUNSEL') {
      prompt += '\n\n' + DIFFICULTY_STRATEGIES[config.difficulty];
    }

    // Append language instruction
    const langInstruction = LANGUAGE_INSTRUCTIONS[locale] ?? LANGUAGE_INSTRUCTIONS['zh'];
    prompt += '\n\n' + langInstruction;

    // Fill placeholders
    const caseConfigStr = [
      `案件类型 (Case Type): ${config.caseType}`,
      `管辖区 (Jurisdiction): ${config.jurisdiction}`,
      `难度等级 (Difficulty): ${config.difficulty}`,
      ``,
      `案情描述 (Case Description):`,
      config.caseDescription,
    ].join('\n');

    return buildPrompt(prompt, {
      caseConfig: caseConfigStr,
      currentPhase: phase,
    });
  }

  /** Generate a judge response for the given court context. */
  async generateJudgeResponse(context: CourtContext): Promise<AIResponse> {
    return this.generateResponse('JUDGE', context);
  }

  /** Generate an opposing counsel response for the given court context. */
  async generateOpposingCounselResponse(context: CourtContext): Promise<AIResponse> {
    return this.generateResponse('OPPOSING_COUNSEL', context);
  }

  /** Generate a witness response for the given court context. */
  async generateWitnessResponse(context: CourtContext): Promise<AIResponse> {
    return this.generateResponse('WITNESS', context);
  }

  /** Stream AI response chunks for a given role and context. */
  async *streamResponse(
    role: AICourtRole,
    context: CourtContext,
  ): AsyncIterable<{ role: string; content: string; phase: CourtPhase; done: boolean }> {
    const messages = this.buildMessages(role, context);

    for await (const chunk of this.llm.chatStream(messages)) {
      yield {
        role,
        content: chunk.content,
        phase: context.currentPhase,
        done: chunk.done,
      };
    }
  }

  // ─── Private helpers ──────────────────────────────────────

  private async generateResponse(role: AICourtRole, context: CourtContext): Promise<AIResponse> {
    const messages = this.buildMessages(role, context);
    const response = await this.llm.chat(messages);

    return {
      role,
      content: response.content,
      phase: context.currentPhase,
    };
  }

  private buildMessages(role: AICourtRole, context: CourtContext): LLMMessage[] {
    const systemPrompt = this.buildSystemPrompt(
      role,
      context.caseConfig,
      context.currentPhase,
      context.locale,
    );

    const messages: LLMMessage[] = [{ role: 'system', content: systemPrompt }];

    // Append conversation history
    for (const msg of context.messages) {
      messages.push({
        role: msg.senderRole === 'USER' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    return messages;
  }
}
