import prisma from '@/lib/prisma';
import type { LLMGateway } from '../llm/gateway';
import type {
  CourtMessageData,
  DimensionScore,
  MockCourtSessionDetail,
  PerformanceReportData,
  ScoreDimension,
} from '@/types/mock-court';

// ==================== Constants ====================

const ALL_DIMENSIONS: ScoreDimension[] = [
  'LEGAL_ARGUMENT',
  'EVIDENCE_USE',
  'PROCEDURE',
  'ADAPTABILITY',
  'EXPRESSION',
];

const DIMENSION_LABELS: Record<ScoreDimension, string> = {
  LEGAL_ARGUMENT: '法律论证质量',
  EVIDENCE_USE: '证据运用能力',
  PROCEDURE: '程序规范性',
  ADAPTABILITY: '应变能力',
  EXPRESSION: '语言表达',
};

const DIMENSION_WEIGHTS: Record<ScoreDimension, number> = {
  LEGAL_ARGUMENT: 0.25,
  EVIDENCE_USE: 0.20,
  PROCEDURE: 0.20,
  ADAPTABILITY: 0.15,
  EXPRESSION: 0.20,
};

// ==================== PerformanceEvaluator ====================

export class PerformanceEvaluator {
  constructor(private readonly llm: LLMGateway) {}

  /**
   * Evaluate a completed mock court session and generate a performance report.
   * Saves the report to the CourtPerformanceReport table.
   */
  async evaluate(session: MockCourtSessionDetail): Promise<PerformanceReportData> {
    const userMessages = session.messages.filter((m) => m.senderRole === 'USER');

    // 1. Evaluate each dimension via LLM
    const dimensionScores: DimensionScore[] = [];
    for (const dimension of ALL_DIMENSIONS) {
      const score = await this.evaluateDimension(dimension, session.messages, {
        caseType: session.caseType,
        caseDescription: session.caseDescription,
        jurisdiction: session.jurisdiction,
        difficulty: session.difficulty,
      });
      dimensionScores.push(score);
    }

    // 2. Calculate overall score
    const overallScore = this.calculateOverallScore(dimensionScores);

    // 3. Extract legal citations from user messages
    const legalCitations = await this.extractLegalCitations(userMessages);

    // 4. Generate improvement suggestions
    const improvements = await this.generateImprovements(userMessages, dimensionScores);

    // 5. Generate overall comment
    const overallComment = await this.generateOverallComment(dimensionScores, overallScore, session);

    // 6. Extract verdict summary
    const verdictSummary = this.extractVerdictSummary(session.messages);

    // 7. Build dimension details JSON for DB storage
    const dimensionDetails: Record<string, { comment: string; strengths: string[]; weaknesses: string[] }> = {};
    for (const ds of dimensionScores) {
      dimensionDetails[ds.dimension] = {
        comment: ds.comment,
        strengths: ds.strengths,
        weaknesses: ds.weaknesses,
      };
    }

    // 8. Save report to DB
    const report = await prisma.courtPerformanceReport.create({
      data: {
        sessionId: session.id,
        legalArgumentScore: this.getDimensionScore(dimensionScores, 'LEGAL_ARGUMENT'),
        evidenceUseScore: this.getDimensionScore(dimensionScores, 'EVIDENCE_USE'),
        procedureScore: this.getDimensionScore(dimensionScores, 'PROCEDURE'),
        adaptabilityScore: this.getDimensionScore(dimensionScores, 'ADAPTABILITY'),
        expressionScore: this.getDimensionScore(dimensionScores, 'EXPRESSION'),
        overallScore,
        overallComment,
        dimensionDetails,
        improvements,
        legalCitations,
        verdictSummary,
      },
    });

    // 9. Mark session as report generated
    await prisma.mockCourtSession.update({
      where: { id: session.id },
      data: { reportGenerated: true },
    });

    return {
      id: report.id,
      sessionId: session.id,
      dimensions: dimensionScores,
      overallScore,
      overallComment,
      improvements,
      legalCitations,
      verdictSummary,
    };
  }

  /**
   * Evaluate a single scoring dimension using LLM.
   */
  async evaluateDimension(
    dimension: ScoreDimension,
    messages: CourtMessageData[],
    config: { caseType: string; caseDescription: string; jurisdiction: string; difficulty: string },
  ): Promise<DimensionScore> {
    const label = DIMENSION_LABELS[dimension];
    const transcript = this.formatTranscript(messages);

    const systemPrompt = `你是一位资深法律教育评估专家，专门评估模拟法庭中参与者的表现。
请根据以下庭审记录，评估用户在"${label}"维度的表现。

评估标准（${label}）：
${this.getDimensionCriteria(dimension)}

案件信息：
- 案件类型：${config.caseType}
- 管辖区：${config.jurisdiction}
- 难度等级：${config.difficulty}

请以 JSON 格式返回评估结果，格式如下：
{
  "score": <1-10的整数>,
  "comment": "<详细评价>",
  "strengths": ["<优点1>", "<优点2>"],
  "weaknesses": ["<不足1>", "<不足2>"]
}

注意：
- 评分范围为 1-10 分，其中 1 为最低，10 为最高
- comment 应详细说明评分理由
- strengths 和 weaknesses 应引用庭审中的具体发言作为示例
- 如果用户没有相关表现，给出合理的默认评价`;

    const userPrompt = `以下是完整的庭审记录：\n\n${transcript}\n\n请评估用户在"${label}"维度的表现。`;

    const response = await this.llm.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { responseFormat: 'json_object', temperature: 0.3 },
    );

    try {
      const parsed = JSON.parse(response.content) as {
        score?: number;
        comment?: string;
        strengths?: string[];
        weaknesses?: string[];
      };

      return {
        dimension,
        score: this.clampScore(parsed.score ?? 5),
        comment: parsed.comment ?? `${label}评估完成`,
        strengths: parsed.strengths ?? [],
        weaknesses: parsed.weaknesses ?? [],
      };
    } catch {
      // Fallback if LLM response is not valid JSON
      return {
        dimension,
        score: 5,
        comment: `${label}评估完成（AI 解析异常，使用默认评分）`,
        strengths: [],
        weaknesses: [],
      };
    }
  }

  /**
   * Calculate the weighted average overall score from dimension scores.
   */
  calculateOverallScore(dimensionScores: DimensionScore[]): number {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const ds of dimensionScores) {
      const weight = DIMENSION_WEIGHTS[ds.dimension] ?? 0;
      weightedSum += ds.score * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return 0;

    // Round to 1 decimal place
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  /**
   * Extract legal citations from user messages and evaluate their accuracy via LLM.
   */
  async extractLegalCitations(
    messages: CourtMessageData[],
  ): Promise<{ citation: string; isAccurate: boolean; correction?: string }[]> {
    if (messages.length === 0) return [];

    const userText = messages.map((m) => m.content).join('\n\n');

    const systemPrompt = `你是一位法律条文引用准确性审查专家。
请从以下用户发言中提取所有引用的法律条文（如《民法典》第XX条、Civil and Commercial Code Section XX 等），
并判断每条引用是否准确。

请以 JSON 格式返回结果：
{
  "citations": [
    {
      "citation": "<引用的法律条文>",
      "isAccurate": true/false,
      "correction": "<如果不准确，给出正确的引用或说明>"
    }
  ]
}

如果用户没有引用任何法律条文，返回空数组：
{ "citations": [] }`;

    const response = await this.llm.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `用户发言内容：\n\n${userText}` },
      ],
      { responseFormat: 'json_object', temperature: 0.2 },
    );

    try {
      const parsed = JSON.parse(response.content) as {
        citations?: { citation: string; isAccurate: boolean; correction?: string }[];
      };
      return (parsed.citations ?? []).map((c) => ({
        citation: c.citation,
        isAccurate: c.isAccurate,
        correction: c.correction,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Generate improvement suggestions referencing specific quotes from the trial.
   */
  async generateImprovements(
    messages: CourtMessageData[],
    dimensionScores: DimensionScore[],
  ): Promise<{ suggestion: string; exampleQuote: string }[]> {
    if (messages.length === 0) return [];

    const userText = messages.map((m) => `[${m.phase}] ${m.content}`).join('\n\n');
    const weaknessSummary = dimensionScores
      .filter((ds) => ds.weaknesses.length > 0)
      .map((ds) => `${DIMENSION_LABELS[ds.dimension]}（${ds.score}分）: ${ds.weaknesses.join('；')}`)
      .join('\n');

    const systemPrompt = `你是一位法律教育专家，请根据用户在模拟法庭中的表现和评估结果，生成具体的改进建议。

每条建议必须引用庭审中用户的具体发言作为示例，说明问题所在并给出改进方向。

请以 JSON 格式返回：
{
  "improvements": [
    {
      "suggestion": "<改进建议>",
      "exampleQuote": "<庭审中用户的具体发言引用>"
    }
  ]
}

生成 3-5 条最重要的改进建议。`;

    const userPrompt = `评估结果中的不足之处：
${weaknessSummary || '暂无明显不足'}

用户在庭审中的发言记录：
${userText}`;

    const response = await this.llm.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { responseFormat: 'json_object', temperature: 0.4 },
    );

    try {
      const parsed = JSON.parse(response.content) as {
        improvements?: { suggestion: string; exampleQuote: string }[];
      };
      return (parsed.improvements ?? []).map((imp) => ({
        suggestion: imp.suggestion,
        exampleQuote: imp.exampleQuote,
      }));
    } catch {
      return [];
    }
  }

  // ─── Private Helpers ──────────────────────────────────────

  /**
   * Generate an overall comment summarizing the performance.
   */
  private async generateOverallComment(
    dimensionScores: DimensionScore[],
    overallScore: number,
    session: MockCourtSessionDetail,
  ): Promise<string> {
    const scoreSummary = dimensionScores
      .map((ds) => `${DIMENSION_LABELS[ds.dimension]}: ${ds.score}/10`)
      .join('、');

    const systemPrompt = `你是一位法律教育评估专家。请根据以下评分结果，生成一段总体评语（100-200字）。
评语应概括用户的整体表现，指出最突出的优点和最需要改进的方面。

请直接返回评语文本，不要使用 JSON 格式。`;

    const userPrompt = `案件类型：${session.caseType}
管辖区：${session.jurisdiction}
难度等级：${session.difficulty}
各维度评分：${scoreSummary}
总分：${overallScore}/10`;

    const response = await this.llm.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.5 },
    );

    return response.content || `总体评分 ${overallScore}/10。`;
  }

  /**
   * Extract the verdict summary from the VERDICT phase messages.
   */
  private extractVerdictSummary(messages: CourtMessageData[]): string {
    const verdictMessages = messages.filter(
      (m) => m.phase === 'VERDICT' && m.senderRole === 'JUDGE',
    );

    if (verdictMessages.length === 0) {
      return '庭审已结束，判决信息未记录。';
    }

    return verdictMessages.map((m) => m.content).join('\n\n');
  }

  /**
   * Get the score for a specific dimension from the scores array.
   */
  private getDimensionScore(scores: DimensionScore[], dimension: ScoreDimension): number {
    return scores.find((s) => s.dimension === dimension)?.score ?? 5;
  }

  /**
   * Clamp a score to the valid range [1, 10].
   */
  private clampScore(score: number): number {
    return Math.max(1, Math.min(10, Math.round(score)));
  }

  /**
   * Format messages into a readable transcript for LLM evaluation.
   */
  private formatTranscript(messages: CourtMessageData[]): string {
    return messages
      .map((m) => {
        const roleLabel = this.getRoleLabel(m.senderRole);
        return `[${m.phase}] ${roleLabel}: ${m.content}`;
      })
      .join('\n\n');
  }

  /**
   * Get a human-readable label for a sender role.
   */
  private getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      USER: '用户（律师）',
      JUDGE: '法官',
      OPPOSING_COUNSEL: '对方律师',
      WITNESS: '证人',
      SYSTEM: '系统',
    };
    return labels[role] ?? role;
  }

  /**
   * Get evaluation criteria description for a dimension.
   */
  private getDimensionCriteria(dimension: ScoreDimension): string {
    const criteria: Record<ScoreDimension, string> = {
      LEGAL_ARGUMENT: `- 法律论点的逻辑性和说服力（是否构建了完整的三段论推理：大前提→小前提→结论）
- 法律条文引用的准确性和相关性（是否正确引用法条编号和内容，是否选择了最相关的法律依据）
- 法律推理的深度和完整性（是否考虑了多种法律解释方法，是否分析了可能的反驳）
- 论点之间的连贯性和层次感（是否形成了系统的论证体系，主次分明）
- 对法律原则的运用（如诚实信用、公平、合同自由、过错责任等基本原则）
- 对跨境法律问题的处理（如法律适用的确定、外国法的查明、条约的援引）`,
      EVIDENCE_USE: `- 证据提交的及时性和策略性（是否在最佳时机提交关键证据）
- 证据与论点的关联性（是否清楚说明每项证据的证明目的）
- 对对方证据的质证能力（是否从真实性、合法性、关联性三个维度进行系统质证）
- 证据链的完整性（是否构建了完整的证据链条，各证据之间是否相互印证）
- 举证责任的理解和运用（是否正确理解举证责任分配规则）
- 电子证据、域外证据等特殊证据的处理能力`,
      PROCEDURE: `- 对庭审程序规则的遵守（是否了解各阶段的程序要求）
- 发言时机的把握（是否在正确的阶段提出相应的主张）
- 异议提出的恰当性（异议理由是否充分，时机是否恰当）
- 对法官指令的配合程度（是否及时响应法官的要求和提问）
- 对程序性权利的运用（如申请回避、申请延期、申请证据保全等）
- 庭审礼仪和职业规范的遵守`,
      ADAPTABILITY: `- 对对方论点的即时回应能力（是否能快速识别对方论点的薄弱环节并进行反驳）
- 面对意外情况的应对策略（如对方提出未预料到的论点或证据时的反应）
- 论点调整的灵活性（是否能根据庭审进展调整诉讼策略）
- 对法官提问的应答质量（是否能准确理解法官的关注点并给出有针对性的回答）
- 对异议的处理能力（被提出异议时的应对，以及对异议裁定结果的适应）
- 在不利局面下的策略调整能力`,
      EXPRESSION: `- 语言的专业性和准确性（是否使用标准法律术语，术语使用是否准确）
- 表达的清晰度和条理性（论述是否结构清晰、逻辑连贯）
- 用词的恰当性（是否避免了模糊、歧义的表述）
- 陈述的简洁性和有效性（是否做到言简意赅，避免冗余）
- 说服力和感染力（是否能有效说服法庭接受己方观点）
- 书面表达与口头表达的协调性`,
    };
    return criteria[dimension];
  }
}
