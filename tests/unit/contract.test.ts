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

function mockOpenAITextResponse(text: string) {
  mockOpenAICreate.mockResolvedValue({
    choices: [{ message: { content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 500, total_tokens: 600 },
  });
}

function mockOpenAIJsonResponse(jsonObj: Record<string, unknown>) {
  mockOpenAICreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(jsonObj) }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 100, completion_tokens: 500, total_tokens: 600 },
  });
}

import type {
  ContractDraftRequest,
  ContractReviewResult,
  PartyInfo,
} from '@/server/services/legal/contract';
import type { JurisdictionResult } from '@/server/services/legal/jurisdiction';

// ─── Test Fixtures ──────────────────────────────────────────

const chinaJurisdiction: JurisdictionResult = {
  jurisdiction: 'CHINA',
  confidence: 0.95,
  chinaLaws: [{ lawName: '《民法典》', articleNumber: '合同编', description: '合同法律规定' }],
};

const thailandJurisdiction: JurisdictionResult = {
  jurisdiction: 'THAILAND',
  confidence: 0.9,
  thailandLaws: [{ lawName: 'Civil and Commercial Code', description: 'Contract provisions' }],
};

const dualJurisdiction: JurisdictionResult = {
  jurisdiction: 'DUAL',
  confidence: 0.85,
  chinaLaws: [{ lawName: '《外商投资法》', description: '外商投资规定' }],
  thailandLaws: [{ lawName: 'Foreign Business Act', description: 'Foreign business regulations' }],
};

const sampleParties: PartyInfo[] = [
  { name: '张三', role: '甲方', nationality: '中国', address: '北京市朝阳区' },
  { name: 'Somchai', role: '乙方', nationality: '泰国', address: 'Bangkok' },
];

const sampleKeyTerms: Record<string, string> = {
  '租赁期限': '2年',
  '月租金': '50000元',
  '押金': '3个月租金',
};

function buildDraftRequest(overrides: Partial<ContractDraftRequest> = {}): ContractDraftRequest {
  return {
    contractType: 'LEASE',
    parties: sampleParties,
    keyTerms: sampleKeyTerms,
    languages: ['zh'],
    jurisdiction: chinaJurisdiction,
    ...overrides,
  };
}

describe('ContractAnalyzer', () => {
  let ContractAnalyzer: typeof import('@/server/services/legal/contract').ContractAnalyzer;
  let resetContractAnalyzer: typeof import('@/server/services/legal/contract').resetContractAnalyzer;
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

    const mod = await import('@/server/services/legal/contract');
    ContractAnalyzer = mod.ContractAnalyzer;
    resetContractAnalyzer = mod.resetContractAnalyzer;
    resetContractAnalyzer();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── draft() Tests ──────────────────────────────────────

  describe('draft()', () => {
    it('should draft a lease contract in Chinese', async () => {
      const contractText = `租赁合同

甲方：张三
乙方：Somchai

第一条 租赁标的
...
第十条 适用法律
本合同适用中华人民共和国法律。

第十一条 争议解决
因本合同引起的争议，双方协商解决；协商不成的，提交北京仲裁委员会仲裁。`;

      mockOpenAITextResponse(contractText);

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.draft(buildDraftRequest());

      expect(result).toContain('租赁合同');
      expect(result).toContain('张三');
      expect(result).toContain('Somchai');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include contract type in the LLM prompt', async () => {
      mockOpenAITextResponse('Service Agreement content...');

      const analyzer = new ContractAnalyzer();
      await analyzer.draft(buildDraftRequest({ contractType: 'SERVICE' }));

      expect(mockOpenAICreate).toHaveBeenCalledOnce();
      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('服务合同');
    });

    it('should support multi-language output request', async () => {
      const multiLangContract = `中文版本...
===LANGUAGE_SEPARATOR===
English version...`;

      mockOpenAITextResponse(multiLangContract);

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.draft(buildDraftRequest({ languages: ['zh', 'en'] }));

      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should pass jurisdiction info to the LLM prompt', async () => {
      mockOpenAITextResponse('Contract with dual jurisdiction...');

      const analyzer = new ContractAnalyzer();
      await analyzer.draft(buildDraftRequest({ jurisdiction: dualJurisdiction }));

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('双重管辖');
    });

    it('should support all 6 contract types', async () => {
      const types: ContractDraftRequest['contractType'][] = [
        'LEASE', 'SALE', 'PARTNERSHIP', 'EMPLOYMENT', 'SERVICE', 'OTHER',
      ];

      for (const contractType of types) {
        mockOpenAICreate.mockReset();
        mockOpenAITextResponse(`${contractType} contract content`);

        const analyzer = new ContractAnalyzer();
        const result = await analyzer.draft(buildDraftRequest({ contractType }));
        expect(result).toBeTruthy();
      }
    });

    it('should return degraded draft when LLM is unavailable', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.draft(buildDraftRequest());

      expect(result).toContain('AI 服务降级');
      expect(result).toContain('租赁合同');
      expect(result).toContain('张三');
    });

    it('should include system prompt with drafting rules', async () => {
      mockOpenAITextResponse('Contract...');

      const analyzer = new ContractAnalyzer();
      await analyzer.draft(buildDraftRequest());

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const systemMessage = callArgs.messages.find((m) => m.role === 'system');
      expect(systemMessage?.content).toContain('适用法律条款');
      expect(systemMessage?.content).toContain('争议解决条款');
    });
  });

  // ─── review() Tests ─────────────────────────────────────

  describe('review()', () => {
    const sampleContractText = `第一条 租赁标的
甲方将位于北京市朝阳区的房屋出租给乙方使用。

第二条 租赁期限
租赁期限为2年，自2024年1月1日起至2025年12月31日止。

第三条 租金
月租金为人民币50000元。`;

    it('should review a contract and return risks', async () => {
      mockOpenAIJsonResponse({
        risks: [
          {
            clauseIndex: 1,
            clauseText: '甲方将位于北京市朝阳区的房屋出租给乙方使用。',
            riskLevel: 'MEDIUM',
            riskDescription: '租赁标的描述不够具体，缺少房屋面积、楼层等详细信息。',
            legalBasis: [
              { lawName: '《民法典》', articleNumber: '第七百零三条', description: '租赁合同内容要求' },
            ],
            suggestedRevision: '甲方将位于北京市朝阳区XX路XX号XX楼XX室（建筑面积XX平方米）的房屋出租给乙方使用。',
          },
        ],
        overallRiskLevel: 'MEDIUM',
        reviewReport: '合同整体结构基本完整，但存在部分条款表述不够严谨的问题。',
        suggestedRevisions: [
          {
            clauseIndex: 1,
            originalText: '甲方将位于北京市朝阳区的房屋出租给乙方使用。',
            revisedText: '甲方将位于北京市朝阳区XX路XX号XX楼XX室的房屋出租给乙方使用。',
            reason: '需要明确租赁标的的具体信息',
          },
        ],
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      expect(result.risks).toBeDefined();
      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.overallRiskLevel).toBe('MEDIUM');
      expect(result.reviewReport).toBeTruthy();
      expect(result.suggestedRevisions).toBeDefined();
    });

    it('should ensure HIGH risk items have legal basis', async () => {
      mockOpenAIJsonResponse({
        risks: [
          {
            clauseIndex: 2,
            clauseText: '违约金为合同总额的200%',
            riskLevel: 'HIGH',
            riskDescription: '违约金过高，可能被法院调整。',
            legalBasis: [
              { lawName: '《民法典》', articleNumber: '第五百八十五条', description: '违约金调整规则' },
            ],
            suggestedRevision: '违约金不超过实际损失的30%。',
          },
        ],
        overallRiskLevel: 'HIGH',
        reviewReport: '合同存在高风险条款。',
        suggestedRevisions: [],
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      const highRisks = result.risks.filter(r => r.riskLevel === 'HIGH');
      expect(highRisks.length).toBeGreaterThan(0);
      for (const risk of highRisks) {
        expect(risk.legalBasis.length).toBeGreaterThan(0);
        expect(risk.legalBasis[0]?.lawName).toBeTruthy();
      }
    });

    it('should add fallback legal basis for HIGH risk without legalBasis', async () => {
      mockOpenAIJsonResponse({
        risks: [
          {
            clauseIndex: 1,
            clauseText: '某条款',
            riskLevel: 'HIGH',
            riskDescription: '高风险描述',
            legalBasis: [],
            suggestedRevision: '修改建议',
          },
        ],
        overallRiskLevel: 'HIGH',
        reviewReport: '存在高风险。',
        suggestedRevisions: [],
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      const highRisk = result.risks.find(r => r.riskLevel === 'HIGH');
      expect(highRisk).toBeDefined();
      expect(highRisk!.legalBasis.length).toBeGreaterThan(0);
    });

    it('should derive overallRiskLevel from highest individual risk', async () => {
      mockOpenAIJsonResponse({
        risks: [
          { clauseIndex: 1, clauseText: 'a', riskLevel: 'LOW', riskDescription: 'low', legalBasis: [], suggestedRevision: 'x' },
          { clauseIndex: 2, clauseText: 'b', riskLevel: 'HIGH', riskDescription: 'high', legalBasis: [{ lawName: '法律', articleNumber: '1', description: '' }], suggestedRevision: 'y' },
        ],
        overallRiskLevel: 'LOW', // intentionally wrong — should be overridden
        reviewReport: '报告',
        suggestedRevisions: [],
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      expect(result.overallRiskLevel).toBe('HIGH');
    });

    it('should return degraded review when LLM is unavailable', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      expect(result.overallRiskLevel).toBeTruthy();
      expect(result.reviewReport).toContain('AI 服务暂时不可用');
      expect(result.risks.length).toBeGreaterThan(0);
    });

    it('should handle malformed JSON gracefully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'not valid json {{{' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      // Should return degraded review instead of throwing
      expect(result.overallRiskLevel).toBeTruthy();
      expect(result.reviewReport).toBeTruthy();
      expect(result.risks.length).toBeGreaterThan(0);
    });

    it('should use json_object response format for review', async () => {
      mockOpenAIJsonResponse({
        risks: [],
        overallRiskLevel: 'LOW',
        reviewReport: '无风险',
        suggestedRevisions: [],
      });

      const analyzer = new ContractAnalyzer();
      await analyzer.review(sampleContractText, chinaJurisdiction);

      expect(mockOpenAICreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        }),
      );
    });

    it('should include jurisdiction laws in the review prompt', async () => {
      mockOpenAIJsonResponse({
        risks: [{ clauseIndex: 1, clauseText: 'x', riskLevel: 'LOW', riskDescription: 'ok', legalBasis: [], suggestedRevision: 'ok' }],
        overallRiskLevel: 'LOW',
        reviewReport: '报告',
        suggestedRevisions: [],
      });

      const analyzer = new ContractAnalyzer();
      await analyzer.review(sampleContractText, dualJurisdiction);

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find((m) => m.role === 'user');
      expect(userMessage?.content).toContain('《外商投资法》');
      expect(userMessage?.content).toContain('Foreign Business Act');
    });

    it('should provide default risk when LLM returns empty risks array', async () => {
      mockOpenAIJsonResponse({
        risks: [],
        overallRiskLevel: 'LOW',
        reviewReport: '合同无明显风险',
        suggestedRevisions: [],
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      expect(result.risks.length).toBeGreaterThan(0);
      expect(result.risks[0]?.riskLevel).toBe('LOW');
    });

    it('should normalize risk levels from lowercase', async () => {
      mockOpenAIJsonResponse({
        risks: [
          { clauseIndex: 1, clauseText: 'clause', riskLevel: 'medium', riskDescription: 'desc', legalBasis: [], suggestedRevision: 'rev' },
        ],
        overallRiskLevel: 'medium',
        reviewReport: '报告',
        suggestedRevisions: [],
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review(sampleContractText, chinaJurisdiction);

      expect(result.risks[0]?.riskLevel).toBe('MEDIUM');
      expect(result.overallRiskLevel).toBe('MEDIUM');
    });
  });

  // ─── Clause Revision Tests ──────────────────────────────

  describe('review() — suggestedRevisions', () => {
    it('should return clause revisions with all required fields', async () => {
      mockOpenAIJsonResponse({
        risks: [
          { clauseIndex: 1, clauseText: 'x', riskLevel: 'MEDIUM', riskDescription: 'desc', legalBasis: [], suggestedRevision: 'rev' },
        ],
        overallRiskLevel: 'MEDIUM',
        reviewReport: '报告',
        suggestedRevisions: [
          {
            clauseIndex: 1,
            originalText: '原始条款',
            revisedText: '修改后条款',
            reason: '修改理由',
          },
        ],
      });

      const analyzer = new ContractAnalyzer();
      const result = await analyzer.review('合同文本', chinaJurisdiction);

      expect(result.suggestedRevisions.length).toBe(1);
      const rev = result.suggestedRevisions[0]!;
      expect(rev.clauseIndex).toBe(1);
      expect(rev.originalText).toBe('原始条款');
      expect(rev.revisedText).toBe('修改后条款');
      expect(rev.reason).toBe('修改理由');
    });
  });
});
