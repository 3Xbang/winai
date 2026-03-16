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

function buildRecommendResponse(): Record<string, unknown> {
  return {
    recommendations: [
      {
        visaType: '工作签证（Non-Immigrant B）',
        requirements: ['有效护照（有效期6个月以上）', '泰国公司出具的邀请函', '工作许可证申请'],
        documents: ['护照原件及复印件', '2寸照片4张', '公司注册文件', '劳动合同'],
        process: [
          { step: 1, description: '准备申请材料', estimatedDuration: '3-5个工作日' },
          { step: 2, description: '向泰国大使馆提交申请', estimatedDuration: '5-7个工作日' },
          { step: 3, description: '入境后办理工作许可证', estimatedDuration: '7-14个工作日' },
        ],
        estimatedCost: {
          amount: '5000',
          currency: 'THB',
          breakdown: { '签证费': '2000 THB', '工作许可证费': '3000 THB' },
        },
        commonRejectionReasons: ['材料不完整', '公司资质不符合要求', '申请人学历不满足条件'],
        avoidanceAdvice: ['确保公司注册资本满足最低要求', '准备完整的学历认证文件', '注意：非法工作将面临罚款和驱逐出境'],
      },
      {
        visaType: 'DTV 数字游民签证',
        requirements: ['有效护照', '远程工作证明', '月收入证明（不低于80,000 THB）'],
        documents: ['护照原件', '远程工作合同', '银行流水'],
        process: [
          { step: 1, description: '在线提交申请', estimatedDuration: '1天' },
          { step: 2, description: '等待审批', estimatedDuration: '15-30个工作日' },
        ],
        estimatedCost: {
          amount: '10000',
          currency: 'THB',
        },
        commonRejectionReasons: ['收入证明不足', '工作性质不符合远程工作定义'],
        avoidanceAdvice: ['确保收入证明清晰明确', '逾期滞留每天罚款500泰铢，最高20,000泰铢'],
      },
    ],
  };
}

function buildRenewalResponse(): Record<string, unknown> {
  return {
    isRenewable: true,
    requirements: ['有效护照', '当前签证未过期', '工作许可证仍然有效'],
    process: [
      { step: 1, description: '准备续签材料', estimatedDuration: '2-3个工作日' },
      { step: 2, description: '前往移民局提交申请', estimatedDuration: '1天' },
    ],
    estimatedCost: {
      amount: '1900',
      currency: 'THB',
    },
    deadline: '签证到期前30天内提交续签申请',
    penalties: ['逾期滞留每天罚款500泰铢', '超过90天逾期将被列入黑名单'],
  };
}

function buildConversionResponse(): Record<string, unknown> {
  return {
    conversionPaths: [
      {
        targetVisaType: '工作签证（Non-Immigrant B）',
        feasibility: 'HIGH',
        requirements: ['获得泰国公司的工作邀请', '满足工作许可证申请条件'],
        process: [
          { step: 1, description: '获取公司邀请函', estimatedDuration: '1-2周' },
          { step: 2, description: '向移民局申请签证类型变更', estimatedDuration: '7-14个工作日' },
        ],
        estimatedCost: {
          amount: '2000',
          currency: 'THB',
        },
        notes: '商务签转工作签是最常见的转换路径，成功率较高。',
      },
    ],
  };
}

describe('VisaAdvisor', () => {
  let VisaAdvisor: typeof import('@/server/services/legal/visa').VisaAdvisor;
  let resetVisaAdvisor: typeof import('@/server/services/legal/visa').resetVisaAdvisor;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;

  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();

    const llmMod = await import('@/server/services/llm/gateway');
    resetLLMGateway = llmMod.resetLLMGateway;
    resetLLMGateway();

    const mod = await import('@/server/services/legal/visa');
    VisaAdvisor = mod.VisaAdvisor;
    resetVisaAdvisor = mod.resetVisaAdvisor;
    resetVisaAdvisor();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── recommend() ──────────────────────────────────────────

  describe('recommend()', () => {
    it('should return recommendations with all required fields non-empty', async () => {
      mockOpenAIJsonResponse(buildRecommendResponse());

      const advisor = new VisaAdvisor();
      const result = await advisor.recommend({
        nationality: '中国',
        purpose: '工作',
        occupation: '软件工程师',
      });

      expect(result.length).toBeGreaterThan(0);
      result.forEach(rec => {
        expect(rec.visaType).toBeTruthy();
        expect(rec.requirements.length).toBeGreaterThan(0);
        rec.requirements.forEach(r => expect(r).toBeTruthy());
        expect(rec.documents.length).toBeGreaterThan(0);
        rec.documents.forEach(d => expect(d).toBeTruthy());
        expect(rec.process.length).toBeGreaterThan(0);
        rec.process.forEach(p => {
          expect(p.step).toBeGreaterThan(0);
          expect(p.description).toBeTruthy();
        });
        expect(rec.estimatedCost.amount).toBeTruthy();
        expect(rec.estimatedCost.currency).toBeTruthy();
        expect(rec.commonRejectionReasons.length).toBeGreaterThan(0);
        rec.commonRejectionReasons.forEach(r => expect(r).toBeTruthy());
        expect(rec.avoidanceAdvice.length).toBeGreaterThan(0);
        rec.avoidanceAdvice.forEach(a => expect(a).toBeTruthy());
      });
    });

    it('should pass user profile details to LLM prompt', async () => {
      mockOpenAIJsonResponse(buildRecommendResponse());

      const advisor = new VisaAdvisor();
      await advisor.recommend({
        nationality: '中国',
        purpose: '退休养老',
        age: 55,
        financialStatus: '年收入50万人民币',
        currentLocation: '北京',
      });

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage?.content).toContain('中国');
      expect(userMessage?.content).toContain('退休养老');
      expect(userMessage?.content).toContain('55');
      expect(userMessage?.content).toContain('年收入50万人民币');
      expect(userMessage?.content).toContain('北京');
    });

    it('should use json_object response format and low temperature', async () => {
      mockOpenAIJsonResponse(buildRecommendResponse());

      const advisor = new VisaAdvisor();
      await advisor.recommend({ nationality: '中国', purpose: '旅游' });

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should handle degraded LLM response gracefully', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const advisor = new VisaAdvisor();
      const result = await advisor.recommend({ nationality: '中国', purpose: '工作' });

      expect(result.length).toBeGreaterThan(0);
      result.forEach(rec => {
        expect(rec.visaType).toBeTruthy();
        expect(rec.requirements.length).toBeGreaterThan(0);
        expect(rec.documents.length).toBeGreaterThan(0);
        expect(rec.process.length).toBeGreaterThan(0);
        expect(rec.estimatedCost.amount).toBeTruthy();
        expect(rec.estimatedCost.currency).toBeTruthy();
        expect(rec.commonRejectionReasons.length).toBeGreaterThan(0);
        expect(rec.avoidanceAdvice.length).toBeGreaterThan(0);
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'not valid json' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const advisor = new VisaAdvisor();
      const result = await advisor.recommend({ nationality: '中国', purpose: '旅游' });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.visaType).toBeTruthy();
    });

    it('should handle empty recommendations array from LLM', async () => {
      mockOpenAIJsonResponse({ recommendations: [] });

      const advisor = new VisaAdvisor();
      const result = await advisor.recommend({ nationality: '中国', purpose: '旅游' });

      // Should return fallback recommendation
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.visaType).toBeTruthy();
    });

    it('should normalize missing fields with fallback values', async () => {
      mockOpenAIJsonResponse({
        recommendations: [{
          visaType: '旅游签证',
          // Missing other fields
        }],
      });

      const advisor = new VisaAdvisor();
      const result = await advisor.recommend({ nationality: '中国', purpose: '旅游' });

      expect(result[0]!.visaType).toBe('旅游签证');
      expect(result[0]!.requirements.length).toBeGreaterThan(0);
      expect(result[0]!.documents.length).toBeGreaterThan(0);
      expect(result[0]!.process.length).toBeGreaterThan(0);
      expect(result[0]!.estimatedCost.currency).toBe('THB');
      expect(result[0]!.commonRejectionReasons.length).toBeGreaterThan(0);
      expect(result[0]!.avoidanceAdvice.length).toBeGreaterThan(0);
    });
  });

  // ─── getRenewalInfo() ─────────────────────────────────────

  describe('getRenewalInfo()', () => {
    it('should return renewal info with all required fields', async () => {
      mockOpenAIJsonResponse(buildRenewalResponse());

      const advisor = new VisaAdvisor();
      const result = await advisor.getRenewalInfo({
        visaType: '工作签证（Non-Immigrant B）',
        expiryDate: '2024-12-31',
      });

      expect(typeof result.isRenewable).toBe('boolean');
      expect(result.requirements.length).toBeGreaterThan(0);
      result.requirements.forEach(r => expect(r).toBeTruthy());
      expect(result.process.length).toBeGreaterThan(0);
      result.process.forEach(p => {
        expect(p.step).toBeGreaterThan(0);
        expect(p.description).toBeTruthy();
      });
      expect(result.estimatedCost.amount).toBeTruthy();
      expect(result.estimatedCost.currency).toBeTruthy();
    });

    it('should include deadline and penalties when provided', async () => {
      mockOpenAIJsonResponse(buildRenewalResponse());

      const advisor = new VisaAdvisor();
      const result = await advisor.getRenewalInfo({
        visaType: '工作签证',
        expiryDate: '2024-12-31',
      });

      expect(result.deadline).toBeTruthy();
      expect(result.penalties).toBeDefined();
      expect(result.penalties!.length).toBeGreaterThan(0);
    });

    it('should pass visa info to LLM prompt', async () => {
      mockOpenAIJsonResponse(buildRenewalResponse());

      const advisor = new VisaAdvisor();
      await advisor.getRenewalInfo({
        visaType: '退休签证',
        expiryDate: '2025-06-30',
        entryType: '单次入境',
      });

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage?.content).toContain('退休签证');
      expect(userMessage?.content).toContain('2025-06-30');
      expect(userMessage?.content).toContain('单次入境');
    });

    it('should handle degraded LLM response gracefully', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const advisor = new VisaAdvisor();
      const result = await advisor.getRenewalInfo({ visaType: '工作签证' });

      expect(typeof result.isRenewable).toBe('boolean');
      expect(result.requirements.length).toBeGreaterThan(0);
      expect(result.process.length).toBeGreaterThan(0);
      expect(result.estimatedCost.amount).toBeTruthy();
      expect(result.estimatedCost.currency).toBeTruthy();
    });
  });

  // ─── getConversionPaths() ─────────────────────────────────

  describe('getConversionPaths()', () => {
    it('should return conversion paths with valid feasibility', async () => {
      mockOpenAIJsonResponse(buildConversionResponse());

      const advisor = new VisaAdvisor();
      const result = await advisor.getConversionPaths(
        { visaType: '商务签证', expiryDate: '2024-12-31' },
        '工作签证',
      );

      expect(result.length).toBeGreaterThan(0);
      result.forEach(path => {
        expect(path.targetVisaType).toBeTruthy();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(path.feasibility);
        expect(path.requirements.length).toBeGreaterThan(0);
        path.requirements.forEach(r => expect(r).toBeTruthy());
        expect(path.process.length).toBeGreaterThan(0);
        path.process.forEach(p => {
          expect(p.step).toBeGreaterThan(0);
          expect(p.description).toBeTruthy();
        });
        expect(path.estimatedCost.amount).toBeTruthy();
        expect(path.estimatedCost.currency).toBeTruthy();
        expect(path.notes).toBeTruthy();
      });
    });

    it('should pass current visa and target type to LLM prompt', async () => {
      mockOpenAIJsonResponse(buildConversionResponse());

      const advisor = new VisaAdvisor();
      await advisor.getConversionPaths(
        { visaType: '旅游签证', entryType: '单次入境' },
        '教育签证',
      );

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m: { role: string }) => m.role === 'user');
      expect(userMessage?.content).toContain('旅游签证');
      expect(userMessage?.content).toContain('教育签证');
      expect(userMessage?.content).toContain('单次入境');
    });

    it('should normalize invalid feasibility to MEDIUM', async () => {
      mockOpenAIJsonResponse({
        conversionPaths: [{
          targetVisaType: '工作签证',
          feasibility: 'INVALID',
          requirements: ['条件1'],
          process: [{ step: 1, description: '步骤1' }],
          estimatedCost: { amount: '2000', currency: 'THB' },
          notes: '注意事项',
        }],
      });

      const advisor = new VisaAdvisor();
      const result = await advisor.getConversionPaths(
        { visaType: '旅游签证' },
        '工作签证',
      );

      expect(result[0]!.feasibility).toBe('MEDIUM');
    });

    it('should handle degraded LLM response gracefully', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const advisor = new VisaAdvisor();
      const result = await advisor.getConversionPaths(
        { visaType: '旅游签证' },
        '工作签证',
      );

      expect(result.length).toBeGreaterThan(0);
      result.forEach(path => {
        expect(path.targetVisaType).toBeTruthy();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(path.feasibility);
        expect(path.requirements.length).toBeGreaterThan(0);
        expect(path.process.length).toBeGreaterThan(0);
        expect(path.estimatedCost.amount).toBeTruthy();
        expect(path.notes).toBeTruthy();
      });
    });

    it('should handle empty conversion paths from LLM', async () => {
      mockOpenAIJsonResponse({ conversionPaths: [] });

      const advisor = new VisaAdvisor();
      const result = await advisor.getConversionPaths(
        { visaType: '旅游签证' },
        '精英签证',
      );

      // Should return fallback path
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]!.notes).toBeTruthy();
    });
  });

  // ─── Singleton ────────────────────────────────────────────

  describe('getVisaAdvisor / resetVisaAdvisor', () => {
    it('should return the same instance on repeated calls', async () => {
      const { getVisaAdvisor } = await import('@/server/services/legal/visa');
      resetVisaAdvisor();
      const a = getVisaAdvisor();
      const b = getVisaAdvisor();
      expect(a).toBe(b);
    });

    it('should return a new instance after reset', async () => {
      const { getVisaAdvisor } = await import('@/server/services/legal/visa');
      resetVisaAdvisor();
      const a = getVisaAdvisor();
      resetVisaAdvisor();
      const b = getVisaAdvisor();
      expect(a).not.toBe(b);
    });
  });
});
