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

function buildSampleIssues() {
  return [
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
  ];
}

function buildSampleEvidenceItems() {
  return [
    {
      description: '房屋租赁合同原件',
      type: 'DOCUMENTARY' as const,
      strength: 'STRONG' as const,
      strengthReason: '直接证明合同关系成立，原件证明力强',
    },
    {
      description: '银行转账记录',
      type: 'ELECTRONIC' as const,
      strength: 'STRONG' as const,
      strengthReason: '银行系统记录，客观可靠',
    },
    {
      description: '微信催款聊天记录',
      type: 'ELECTRONIC' as const,
      strength: 'MEDIUM' as const,
      strengthReason: '电子证据需要公证保全',
      legalityRisk: '聊天记录可能被质疑真实性',
      alternativeCollection: '建议通过公证处进行证据保全',
    },
  ];
}

function buildFullChecklistResponse(): Record<string, unknown> {
  return {
    evidenceItems: [
      {
        description: '房屋租赁合同原件',
        type: 'DOCUMENTARY',
        strength: 'STRONG',
        strengthReason: '直接证明合同关系成立，原件证明力强',
        legalityRisk: '',
        alternativeCollection: '',
      },
      {
        description: '银行转账记录',
        type: 'ELECTRONIC',
        strength: 'STRONG',
        strengthReason: '银行系统记录，客观可靠',
        legalityRisk: '',
        alternativeCollection: '',
      },
      {
        description: '催款通知函及送达回执',
        type: 'DOCUMENTARY',
        strength: 'MEDIUM',
        strengthReason: '证明已履行催告义务，但需要送达证明配合',
        legalityRisk: '',
        alternativeCollection: '',
      },
      {
        description: '私自录制的电话录音',
        type: 'ELECTRONIC',
        strength: 'MEDIUM',
        strengthReason: '可证明催告事实，但录音证据证明力受限',
        legalityRisk: '未经对方同意录音可能被认定为非法取证',
        alternativeCollection: '建议通过书面催告函或公证送达方式替代',
      },
    ],
  };
}

function buildFullAssessmentResponse(): Record<string, unknown> {
  return {
    overallStrength: 'MEDIUM',
    items: [
      {
        description: '房屋租赁合同原件',
        type: 'DOCUMENTARY',
        strength: 'STRONG',
        strengthReason: '直接证明合同关系成立',
        legalityRisk: '',
        alternativeCollection: '',
      },
      {
        description: '银行转账记录',
        type: 'ELECTRONIC',
        strength: 'STRONG',
        strengthReason: '银行系统记录，客观可靠',
        legalityRisk: '',
        alternativeCollection: '',
      },
      {
        description: '微信催款聊天记录',
        type: 'ELECTRONIC',
        strength: 'MEDIUM',
        strengthReason: '电子证据需要公证保全',
        legalityRisk: '聊天记录可能被质疑真实性',
        alternativeCollection: '建议通过公证处进行证据保全',
      },
    ],
    summary: '证据链基本完整，合同和银行记录证明力强，但催款证据需要加强保全。建议补充公证保全的电子证据。',
  };
}

function buildFullGapsResponse(): Record<string, unknown> {
  return {
    gaps: [
      {
        issue: '租金支付违约',
        missingEvidence: '租金支付截止日期的书面约定或补充协议',
        importance: 'IMPORTANT',
        suggestion: '收集合同中关于租金支付日期的条款，或双方关于支付安排的书面沟通记录。',
      },
      {
        issue: '合同解除权',
        missingEvidence: '书面解除通知及送达证明',
        importance: 'CRITICAL',
        suggestion: '通过EMS或公证送达方式向被告发送合同解除通知，并保留送达回执。',
      },
    ],
  };
}

describe('EvidenceOrganizer', () => {
  let EvidenceOrganizer: typeof import('@/server/services/legal/evidence').EvidenceOrganizer;
  let resetEvidenceOrganizer: typeof import('@/server/services/legal/evidence').resetEvidenceOrganizer;
  let resetLLMGateway: typeof import('@/server/services/llm/gateway').resetLLMGateway;

  beforeEach(async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    vi.stubEnv('OPENAI_MODEL', 'gpt-4');
    mockOpenAICreate.mockReset();
    mockAnthropicCreate.mockReset();

    const llmMod = await import('@/server/services/llm/gateway');
    resetLLMGateway = llmMod.resetLLMGateway;
    resetLLMGateway();

    const mod = await import('@/server/services/legal/evidence');
    EvidenceOrganizer = mod.EvidenceOrganizer;
    resetEvidenceOrganizer = mod.resetEvidenceOrganizer;
    resetEvidenceOrganizer();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // ─── generateChecklist() ────────────────────────────────

  describe('generateChecklist()', () => {
    it('should return evidence items with valid type, strength, and strengthReason', async () => {
      mockOpenAIJsonResponse(buildFullChecklistResponse());

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      expect(result.length).toBeGreaterThan(0);
      const validTypes = ['DOCUMENTARY', 'PHYSICAL', 'TESTIMONY', 'ELECTRONIC', 'EXPERT_OPINION'];
      const validStrengths = ['STRONG', 'MEDIUM', 'WEAK'];

      result.forEach(item => {
        expect(item.description).toBeTruthy();
        expect(validTypes).toContain(item.type);
        expect(validStrengths).toContain(item.strength);
        expect(item.strengthReason).toBeTruthy();
      });
    });

    it('should ensure alternativeCollection is non-empty when legalityRisk is non-empty', async () => {
      mockOpenAIJsonResponse(buildFullChecklistResponse());

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      result.forEach(item => {
        if (item.legalityRisk && item.legalityRisk.trim()) {
          expect(item.alternativeCollection).toBeTruthy();
        }
      });
    });

    it('should auto-fill alternativeCollection when legalityRisk is present but alternativeCollection is missing', async () => {
      mockOpenAIJsonResponse({
        evidenceItems: [
          {
            description: '私自录音',
            type: 'ELECTRONIC',
            strength: 'WEAK',
            strengthReason: '录音证据证明力受限',
            legalityRisk: '未经同意录音',
            // alternativeCollection intentionally missing
          },
        ],
      });

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      expect(result[0]!.legalityRisk).toBeTruthy();
      expect(result[0]!.alternativeCollection).toBeTruthy();
    });

    it('should include issues in the LLM prompt', async () => {
      mockOpenAIJsonResponse(buildFullChecklistResponse());

      const organizer = new EvidenceOrganizer();
      await organizer.generateChecklist(buildSampleIssues());

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('租金支付违约');
      expect(userMessage?.content).toContain('合同解除权');
    });

    it('should use json_object response format and low temperature', async () => {
      mockOpenAIJsonResponse(buildFullChecklistResponse());

      const organizer = new EvidenceOrganizer();
      await organizer.generateChecklist(buildSampleIssues());

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

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      expect(result.length).toBeGreaterThan(0);
      result.forEach(item => {
        expect(item.description).toBeTruthy();
        expect(item.type).toBeTruthy();
        expect(item.strength).toBeTruthy();
        expect(item.strengthReason).toBeTruthy();
      });
    });

    it('should handle malformed JSON gracefully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{ message: { content: 'not valid json' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      });

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty evidenceItems array from LLM', async () => {
      mockOpenAIJsonResponse({ evidenceItems: [] });

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      expect(result.length).toBeGreaterThan(0);
    });

    it('should normalize invalid type values to DOCUMENTARY', async () => {
      mockOpenAIJsonResponse({
        evidenceItems: [
          {
            description: '某证据',
            type: 'INVALID_TYPE',
            strength: 'STRONG',
            strengthReason: '理由',
          },
        ],
      });

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      expect(result[0]!.type).toBe('DOCUMENTARY');
    });

    it('should normalize invalid strength values to MEDIUM', async () => {
      mockOpenAIJsonResponse({
        evidenceItems: [
          {
            description: '某证据',
            type: 'DOCUMENTARY',
            strength: 'INVALID',
            strengthReason: '理由',
          },
        ],
      });

      const organizer = new EvidenceOrganizer();
      const result = await organizer.generateChecklist(buildSampleIssues());

      expect(result[0]!.strength).toBe('MEDIUM');
    });
  });

  // ─── assessStrength() ─────────────────────────────────────

  describe('assessStrength()', () => {
    it('should return an assessment with overallStrength, items, and summary', async () => {
      mockOpenAIJsonResponse(buildFullAssessmentResponse());

      const organizer = new EvidenceOrganizer();
      const result = await organizer.assessStrength(buildSampleEvidenceItems());

      const validStrengths = ['STRONG', 'MEDIUM', 'WEAK'];
      expect(validStrengths).toContain(result.overallStrength);
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.summary).toBeTruthy();
    });

    it('should ensure all items in assessment have valid fields', async () => {
      mockOpenAIJsonResponse(buildFullAssessmentResponse());

      const organizer = new EvidenceOrganizer();
      const result = await organizer.assessStrength(buildSampleEvidenceItems());

      const validTypes = ['DOCUMENTARY', 'PHYSICAL', 'TESTIMONY', 'ELECTRONIC', 'EXPERT_OPINION'];
      const validStrengths = ['STRONG', 'MEDIUM', 'WEAK'];

      result.items.forEach(item => {
        expect(item.description).toBeTruthy();
        expect(validTypes).toContain(item.type);
        expect(validStrengths).toContain(item.strength);
        expect(item.strengthReason).toBeTruthy();
      });
    });

    it('should enforce legalityRisk/alternativeCollection pairing in assessment items', async () => {
      mockOpenAIJsonResponse(buildFullAssessmentResponse());

      const organizer = new EvidenceOrganizer();
      const result = await organizer.assessStrength(buildSampleEvidenceItems());

      result.items.forEach(item => {
        if (item.legalityRisk && item.legalityRisk.trim()) {
          expect(item.alternativeCollection).toBeTruthy();
        }
      });
    });

    it('should handle degraded LLM response gracefully', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const organizer = new EvidenceOrganizer();
      const evidence = buildSampleEvidenceItems();
      const result = await organizer.assessStrength(evidence);

      expect(result.overallStrength).toBe('MEDIUM');
      expect(result.items.length).toBe(evidence.length);
      expect(result.summary).toBeTruthy();
    });

    it('should fall back to original evidence when LLM returns empty items', async () => {
      mockOpenAIJsonResponse({
        overallStrength: 'STRONG',
        items: [],
        summary: '评估总结',
      });

      const organizer = new EvidenceOrganizer();
      const evidence = buildSampleEvidenceItems();
      const result = await organizer.assessStrength(evidence);

      expect(result.items.length).toBe(evidence.length);
    });
  });

  // ─── identifyGaps() ──────────────────────────────────────

  describe('identifyGaps()', () => {
    it('should return gaps with issue, missingEvidence, importance, and suggestion', async () => {
      mockOpenAIJsonResponse(buildFullGapsResponse());

      const organizer = new EvidenceOrganizer();
      const result = await organizer.identifyGaps(buildSampleEvidenceItems(), buildSampleIssues());

      expect(result.length).toBeGreaterThan(0);
      const validImportances = ['CRITICAL', 'IMPORTANT', 'OPTIONAL'];

      result.forEach(gap => {
        expect(gap.issue).toBeTruthy();
        expect(gap.missingEvidence).toBeTruthy();
        expect(validImportances).toContain(gap.importance);
        expect(gap.suggestion).toBeTruthy();
      });
    });

    it('should include both issues and evidence in the LLM prompt', async () => {
      mockOpenAIJsonResponse(buildFullGapsResponse());

      const organizer = new EvidenceOrganizer();
      await organizer.identifyGaps(buildSampleEvidenceItems(), buildSampleIssues());

      const callArgs = mockOpenAICreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      const userMessage = callArgs.messages.find(m => m.role === 'user');
      expect(userMessage?.content).toContain('租金支付违约');
      expect(userMessage?.content).toContain('房屋租赁合同原件');
    });

    it('should handle degraded LLM response gracefully', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI down'));
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic down'));

      const organizer = new EvidenceOrganizer();
      const result = await organizer.identifyGaps(buildSampleEvidenceItems(), buildSampleIssues());

      expect(result.length).toBeGreaterThan(0);
      result.forEach(gap => {
        expect(gap.issue).toBeTruthy();
        expect(gap.missingEvidence).toBeTruthy();
        expect(gap.suggestion).toBeTruthy();
      });
    });

    it('should handle empty gaps array from LLM', async () => {
      mockOpenAIJsonResponse({ gaps: [] });

      const organizer = new EvidenceOrganizer();
      const result = await organizer.identifyGaps(buildSampleEvidenceItems(), buildSampleIssues());

      expect(result.length).toBeGreaterThan(0);
    });

    it('should normalize invalid importance values to IMPORTANT', async () => {
      mockOpenAIJsonResponse({
        gaps: [
          {
            issue: '某争议焦点',
            missingEvidence: '缺失证据',
            importance: 'INVALID',
            suggestion: '建议',
          },
        ],
      });

      const organizer = new EvidenceOrganizer();
      const result = await organizer.identifyGaps(buildSampleEvidenceItems(), buildSampleIssues());

      expect(result[0]!.importance).toBe('IMPORTANT');
    });
  });
});
