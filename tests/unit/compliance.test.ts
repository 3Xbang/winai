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

describe('ComplianceAnnotator', () => {
  let ComplianceAnnotator: typeof import('@/server/services/legal/compliance').ComplianceAnnotator;
  let resetComplianceAnnotator: typeof import('@/server/services/legal/compliance').resetComplianceAnnotator;
  let getComplianceAnnotator: typeof import('@/server/services/legal/compliance').getComplianceAnnotator;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;
  let resetPromptEngine: typeof import('@/server/services/llm/prompt-engine').resetPromptEngine;

  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();

    const llmMod = await import('@/server/services/llm/gateway');
    resetLLMGateway = llmMod.resetLLMGateway;
    resetLLMGateway();

    const promptMod = await import('@/server/services/llm/prompt-engine');
    resetPromptEngine = promptMod.resetPromptEngine;
    resetPromptEngine();

    const mod = await import('@/server/services/legal/compliance');
    ComplianceAnnotator = mod.ComplianceAnnotator;
    resetComplianceAnnotator = mod.resetComplianceAnnotator;
    getComplianceAnnotator = mod.getComplianceAnnotator;
    resetComplianceAnnotator();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── Basic annotation with risks ───────────────────────────

  describe('annotate() — basic risk detection', () => {
    it('should detect compliance risks in CHINA jurisdiction', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          {
            riskDescription: '外资持股比例超过限制',
            severity: 'HIGH',
            legalBasis: '《外商投资法》第28条',
            alternatives: ['调整持股比例至法定限额以内', '申请特殊行业准入许可'],
          },
        ],
        overallComplianceLevel: 'NON_COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('外资企业持股分析...', 'CHINA');

      expect(result.hasComplianceRisks).toBe(true);
      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].riskDescription).toBe('外资持股比例超过限制');
      expect(result.risks[0].severity).toBe('HIGH');
      expect(result.risks[0].legalBasis).toBe('《外商投资法》第28条');
      expect(result.risks[0].alternatives.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect compliance risks in THAILAND jurisdiction', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          {
            riskDescription: '未取得工作许可证从事受限业务',
            severity: 'HIGH',
            legalBasis: 'Foreign Business Act B.E. 2542',
            alternatives: ['申请工作许可证', '通过BOI获取经营许可'],
          },
        ],
        overallComplianceLevel: 'NON_COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('外国人在泰经商分析...', 'THAILAND');

      expect(result.hasComplianceRisks).toBe(true);
      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].severity).toBe('HIGH');
      expect(result.overallComplianceLevel).toBe('NON_COMPLIANT');
    });

    it('should detect compliance risks in DUAL jurisdiction', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          {
            riskDescription: '跨境数据传输未经审批',
            severity: 'HIGH',
            legalBasis: '《数据安全法》',
            alternatives: ['申请数据出境安全评估'],
          },
          {
            riskDescription: '泰国分公司注册文件不完整',
            severity: 'LOW',
            legalBasis: 'Thai Civil and Commercial Code',
            alternatives: ['补充提交所需注册文件'],
          },
        ],
        overallComplianceLevel: 'NON_COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('中泰跨境业务分析...', 'DUAL');

      expect(result.hasComplianceRisks).toBe(true);
      expect(result.risks).toHaveLength(2);
    });
  });

  // ─── No risks (compliant) ──────────────────────────────────

  describe('annotate() — compliant content', () => {
    it('should return COMPLIANT when no risks are found', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: [],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('完全合规的法律分析...', 'CHINA');

      expect(result.hasComplianceRisks).toBe(false);
      expect(result.risks).toHaveLength(0);
      expect(result.overallComplianceLevel).toBe('COMPLIANT');
    });
  });

  // ─── Key property: every risk has at least one alternative ──

  describe('annotate() — alternatives invariant (Requirement 3.5)', () => {
    it('should ensure every risk has at least one alternative', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          {
            riskDescription: '风险1',
            severity: 'HIGH',
            legalBasis: '法律A',
            alternatives: ['方案1', '方案2'],
          },
          {
            riskDescription: '风险2',
            severity: 'MEDIUM',
            legalBasis: '法律B',
            alternatives: ['方案3'],
          },
        ],
        overallComplianceLevel: 'NON_COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析内容...', 'CHINA');

      for (const risk of result.risks) {
        expect(risk.alternatives.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should add default alternative when LLM returns empty alternatives', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          {
            riskDescription: '缺少替代方案的风险',
            severity: 'MEDIUM',
            legalBasis: '某法律',
            alternatives: [],
          },
        ],
        overallComplianceLevel: 'MAJOR_ISSUES',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析内容...', 'THAILAND');

      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].alternatives.length).toBeGreaterThanOrEqual(1);
    });

    it('should add default alternative when LLM omits alternatives field', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          {
            riskDescription: '没有alternatives字段的风险',
            severity: 'LOW',
            legalBasis: '某法规',
            // alternatives field missing entirely
          },
        ],
        overallComplianceLevel: 'MINOR_ISSUES',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析内容...', 'DUAL');

      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].alternatives.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter out empty string alternatives and add default if none remain', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          {
            riskDescription: '空字符串替代方案',
            severity: 'MEDIUM',
            legalBasis: '法律X',
            alternatives: ['', '  ', ''],
          },
        ],
        overallComplianceLevel: 'MAJOR_ISSUES',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析内容...', 'CHINA');

      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].alternatives.length).toBeGreaterThanOrEqual(1);
      // All alternatives should be non-empty strings
      for (const alt of result.risks[0].alternatives) {
        expect(alt.trim().length).toBeGreaterThan(0);
      }
    });
  });

  // ─── Severity normalization ────────────────────────────────

  describe('annotate() — severity normalization', () => {
    it('should normalize lowercase severity values', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '风险A', severity: 'high', legalBasis: '法律', alternatives: ['方案'] },
          { riskDescription: '风险B', severity: 'medium', legalBasis: '法律', alternatives: ['方案'] },
          { riskDescription: '风险C', severity: 'low', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'NON_COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'CHINA');

      expect(result.risks[0].severity).toBe('HIGH');
      expect(result.risks[1].severity).toBe('MEDIUM');
      expect(result.risks[2].severity).toBe('LOW');
    });

    it('should default to MEDIUM for invalid severity values', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '风险', severity: 'CRITICAL', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'MAJOR_ISSUES',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'THAILAND');

      expect(result.risks[0].severity).toBe('MEDIUM');
    });

    it('should default to MEDIUM when severity is missing', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '风险', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'MAJOR_ISSUES',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'CHINA');

      expect(result.risks[0].severity).toBe('MEDIUM');
    });
  });

  // ─── Overall compliance level computation ──────────────────

  describe('annotate() — overall compliance level', () => {
    it('should compute NON_COMPLIANT when any HIGH risk exists', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '高风险', severity: 'HIGH', legalBasis: '法律', alternatives: ['方案'] },
          { riskDescription: '低风险', severity: 'LOW', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'MINOR_ISSUES', // LLM says wrong level
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'CHINA');

      // Should override LLM's incorrect level
      expect(result.overallComplianceLevel).toBe('NON_COMPLIANT');
    });

    it('should compute MAJOR_ISSUES when MEDIUM risk exists but no HIGH', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '中风险', severity: 'MEDIUM', legalBasis: '法律', alternatives: ['方案'] },
          { riskDescription: '低风险', severity: 'LOW', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'MINOR_ISSUES',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'THAILAND');

      expect(result.overallComplianceLevel).toBe('MAJOR_ISSUES');
    });

    it('should compute MINOR_ISSUES when only LOW risks exist', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '低风险1', severity: 'LOW', legalBasis: '法律', alternatives: ['方案'] },
          { riskDescription: '低风险2', severity: 'LOW', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'DUAL');

      expect(result.overallComplianceLevel).toBe('MINOR_ISSUES');
    });

    it('should compute COMPLIANT when no risks exist', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: [],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('合规内容...', 'CHINA');

      expect(result.overallComplianceLevel).toBe('COMPLIANT');
    });
  });

  // ─── Degraded fallback ─────────────────────────────────────

  describe('annotate() — degraded fallback', () => {
    it('should return degraded annotation when both LLM providers fail', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析内容...', 'CHINA');

      expect(result.hasComplianceRisks).toBe(true);
      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].severity).toBe('MEDIUM');
      expect(result.risks[0].alternatives.length).toBeGreaterThanOrEqual(1);
      expect(result.overallComplianceLevel).toBe('MAJOR_ISSUES');
    });
  });

  // ─── Normalization edge cases ──────────────────────────────

  describe('annotate() — normalization edge cases', () => {
    it('should filter out risks with empty riskDescription', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '', severity: 'HIGH', legalBasis: '法律', alternatives: ['方案'] },
          { riskDescription: '有效风险', severity: 'LOW', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'NON_COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'CHINA');

      expect(result.risks).toHaveLength(1);
      expect(result.risks[0].riskDescription).toBe('有效风险');
    });

    it('should provide default legalBasis when missing', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '风险', severity: 'LOW', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'MINOR_ISSUES',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'THAILAND');

      expect(result.risks[0].legalBasis).toBe('相关法律法规');
    });

    it('should handle null risks array gracefully', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: null as unknown as undefined,
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'CHINA');

      expect(result.hasComplianceRisks).toBe(false);
      expect(result.risks).toHaveLength(0);
      expect(result.overallComplianceLevel).toBe('COMPLIANT');
    });

    it('should handle non-array risks gracefully', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: 'not an array' as unknown as undefined,
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'DUAL');

      expect(result.risks).toHaveLength(0);
      expect(result.hasComplianceRisks).toBe(false);
    });

    it('should set hasComplianceRisks based on actual risks count, not LLM value', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false, // LLM says no risks
        risks: [
          { riskDescription: '实际存在的风险', severity: 'LOW', legalBasis: '法律', alternatives: ['方案'] },
        ],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('分析...', 'CHINA');

      // Should be true because there are actual risks
      expect(result.hasComplianceRisks).toBe(true);
      expect(result.risks).toHaveLength(1);
    });
  });

  // ─── LLM call configuration ────────────────────────────────

  describe('annotate() — LLM call configuration', () => {
    it('should use json_object response format and low temperature', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: [],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      await annotator.annotate('分析内容...', 'CHINA');

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should include jurisdiction label in user prompt for CHINA', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: [],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      await annotator.annotate('分析内容...', 'CHINA');

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('中国法域');
    });

    it('should include jurisdiction label in user prompt for THAILAND', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: [],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      await annotator.annotate('分析内容...', 'THAILAND');

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('泰国法域');
    });

    it('should include jurisdiction label in user prompt for DUAL', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: [],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      await annotator.annotate('分析内容...', 'DUAL');

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('中泰双重法域');
    });

    it('should include analysis content in user prompt', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: false,
        risks: [],
        overallComplianceLevel: 'COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      await annotator.annotate('特定的法律分析内容用于测试', 'CHINA');

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('特定的法律分析内容用于测试');
    });
  });

  // ─── Singleton pattern ─────────────────────────────────────

  describe('singleton pattern', () => {
    it('getComplianceAnnotator should return the same instance', () => {
      const a = getComplianceAnnotator();
      const b = getComplianceAnnotator();
      expect(a).toBe(b);
    });

    it('resetComplianceAnnotator should create a new instance', () => {
      const a = getComplianceAnnotator();
      resetComplianceAnnotator();
      const b = getComplianceAnnotator();
      expect(a).not.toBe(b);
    });
  });

  // ─── Multiple risks with mixed severities ──────────────────

  describe('annotate() — multiple risks', () => {
    it('should handle multiple risks with different severities', async () => {
      mockOpenAIJsonResponse({
        hasComplianceRisks: true,
        risks: [
          { riskDescription: '高风险项', severity: 'HIGH', legalBasis: '《公司法》', alternatives: ['方案A'] },
          { riskDescription: '中风险项', severity: 'MEDIUM', legalBasis: '《劳动法》', alternatives: ['方案B', '方案C'] },
          { riskDescription: '低风险项', severity: 'LOW', legalBasis: '《合同法》', alternatives: ['方案D'] },
        ],
        overallComplianceLevel: 'NON_COMPLIANT',
      });

      const annotator = new ComplianceAnnotator();
      const result = await annotator.annotate('综合法律分析...', 'DUAL');

      expect(result.risks).toHaveLength(3);
      expect(result.overallComplianceLevel).toBe('NON_COMPLIANT');

      // Verify each risk has required fields
      for (const risk of result.risks) {
        expect(risk.riskDescription).toBeTruthy();
        expect(risk.legalBasis).toBeTruthy();
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(risk.severity);
        expect(risk.alternatives.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});
