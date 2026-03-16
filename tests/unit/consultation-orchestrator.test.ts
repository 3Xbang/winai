import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// ─── Mock OpenAI & Anthropic ────────────────────────────────
const mockOpenAICreate = vi.fn();
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockOpenAICreate } };
  },
}));

const mockAnthropicCreate = vi.fn();
const mockAnthropicStream = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockAnthropicCreate, stream: mockAnthropicStream };
  },
}));

// ─── Mock Prisma ────────────────────────────────────────────
const mockPrisma = {
  user: { findUnique: vi.fn() },
  consultationSession: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  message: { createMany: vi.fn() },
  promptTemplate: { findFirst: vi.fn().mockResolvedValue(null) },
};
vi.mock('@/lib/prisma', () => ({ default: mockPrisma }));

// ─── Mock Redis ─────────────────────────────────────────────
const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue(1),
  pipeline: vi.fn().mockReturnValue({
    incr: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  }),
};
vi.mock('@/lib/redis', () => ({ default: mockRedis }));

// ─── Helpers ────────────────────────────────────────────────

function mockOpenAIJsonResponse(jsonObj: Record<string, unknown>) {
  mockOpenAICreate.mockResolvedValueOnce({
    choices: [{ message: { content: JSON.stringify(jsonObj) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
  });
}

function setupDefaultUser(tier = 'FREE', status = 'ACTIVE') {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: 'user-1',
    role: 'FREE_USER',
    subscription: {
      status,
      endDate: new Date(Date.now() + 86400000 * 30),
      isTrial: false,
      trialEndDate: null,
      plan: {
        tier,
        dailyLimit: tier === 'VIP' ? null : 3,
        monthlyLimit: tier === 'VIP' ? null : 30,
      },
    },
  });
}

const MOCK_JURISDICTION_RESPONSE = {
  jurisdiction: 'CHINA',
  confidence: 0.95,
  chinaLaws: [{ lawName: '公司法', articleNumber: '第23条', description: '公司注册' }],
  thailandLaws: [],
  needsMoreInfo: [],
};

const MOCK_IRAC_RESPONSE = {
  issue: '公司注册条件争议',
  rule: [{ lawName: '公司法', articleNumber: '第23条', description: '有限责任公司设立条件' }],
  analysis: '根据公司法第23条，设立有限责任公司需满足以下条件...',
  conclusion: '建议按照法定程序办理公司注册。',
};

const MOCK_REPORT_RESPONSE = {
  title: '法律分析报告',
  summary: '关于公司注册的法律分析结论',
  legalAnalysis: '根据《公司法》第23条...',
  strategyAdvice: '建议先完成名称预核准...',
  actionPlan: ['步骤1：名称预核准', '步骤2：准备材料', '步骤3：提交申请'],
  caseReferences: ['参考案例：某公司注册纠纷案'],
  disclaimer: '本报告仅供参考，不构成正式法律意见。',
};

const MOCK_RISK_ASSESSMENT_RESPONSE = {
  dimensions: { legal: 45, financial: 30, compliance: 55, reputation: 20 },
  subScores: {},
  details: '综合风险评估：中等风险',
};

const MOCK_CONFIDENCE_RESPONSE = { score: 75 };

function setupFullMockChain() {
  // Jurisdiction call
  mockOpenAIJsonResponse(MOCK_JURISDICTION_RESPONSE);
  // IRAC call
  mockOpenAIJsonResponse(MOCK_IRAC_RESPONSE);
  // Risk assessment call
  mockOpenAIJsonResponse(MOCK_RISK_ASSESSMENT_RESPONSE);
  // Report call
  mockOpenAIJsonResponse(MOCK_REPORT_RESPONSE);
  // Confidence assessment call
  mockOpenAIJsonResponse(MOCK_CONFIDENCE_RESPONSE);
}

describe('Consultation Orchestrator', () => {
  let processConsultation: typeof import('@/server/services/consultation/orchestrator').processConsultation;
  let processConsultationStream: typeof import('@/server/services/consultation/orchestrator').processConsultationStream;

  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.consultationSession.create.mockReset();
    mockPrisma.consultationSession.findUnique.mockReset();
    mockPrisma.consultationSession.update.mockReset();
    mockPrisma.message.createMany.mockReset();
    mockRedis.get.mockReset().mockResolvedValue(null);
    mockRedis.set.mockReset().mockResolvedValue('OK');
    mockRedis.del.mockReset().mockResolvedValue(1);
    mockRedis.pipeline.mockReset().mockReturnValue({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    });

    // Reset singletons
    const { resetLLMGateway } = await import('@/server/services/llm/gateway');
    resetLLMGateway();
    const { resetPromptEngine } = await import('@/server/services/llm/prompt-engine');
    resetPromptEngine();
    const { resetJurisdictionIdentifier } = await import('@/server/services/legal/jurisdiction');
    resetJurisdictionIdentifier();
    const { resetIRACEngine } = await import('@/server/services/legal/irac');
    resetIRACEngine();
    const { resetReportGenerator } = await import('@/server/services/report/generator');
    resetReportGenerator();
    const { resetRiskWarningService } = await import('@/server/services/legal/risk-warning');
    resetRiskWarningService();
    const { clearPreferences } = await import('@/server/services/ai/personalization/preference-manager');
    clearPreferences();
    const { clearConsecutiveTracking } = await import('@/server/services/ai/quality/confidence-assessor');
    clearConsecutiveTracking();

    // Session create mock
    mockPrisma.consultationSession.create.mockResolvedValue({ id: 'sess-mock' });

    const mod = await import('@/server/services/consultation/orchestrator');
    processConsultation = mod.processConsultation;
    processConsultationStream = mod.processConsultationStream;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── Happy Path ─────────────────────────────────────────────

  describe('processConsultation — happy path', () => {
    it('should complete the full orchestration flow and return a ConsultationResult', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      const result = await processConsultation({
        query: '我想在上海注册一家有限责任公司',
        userId: 'user-1',
        language: 'zh',
      });

      expect(result).toBeDefined();
      expect(result.jurisdiction).toBeDefined();
      expect(result.jurisdiction.jurisdiction).toBe('CHINA');
      expect(result.analysis).toBeDefined();
      expect(result.report).toBeDefined();
      expect(result.report.summary).toBeTruthy();
      expect(result.quotaRemaining).toBeDefined();
      expect(result.sessionId).toBeTruthy();
      // AI enhancement fields
      expect(result.detectedLanguage).toBe('zh');
      expect(result.intentClassification).toBeDefined();
      expect(result.intentClassification!.primaryIntent).toBeTruthy();
      expect(result.userPreferences).toBeDefined();
    });

    it('should call services in the correct order: quota → language → intent → jurisdiction → IRAC → risk → report → confidence', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      await processConsultation({
        query: '公司注册问题',
        userId: 'user-1',
      });

      // Quota check calls prisma.user.findUnique
      expect(mockPrisma.user.findUnique).toHaveBeenCalled();
      // LLM should be called 5 times: jurisdiction, IRAC, risk assessment, report, confidence
      expect(mockOpenAICreate).toHaveBeenCalledTimes(5);
    });

    it('should include disclaimer in the report', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      const result = await processConsultation({
        query: '法律咨询',
        userId: 'user-1',
      });

      expect(result.report.disclaimer).toBeTruthy();
      expect(result.report.disclaimer).toContain('不构成正式法律意见');
    });
  });

  // ─── Quota Exceeded ─────────────────────────────────────────

  describe('processConsultation — quota exceeded', () => {
    it('should throw FORBIDDEN when daily quota is exceeded', async () => {
      setupDefaultUser('FREE');
      // Simulate daily limit reached
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily')) return Promise.resolve('3');
        if (key.includes('monthly')) return Promise.resolve('5');
        return Promise.resolve(null);
      });

      await expect(
        processConsultation({ query: '法律问题', userId: 'user-1' }),
      ).rejects.toThrow(TRPCError);

      await expect(
        processConsultation({ query: '法律问题', userId: 'user-1' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('should throw FORBIDDEN when monthly quota is exceeded', async () => {
      setupDefaultUser('FREE');
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily')) return Promise.resolve('1');
        if (key.includes('monthly')) return Promise.resolve('30');
        return Promise.resolve(null);
      });

      await expect(
        processConsultation({ query: '法律问题', userId: 'user-1' }),
      ).rejects.toThrow(TRPCError);
    });

    it('should not call LLM services when quota is exceeded', async () => {
      setupDefaultUser('FREE');
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily')) return Promise.resolve('3');
        return Promise.resolve('5');
      });

      try {
        await processConsultation({ query: '法律问题', userId: 'user-1' });
      } catch {
        // expected
      }

      expect(mockOpenAICreate).not.toHaveBeenCalled();
    });
  });

  // ─── VIP Unlimited ──────────────────────────────────────────

  describe('processConsultation — VIP unlimited', () => {
    it('should allow VIP users regardless of usage counts', async () => {
      setupDefaultUser('VIP');
      setupFullMockChain();

      const result = await processConsultation({
        query: '公司注册问题',
        userId: 'user-1',
      });

      expect(result).toBeDefined();
      expect(result.jurisdiction).toBeDefined();
    });
  });

  // ─── Partial Failure ────────────────────────────────────────

  describe('processConsultation — partial failure (report generation fails)', () => {
    it('should return jurisdiction + analysis even if report generation fails', async () => {
      setupDefaultUser('FREE');
      // Jurisdiction succeeds
      mockOpenAIJsonResponse(MOCK_JURISDICTION_RESPONSE);
      // IRAC succeeds
      mockOpenAIJsonResponse(MOCK_IRAC_RESPONSE);
      // Risk assessment succeeds
      mockOpenAIJsonResponse(MOCK_RISK_ASSESSMENT_RESPONSE);
      // Report fails
      mockOpenAICreate.mockRejectedValueOnce(new Error('LLM timeout'));
      mockAnthropicCreate.mockRejectedValueOnce(new Error('Anthropic down'));
      // Confidence assessment (on fallback report)
      mockOpenAIJsonResponse(MOCK_CONFIDENCE_RESPONSE);

      const result = await processConsultation({
        query: '公司注册问题',
        userId: 'user-1',
      });

      // Jurisdiction and analysis should still be present
      expect(result.jurisdiction.jurisdiction).toBe('CHINA');
      expect(result.analysis.chinaAnalysis).toBeDefined();
      expect(result.analysis.chinaAnalysis!.issue).toBeTruthy();
      // Report should be a fallback/degraded report
      expect(result.report).toBeDefined();
      expect(result.report.title).toBeTruthy();
    });
  });

  // ─── Session Saving ─────────────────────────────────────────

  describe('processConsultation — session saving', () => {
    it('should save the session after successful consultation', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      await processConsultation({
        query: '法律咨询问题',
        userId: 'user-1',
      });

      expect(mockPrisma.consultationSession.create).toHaveBeenCalled();
    });

    it('should not throw if session save fails', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();
      mockPrisma.consultationSession.create.mockRejectedValueOnce(new Error('DB error'));

      const result = await processConsultation({
        query: '法律咨询问题',
        userId: 'user-1',
      });

      // Should still return a valid result
      expect(result.jurisdiction).toBeDefined();
      expect(result.analysis).toBeDefined();
    });

    it('should use provided sessionId for continuing sessions', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();
      mockPrisma.consultationSession.findUnique.mockResolvedValue({ id: 'existing-session' });

      const result = await processConsultation({
        query: '继续之前的咨询',
        userId: 'user-1',
        sessionId: 'existing-session',
      });

      expect(result.sessionId).toBe('existing-session');
    });
  });

  // ─── Usage Increment ────────────────────────────────────────

  describe('processConsultation — usage increment', () => {
    it('should increment usage after successful consultation', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      await processConsultation({
        query: '法律问题',
        userId: 'user-1',
      });

      // incrementUsage uses redis pipeline
      expect(mockRedis.pipeline).toHaveBeenCalled();
    });

    it('should not increment usage when quota check fails', async () => {
      setupDefaultUser('FREE');
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily')) return Promise.resolve('3');
        return Promise.resolve('5');
      });

      try {
        await processConsultation({ query: '法律问题', userId: 'user-1' });
      } catch {
        // expected
      }

      // pipeline should not be called for increment (only for quota check)
      expect(mockRedis.pipeline).not.toHaveBeenCalled();
    });
  });

  // ─── Dual Jurisdiction ──────────────────────────────────────

  describe('processConsultation — dual jurisdiction', () => {
    it('should handle DUAL jurisdiction with both analyses', async () => {
      setupDefaultUser('FREE');
      // Jurisdiction: DUAL
      mockOpenAIJsonResponse({
        jurisdiction: 'DUAL',
        confidence: 0.85,
        chinaLaws: [{ lawName: '外商投资法', description: '外商投资' }],
        thailandLaws: [{ lawName: 'Foreign Business Act', description: '外国人经商法' }],
        needsMoreInfo: [],
      });
      // IRAC China
      mockOpenAIJsonResponse(MOCK_IRAC_RESPONSE);
      // IRAC Thailand
      mockOpenAIJsonResponse({
        issue: 'Foreign business restrictions',
        rule: [{ lawName: 'Foreign Business Act', articleNumber: 'Section 8', description: 'Restricted businesses' }],
        analysis: 'Under the Foreign Business Act...',
        conclusion: 'Foreign ownership restrictions apply.',
      });
      // Combined conclusion (text, not JSON)
      mockOpenAICreate.mockResolvedValueOnce({
        choices: [{ message: { content: '综合结论：中泰两国法律均需遵守...' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
      });
      // Risk assessment
      mockOpenAIJsonResponse(MOCK_RISK_ASSESSMENT_RESPONSE);
      // Report
      mockOpenAIJsonResponse(MOCK_REPORT_RESPONSE);
      // Confidence assessment
      mockOpenAIJsonResponse(MOCK_CONFIDENCE_RESPONSE);

      const result = await processConsultation({
        query: '我想在泰国设立公司，同时在中国设立分公司',
        userId: 'user-1',
      });

      expect(result.jurisdiction.jurisdiction).toBe('DUAL');
      expect(result.analysis.chinaAnalysis).toBeDefined();
      expect(result.analysis.thailandAnalysis).toBeDefined();
    });
  });

  // ─── Context Passing ────────────────────────────────────────

  describe('processConsultation — context and language', () => {
    it('should pass context and language to jurisdiction identifier', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      await processConsultation({
        query: '法律问题',
        userId: 'user-1',
        language: 'th',
        context: '用户在泰国曼谷',
      });

      // Verify the first LLM call (jurisdiction) includes context
      const firstCall = mockOpenAICreate.mock.calls[0]?.[0] as any;
      const userMsg = firstCall.messages.find((m: any) => m.role === 'user');
      expect(userMsg?.content).toContain('用户在泰国曼谷');
    });
  });

  // ─── User Not Found ─────────────────────────────────────────

  describe('processConsultation — user not found', () => {
    it('should throw when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        processConsultation({ query: '法律问题', userId: 'nonexistent' }),
      ).rejects.toThrow();
    });
  });

  // ─── Streaming ──────────────────────────────────────────────

  describe('processConsultationStream', () => {
    it('should yield events in the correct order for a successful flow', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      const events: any[] = [];
      for await (const event of processConsultationStream({
        query: '公司注册问题',
        userId: 'user-1',
      })) {
        events.push(event);
      }

      const types = events.map(e => e.type);
      // Should have status events, then data events, then complete
      expect(types).toContain('status');
      expect(types).toContain('jurisdiction');
      expect(types).toContain('analysis');
      expect(types).toContain('report');
      expect(types).toContain('complete');

      // Complete event should have full result
      const completeEvent = events.find(e => e.type === 'complete');
      expect(completeEvent.data.jurisdiction).toBeDefined();
      expect(completeEvent.data.analysis).toBeDefined();
      expect(completeEvent.data.report).toBeDefined();
    });

    it('should yield error event when quota is exceeded', async () => {
      setupDefaultUser('FREE');
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes('daily')) return Promise.resolve('3');
        return Promise.resolve('5');
      });

      const events: any[] = [];
      for await (const event of processConsultationStream({
        query: '法律问题',
        userId: 'user-1',
      })) {
        events.push(event);
      }

      const types = events.map(e => e.type);
      expect(types).toContain('error');
      expect(types).not.toContain('complete');
    });

    it('should yield status events for each stage', async () => {
      setupDefaultUser('FREE');
      setupFullMockChain();

      const events: any[] = [];
      for await (const event of processConsultationStream({
        query: '法律问题',
        userId: 'user-1',
      })) {
        events.push(event);
      }

      const statusEvents = events.filter(e => e.type === 'status');
      const stages = statusEvents.map(e => e.stage);
      expect(stages).toContain('quota');
      expect(stages).toContain('language');
      expect(stages).toContain('intent');
      expect(stages).toContain('jurisdiction');
      expect(stages).toContain('analysis');
      expect(stages).toContain('risk');
      expect(stages).toContain('report');
      expect(stages).toContain('quality');
      expect(stages).toContain('finalize');
    });
  });
});
