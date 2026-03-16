import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock OpenAI ────────────────────────────────────────────
const mockOpenAICreate = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockOpenAICreate } };
  },
}));

// ─── Mock Anthropic ─────────────────────────────────────────
const mockAnthropicCreate = vi.fn();
const mockAnthropicStream = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate, stream: mockAnthropicStream };
  },
}));

// ─── Mock Prisma ────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  default: {
    promptTemplate: { findFirst: vi.fn().mockRejectedValue(new Error('DB unavailable in test')) },
  },
}));

// ─── Helpers ────────────────────────────────────────────────

function mockOpenAIJsonResponse(jsonObj: Record<string, unknown>) {
  mockOpenAICreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(jsonObj) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  });
}

function buildSampleCaseSubmission() {
  return {
    description: '张三于2023年1月与李四签订房屋租赁合同，约定租期一年，月租金5000元。2023年6月李四未支付租金，张三多次催告无果后于2023年9月提起诉讼。',
    parties: [
      { name: '张三', role: 'PLAINTIFF' as const, description: '房东' },
      { name: '李四', role: 'DEFENDANT' as const, description: '租客' },
    ],
    keyFacts: [
      '2023年1月签订租赁合同',
      '月租金5000元，租期一年',
      '2023年6月起李四未支付租金',
      '张三多次催告无果',
      '2023年9月提起诉讼',
    ],
    jurisdiction: 'CHINA' as const,
    caseType: 'CIVIL' as const,
  };
}

function buildFullAnalysisResponse(): Record<string, unknown> {
  return {
    timeline: [
      { date: '2023-01-15', event: '签订房屋租赁合同', legalSignificance: '合同关系成立' },
      { date: '2023-06-01', event: '李四未支付6月租金', legalSignificance: '违约行为开始' },
      { date: '2023-07-01', event: '张三首次催告', legalSignificance: '催告义务履行' },
      { date: '2023-09-10', event: '张三提起诉讼', legalSignificance: '诉讼程序启动' },
    ],
    issues: [
      {
        issue: '租金支付违约',
        legalBasis: [
          { lawName: '民法典', articleNumber: '第577条', description: '违约责任' },
          { lawName: '民法典', articleNumber: '第722条', description: '租赁合同租金支付义务' },
        ],
        analysis: '李四未按合同约定支付租金，构成违约。',
      },
      {
        issue: '合同解除权',
        legalBasis: [
          { lawName: '民法典', articleNumber: '第563条', description: '法定解除权' },
        ],
        analysis: '李四连续三个月未支付租金，张三有权解除合同。',
      },
    ],
    strategies: {
      plaintiff: {
        perspective: 'PLAINTIFF',
        keyArguments: ['合同明确约定租金支付义务', '被告连续违约超过三个月', '原告已履行催告义务'],
        legalBasis: [{ lawName: '民法典', articleNumber: '第577条', description: '违约责任' }],
        riskAssessment: '原告胜诉可能性较高，证据链完整。',
      },
      defendant: {
        perspective: 'DEFENDANT',
        keyArguments: ['房屋存在质量问题影响使用', '原告未及时维修构成违约在先'],
        legalBasis: [{ lawName: '民法典', articleNumber: '第713条', description: '出租人维修义务' }],
        riskAssessment: '被告抗辩理由较弱，需要提供房屋质量问题的证据。',
      },
      judge: {
        perspective: 'JUDGE',
        keyArguments: ['审查合同效力', '审查违约事实', '审查催告程序合规性'],
        legalBasis: [{ lawName: '民法典', articleNumber: '第577条', description: '违约责任' }],
        riskAssessment: '案件事实清楚，法律适用明确。',
        likelyRuling: '倾向支持原告诉讼请求',
        keyConsiderations: ['合同效力', '违约事实认定', '损害赔偿计算'],
      },
      overall: {
        recommendation: '建议原告坚持诉讼，同时准备调解方案。',
        riskLevel: 'LOW',
        nextSteps: ['收集租金支付记录', '准备催告函证据', '计算违约金和损失'],
      },
    },
  };
}

function buildFullStrategyResponse(): Record<string, unknown> {
  return {
    strategies: [
      {
        perspective: 'PLAINTIFF',
        keyArguments: ['合同违约事实清楚', '证据链完整'],
        legalBasis: [{ lawName: '民法典', articleNumber: '第577条', description: '违约责任' }],
        riskAssessment: '胜诉可能性高',
      },
      {
        perspective: 'DEFENDANT',
        keyArguments: ['尝试和解降低损失'],
        legalBasis: [{ lawName: '民法典', articleNumber: '第233条', description: '和解' }],
        riskAssessment: '败诉风险较高',
      },
    ],
    recommendation: '建议原告积极诉讼，被告考虑和解方案。',
    estimatedOutcome: '原告胜诉可能性约80%，预计可获得拖欠租金及违约金赔偿。',
  };
}

describe('CaseAnalyzer', () => {
  let CaseAnalyzer: typeof import('@/server/services/legal/case-analyzer').CaseAnalyzer;
  let resetCaseAnalyzer: typeof import('@/server/services/legal/case-analyzer').resetCaseAnalyzer;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;

  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();

    const llmMod = await import('@/server/services/llm/gateway');
    resetLLMGateway = llmMod.resetLLMGateway;
    resetLLMGateway();

    const mod = await import('@/server/services/legal/case-analyzer');
    CaseAnalyzer = mod.CaseAnalyzer;
    resetCaseAnalyzer = mod.resetCaseAnalyzer;
    resetCaseAnalyzer();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('analyze() — full case analysis', () => {
    it('should return a complete CaseAnalysisResult with timeline, issues, and strategies', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      // Timeline
      expect(result.timeline).toBeDefined();
      expect(result.timeline.length).toBeGreaterThan(0);
      result.timeline.forEach(event => {
        expect(event.date).toBeTruthy();
        expect(event.event).toBeTruthy();
        expect(event.legalSignificance).toBeTruthy();
      });

      // Issues
      expect(result.issues).toBeDefined();
      expect(result.issues.length).toBeGreaterThan(0);
      result.issues.forEach(issue => {
        expect(issue.issue).toBeTruthy();
        expect(issue.legalBasis.length).toBeGreaterThan(0);
        expect(issue.analysis).toBeTruthy();
      });

      // Strategies
      expect(result.strategies.plaintiff).toBeDefined();
      expect(result.strategies.defendant).toBeDefined();
      expect(result.strategies.judge).toBeDefined();
      expect(result.strategies.overall).toBeDefined();
    });
  });

  describe('analyze() — timeline sorting', () => {
    it('should sort timeline events chronologically', async () => {
      mockOpenAIJsonResponse({
        ...buildFullAnalysisResponse(),
        timeline: [
          { date: '2023-09-10', event: '提起诉讼', legalSignificance: '诉讼启动' },
          { date: '2023-01-15', event: '签订合同', legalSignificance: '合同成立' },
          { date: '2023-06-01', event: '违约开始', legalSignificance: '违约行为' },
        ],
      });

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.timeline[0].date).toBe('2023-01-15');
      expect(result.timeline[1].date).toBe('2023-06-01');
      expect(result.timeline[2].date).toBe('2023-09-10');
    });

    it('should handle Chinese date format in timeline sorting', async () => {
      mockOpenAIJsonResponse({
        ...buildFullAnalysisResponse(),
        timeline: [
          { date: '2023年9月10日', event: '提起诉讼', legalSignificance: '诉讼启动' },
          { date: '2023年1月15日', event: '签订合同', legalSignificance: '合同成立' },
        ],
      });

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.timeline[0].event).toBe('签订合同');
      expect(result.timeline[1].event).toBe('提起诉讼');
    });
  });

  describe('analyze() — legal issues with law references', () => {
    it('should ensure every legal issue has non-empty legalBasis', async () => {
      mockOpenAIJsonResponse({
        ...buildFullAnalysisResponse(),
        issues: [
          { issue: '违约问题', legalBasis: [], analysis: '分析内容' },
          { issue: '赔偿问题', legalBasis: null, analysis: '分析内容' },
        ],
      });

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      result.issues.forEach(issue => {
        expect(issue.legalBasis.length).toBeGreaterThan(0);
      });
    });
  });

  describe('analyze() — three-perspective strategies', () => {
    it('should have non-empty keyArguments for all three perspectives', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.strategies.plaintiff.perspective).toBe('PLAINTIFF');
      expect(result.strategies.plaintiff.keyArguments.length).toBeGreaterThan(0);

      expect(result.strategies.defendant.perspective).toBe('DEFENDANT');
      expect(result.strategies.defendant.keyArguments.length).toBeGreaterThan(0);

      expect(result.strategies.judge.perspective).toBe('JUDGE');
      expect(result.strategies.judge.keyArguments.length).toBeGreaterThan(0);
    });

    it('should include judge-specific fields (likelyRuling, keyConsiderations)', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.strategies.judge.likelyRuling).toBeTruthy();
      expect(result.strategies.judge.keyConsiderations.length).toBeGreaterThan(0);
    });

    it('should include overall strategy with recommendation and nextSteps', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.strategies.overall.recommendation).toBeTruthy();
      expect(result.strategies.overall.riskLevel).toBeTruthy();
      expect(result.strategies.overall.nextSteps.length).toBeGreaterThan(0);
    });
  });

  describe('analyze() — degraded response handling', () => {
    it('should return safe defaults when both LLM providers fail', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.timeline.length).toBeGreaterThan(0);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].legalBasis.length).toBeGreaterThan(0);
      expect(result.strategies.plaintiff.keyArguments.length).toBeGreaterThan(0);
      expect(result.strategies.defendant.keyArguments.length).toBeGreaterThan(0);
      expect(result.strategies.judge.keyArguments.length).toBeGreaterThan(0);
      expect(result.strategies.overall.nextSteps.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'not valid json' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      // Should return degraded result, not throw
      expect(result.timeline).toBeDefined();
      expect(result.issues).toBeDefined();
      expect(result.strategies).toBeDefined();
    });
  });

  describe('analyze() — normalization edge cases', () => {
    it('should handle missing strategies gracefully', async () => {
      mockOpenAIJsonResponse({
        timeline: [{ date: '2023-01-01', event: 'test', legalSignificance: 'test' }],
        issues: [{ issue: 'test', legalBasis: [{ lawName: '民法典', description: 'test' }], analysis: 'test' }],
        // No strategies provided
      });

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.strategies.plaintiff.keyArguments.length).toBeGreaterThan(0);
      expect(result.strategies.defendant.keyArguments.length).toBeGreaterThan(0);
      expect(result.strategies.judge.keyArguments.length).toBeGreaterThan(0);
      expect(result.strategies.overall.nextSteps.length).toBeGreaterThan(0);
    });

    it('should handle empty timeline array', async () => {
      mockOpenAIJsonResponse({
        ...buildFullAnalysisResponse(),
        timeline: [],
      });

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.timeline.length).toBeGreaterThan(0);
    });

    it('should handle empty issues array', async () => {
      mockOpenAIJsonResponse({
        ...buildFullAnalysisResponse(),
        issues: [],
      });

      const analyzer = new CaseAnalyzer();
      const result = await analyzer.analyze(buildSampleCaseSubmission());

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].legalBasis.length).toBeGreaterThan(0);
    });
  });

  describe('analyze() — LLM call configuration', () => {
    it('should use json_object response format and low temperature', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());

      const analyzer = new CaseAnalyzer();
      await analyzer.analyze(buildSampleCaseSubmission());

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should include case description and parties in the prompt', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());

      const analyzer = new CaseAnalyzer();
      await analyzer.analyze(buildSampleCaseSubmission());

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('张三');
      expect(userMessage?.content).toContain('李四');
      expect(userMessage?.content).toContain('房屋租赁合同');
    });

    it('should include context when provided', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());

      const analyzer = new CaseAnalyzer();
      const submission = { ...buildSampleCaseSubmission(), context: '案件发生在北京市朝阳区' };
      await analyzer.analyze(submission);

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('案件发生在北京市朝阳区');
    });
  });

  describe('generateStrategy()', () => {
    it('should return a LitigationStrategy with strategies, recommendation, and estimatedOutcome', async () => {
      // First call for analyze, second for generateStrategy
      mockOpenAIJsonResponse(buildFullAnalysisResponse());
      const analyzer = new CaseAnalyzer();
      const analysis = await analyzer.analyze(buildSampleCaseSubmission());

      mockOpenAICreate.mockReset();
      mockOpenAIJsonResponse(buildFullStrategyResponse());

      const strategy = await analyzer.generateStrategy(analysis);

      expect(strategy.strategies.length).toBeGreaterThan(0);
      strategy.strategies.forEach(s => {
        expect(s.keyArguments.length).toBeGreaterThan(0);
        expect(s.perspective).toBeTruthy();
      });
      expect(strategy.recommendation).toBeTruthy();
      expect(strategy.estimatedOutcome).toBeTruthy();
    });

    it('should handle degraded response in generateStrategy', async () => {
      mockOpenAIJsonResponse(buildFullAnalysisResponse());
      const analyzer = new CaseAnalyzer();
      const analysis = await analyzer.analyze(buildSampleCaseSubmission());

      mockOpenAICreate.mockReset();
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const strategy = await analyzer.generateStrategy(analysis);

      expect(strategy.strategies.length).toBeGreaterThan(0);
      expect(strategy.recommendation).toBeTruthy();
      expect(strategy.estimatedOutcome).toBeTruthy();
    });
  });
});
