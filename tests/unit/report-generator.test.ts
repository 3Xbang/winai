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

function makeAnalysisResult(overrides: Record<string, unknown> = {}) {
  return {
    jurisdiction: 'CHINA' as const,
    query: '我想在上海注册一家有限责任公司',
    ...overrides,
  };
}

function makeFullLLMReport(overrides: Record<string, unknown> = {}) {
  return {
    title: '法律分析报告：上海公司注册',
    summary: '根据中国公司法，在上海注册有限责任公司需要满足注册资本、股东人数等基本条件。',
    legalAnalysis: '依据《公司法》第二十三条，设立有限责任公司应当具备法定条件。',
    strategyAdvice: '建议先确定注册资本和股东结构，然后通过上海市市场监督管理局办理注册。',
    actionPlan: [
      '第一步：确定公司名称并进行名称预核准',
      '第二步：准备公司章程和股东协议',
      '第三步：向市场监督管理局提交注册申请',
    ],
    caseReferences: [
      '（2022）沪01民终1234号：类似公司注册纠纷案例，法院认定注册程序合规。',
    ],
    disclaimer: '本报告由AI法律专家系统自动生成，仅供参考，不构成正式法律意见。请咨询专业律师。',
    ...overrides,
  };
}

describe('ReportGenerator', () => {
  let ReportGenerator: typeof import('@/server/services/report/generator').ReportGenerator;
  let resetReportGenerator: typeof import('@/server/services/report/generator').resetReportGenerator;
  let getReportGenerator: typeof import('@/server/services/report/generator').getReportGenerator;
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

    const mod = await import('@/server/services/report/generator');
    ReportGenerator = mod.ReportGenerator;
    resetReportGenerator = mod.resetReportGenerator;
    getReportGenerator = mod.getReportGenerator;
    resetReportGenerator();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── 1. Report generation with all 6 sections ──────────────

  describe('generate() — all 6 sections present and non-empty', () => {
    it('should generate a report with all six sections non-empty', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult(), 'STANDARD');

      expect(report.summary).toBeTruthy();
      expect(report.legalAnalysis).toBeTruthy();
      expect(report.strategyAdvice).toBeTruthy();
      expect(report.actionPlan.length).toBeGreaterThan(0);
      expect(report.caseReferences.length).toBeGreaterThan(0);
      expect(report.disclaimer).toBeTruthy();
    });

    it('should include id, title, jurisdiction, generatedAt, and format', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult(), 'STANDARD');

      expect(report.id).toMatch(/^rpt_/);
      expect(report.title).toBeTruthy();
      expect(report.jurisdiction).toBe('CHINA');
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.format).toBe('STANDARD');
    });
  });

  // ─── 2. Different report formats ───────────────────────────

  describe('generate() — different report formats', () => {
    it('should generate STANDARD format report', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult(), 'STANDARD');

      expect(report.format).toBe('STANDARD');
      // Verify the prompt includes standard format instruction
      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('标准详细程度');
    });

    it('should generate DETAILED format report', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult(), 'DETAILED');

      expect(report.format).toBe('DETAILED');
      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('最详细的程度');
    });

    it('should generate EXECUTIVE format report', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult(), 'EXECUTIVE');

      expect(report.format).toBe('EXECUTIVE');
      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('精简摘要');
    });

    it('should default to STANDARD when no format is specified', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.format).toBe('STANDARD');
    });
  });

  // ─── 3. Different jurisdictions ────────────────────────────

  describe('generate() — different jurisdictions', () => {
    it('should handle CHINA jurisdiction', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult({ jurisdiction: 'CHINA' }));

      expect(report.jurisdiction).toBe('CHINA');
    });

    it('should handle THAILAND jurisdiction', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult({ jurisdiction: 'THAILAND' }));

      expect(report.jurisdiction).toBe('THAILAND');
    });

    it('should handle DUAL jurisdiction', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult({ jurisdiction: 'DUAL' }));

      expect(report.jurisdiction).toBe('DUAL');
    });

    it('should include jurisdiction in the LLM prompt', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      await generator.generate(makeAnalysisResult({ jurisdiction: 'DUAL' }));

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('DUAL');
    });
  });

  // ─── 4. actionPlan is a non-empty ordered array ────────────

  describe('generate() — actionPlan validation', () => {
    it('should return actionPlan as a non-empty array', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(Array.isArray(report.actionPlan)).toBe(true);
      expect(report.actionPlan.length).toBeGreaterThan(0);
      report.actionPlan.forEach((step) => {
        expect(typeof step).toBe('string');
        expect(step.trim().length).toBeGreaterThan(0);
      });
    });

    it('should provide fallback actionPlan when LLM returns empty array', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport({ actionPlan: [] }));

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.actionPlan.length).toBeGreaterThan(0);
    });
  });

  // ─── 5. disclaimer is always present ───────────────────────

  describe('generate() — disclaimer always present', () => {
    it('should always include a non-empty disclaimer', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.disclaimer).toBeTruthy();
      expect(report.disclaimer.length).toBeGreaterThan(0);
    });

    it('should provide default disclaimer when LLM returns empty string', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport({ disclaimer: '' }));

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.disclaimer).toBeTruthy();
      expect(report.disclaimer).toContain('不构成正式法律意见');
    });

    it('should provide default disclaimer when LLM omits it', async () => {
      const llmResponse = makeFullLLMReport();
      delete (llmResponse as Record<string, unknown>).disclaimer;
      mockOpenAIJsonResponse(llmResponse);

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.disclaimer).toBeTruthy();
    });
  });

  // ─── 6. Degraded fallback behavior ─────────────────────────

  describe('generate() — degraded fallback', () => {
    it('should return a degraded report when both LLM providers fail', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult(), 'STANDARD');

      expect(report.summary).toBeTruthy();
      expect(report.legalAnalysis).toBeTruthy();
      expect(report.strategyAdvice).toBeTruthy();
      expect(report.actionPlan.length).toBeGreaterThan(0);
      expect(report.caseReferences.length).toBeGreaterThan(0);
      expect(report.disclaimer).toBeTruthy();
      expect(report.jurisdiction).toBe('CHINA');
      expect(report.format).toBe('STANDARD');
    });
  });

  // ─── 7. Normalization edge cases ───────────────────────────

  describe('generate() — normalization edge cases', () => {
    it('should handle missing summary field', async () => {
      const llmResponse = makeFullLLMReport();
      delete (llmResponse as Record<string, unknown>).summary;
      mockOpenAIJsonResponse(llmResponse);

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.summary).toBeTruthy();
    });

    it('should handle missing legalAnalysis field', async () => {
      const llmResponse = makeFullLLMReport();
      delete (llmResponse as Record<string, unknown>).legalAnalysis;
      mockOpenAIJsonResponse(llmResponse);

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.legalAnalysis).toBeTruthy();
    });

    it('should handle whitespace-only strings as empty', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport({
        summary: '   ',
        strategyAdvice: '\n\t',
      }));

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.summary).toBeTruthy();
      expect(report.summary.trim().length).toBeGreaterThan(0);
      expect(report.strategyAdvice).toBeTruthy();
      expect(report.strategyAdvice.trim().length).toBeGreaterThan(0);
    });

    it('should filter out empty strings from actionPlan array', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport({
        actionPlan: ['步骤1', '', '  ', '步骤2'],
      }));

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(report.actionPlan.length).toBe(2);
      expect(report.actionPlan[0]).toBe('步骤1');
      expect(report.actionPlan[1]).toBe('步骤2');
    });

    it('should handle non-array actionPlan gracefully', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport({ actionPlan: 'not an array' }));

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(Array.isArray(report.actionPlan)).toBe(true);
      expect(report.actionPlan.length).toBeGreaterThan(0);
    });

    it('should handle non-array caseReferences gracefully', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport({ caseReferences: null }));

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());

      expect(Array.isArray(report.caseReferences)).toBe(true);
      expect(report.caseReferences.length).toBeGreaterThan(0);
    });
  });

  // ─── 8. PDF export ─────────────────────────────────────────

  describe('exportPDF()', () => {
    it('should return a Buffer', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());
      const pdf = await generator.exportPDF(report);

      expect(Buffer.isBuffer(pdf)).toBe(true);
      expect(pdf.length).toBeGreaterThan(0);
    });

    it('should contain report content in the HTML buffer', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      const report = await generator.generate(makeAnalysisResult());
      const pdf = await generator.exportPDF(report);
      const html = pdf.toString('utf-8');

      expect(html).toContain(report.title);
      expect(html).toContain(report.summary);
      expect(html).toContain(report.disclaimer);
      expect(html).toContain('核心结论摘要');
      expect(html).toContain('免责声明');
    });
  });

  // ─── 9. Singleton pattern ──────────────────────────────────

  describe('singleton pattern', () => {
    it('getReportGenerator should return the same instance', () => {
      const a = getReportGenerator();
      const b = getReportGenerator();
      expect(a).toBe(b);
    });

    it('resetReportGenerator should clear the singleton', () => {
      const a = getReportGenerator();
      resetReportGenerator();
      const b = getReportGenerator();
      expect(a).not.toBe(b);
    });
  });

  // ─── 10. LLM call configuration ───────────────────────────

  describe('generate() — LLM call configuration', () => {
    it('should use json_object response format and low temperature', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      await generator.generate(makeAnalysisResult());

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should include system prompt with report structure requirements', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      await generator.generate(makeAnalysisResult());

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('核心结论摘要');
      expect(systemMessage?.content).toContain('法律依据分析');
      expect(systemMessage?.content).toContain('免责声明');
    });
  });

  // ─── 11. Analysis details in prompt ────────────────────────

  describe('generate() — analysis details in prompt', () => {
    it('should include IRAC analysis in the prompt when provided', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      await generator.generate(makeAnalysisResult({
        iracAnalysis: 'IRAC分析：争议焦点为公司注册条件',
      }));

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('IRAC分析');
    });

    it('should include contract review in the prompt when provided', async () => {
      mockOpenAIJsonResponse(makeFullLLMReport());

      const generator = new ReportGenerator();
      await generator.generate(makeAnalysisResult({
        contractReview: '合同审查发现3个高风险条款',
      }));

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('合同审查发现3个高风险条款');
    });
  });
});
