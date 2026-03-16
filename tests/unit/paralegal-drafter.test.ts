/**
 * Unit tests for AI Paralegal — Document Drafter & Template Engine
 * Requirements: 22.1, 22.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DOCUMENT_PROMPTS,
  draftDocument,
  type DocumentType,
  type DocumentDraftRequest,
} from '@/server/services/ai/paralegal/document-drafter';
import {
  TEMPLATES,
  getTemplates,
  getTemplate,
  replaceVariables,
  extractVariables,
  fillTemplate,
  type DocumentTemplate,
} from '@/server/services/ai/paralegal/template-engine';

// ─── Mock LLM Gateway ───────────────────────────────────────

const mockChat = vi.fn();
const mockParseJSON = vi.fn();

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: () => ({
    chat: mockChat,
    parseJSON: mockParseJSON,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── DOCUMENT_PROMPTS Tests ─────────────────────────────────

describe('DOCUMENT_PROMPTS', () => {
  const allDocumentTypes: DocumentType[] = [
    'complaint',
    'defense',
    'appeal',
    'lawyer-letter',
    'legal-opinion',
    'due-diligence',
  ];

  it('has a system prompt defined for each document type', () => {
    for (const docType of allDocumentTypes) {
      expect(DOCUMENT_PROMPTS[docType]).toBeDefined();
      expect(typeof DOCUMENT_PROMPTS[docType]).toBe('string');
      expect(DOCUMENT_PROMPTS[docType].length).toBeGreaterThan(0);
    }
  });

  it('complaint prompt contains format specifications', () => {
    expect(DOCUMENT_PROMPTS.complaint).toContain('起诉状');
  });

  it('defense prompt contains format specifications', () => {
    expect(DOCUMENT_PROMPTS.defense).toContain('答辩状');
  });

  it('appeal prompt contains format specifications', () => {
    expect(DOCUMENT_PROMPTS.appeal).toContain('上诉状');
  });

  it('lawyer-letter prompt contains format specifications', () => {
    expect(DOCUMENT_PROMPTS['lawyer-letter']).toContain('律师函');
  });

  it('legal-opinion prompt contains format specifications', () => {
    expect(DOCUMENT_PROMPTS['legal-opinion']).toContain('法律意见书');
  });

  it('due-diligence prompt contains format specifications', () => {
    expect(DOCUMENT_PROMPTS['due-diligence']).toContain('尽职调查');
  });
});

// ─── Template Retrieval Tests ───────────────────────────────

describe('getTemplates', () => {
  it('returns all templates', () => {
    const templates = getTemplates();
    expect(templates).toBeInstanceOf(Array);
    expect(templates.length).toBe(TEMPLATES.length);
    expect(templates.length).toBeGreaterThan(0);
  });
});

describe('getTemplate', () => {
  it('returns correct template by ID', () => {
    const template = getTemplate('complaint-china');
    expect(template).toBeDefined();
    expect(template!.id).toBe('complaint-china');
    expect(template!.documentType).toBe('complaint');
    expect(template!.jurisdiction).toBe('china');
  });

  it('returns undefined for non-existent template ID', () => {
    const template = getTemplate('non-existent-id');
    expect(template).toBeUndefined();
  });
});

// ─── Template Coverage Tests ────────────────────────────────

describe('TEMPLATES coverage', () => {
  const allDocumentTypes: DocumentType[] = [
    'complaint',
    'defense',
    'appeal',
    'lawyer-letter',
    'legal-opinion',
    'due-diligence',
  ];

  it('covers all document types', () => {
    const coveredTypes = new Set(TEMPLATES.map((t) => t.documentType));
    for (const docType of allDocumentTypes) {
      expect(coveredTypes.has(docType)).toBe(true);
    }
  });

  it('covers both jurisdictions', () => {
    const coveredJurisdictions = new Set(TEMPLATES.map((t) => t.jurisdiction));
    expect(coveredJurisdictions.has('china')).toBe(true);
    expect(coveredJurisdictions.has('thailand')).toBe(true);
  });

  it('each template has complete variable definitions', () => {
    for (const template of TEMPLATES) {
      expect(template.variables.length).toBeGreaterThan(0);
      for (const variable of template.variables) {
        expect(variable.name).toBeTruthy();
        expect(variable.description).toBeTruthy();
        expect(typeof variable.required).toBe('boolean');
      }
    }
  });

  it('each template content contains placeholders matching its variables', () => {
    for (const template of TEMPLATES) {
      // At least one variable should appear as a placeholder in the content
      const hasPlaceholder = template.variables.some((v) =>
        template.content.includes(`{{${v.name}}}`),
      );
      expect(hasPlaceholder).toBe(true);
    }
  });
});

// ─── replaceVariables Tests ─────────────────────────────────

describe('replaceVariables', () => {
  it('replaces all placeholders with provided values', () => {
    const content = '原告：{{name}}，地址：{{address}}';
    const result = replaceVariables(content, { name: '张三', address: '北京市朝阳区' });
    expect(result).toBe('原告：张三，地址：北京市朝阳区');
  });

  it('replaces multiple occurrences of the same variable', () => {
    const content = '{{name}} vs {{name}}';
    const result = replaceVariables(content, { name: '张三' });
    expect(result).toBe('张三 vs 张三');
  });

  it('leaves unreplaced vars if not provided', () => {
    const content = '原告：{{name}}，被告：{{defendant}}';
    const result = replaceVariables(content, { name: '张三' });
    expect(result).toBe('原告：张三，被告：{{defendant}}');
    expect(result).toContain('{{defendant}}');
  });

  it('handles empty variables object', () => {
    const content = '{{name}} at {{address}}';
    const result = replaceVariables(content, {});
    expect(result).toBe('{{name}} at {{address}}');
  });

  it('handles content with no placeholders', () => {
    const content = 'No placeholders here';
    const result = replaceVariables(content, { name: '张三' });
    expect(result).toBe('No placeholders here');
  });
});

// ─── draftDocument Tests (mocked LLM) ──────────────────────

describe('draftDocument', () => {
  it('calls gateway with correct system prompt for complaint', async () => {
    mockChat.mockResolvedValue({ content: '起诉状内容...' });

    const request: DocumentDraftRequest = {
      documentType: 'complaint',
      jurisdiction: 'china',
      caseDescription: '合同纠纷案件',
      parties: { plaintiff: '张三', defendant: '李四' },
      language: 'zh',
    };

    const result = await draftDocument(request);

    expect(result).toBe('起诉状内容...');
    expect(mockChat).toHaveBeenCalledTimes(1);

    const [messages, options] = mockChat.mock.calls[0]!;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe(DOCUMENT_PROMPTS.complaint);
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('合同纠纷案件');
    expect(messages[1].content).toContain('中国');
    expect(options.temperature).toBe(0.3);
  });

  it('includes party information in user message', async () => {
    mockChat.mockResolvedValue({ content: 'drafted content' });

    await draftDocument({
      documentType: 'lawyer-letter',
      jurisdiction: 'thailand',
      caseDescription: 'breach of contract',
      parties: { client: 'Company A' },
      language: 'en',
    });

    const [messages] = mockChat.mock.calls[0]!;
    expect(messages[1].content).toContain('Company A');
    expect(messages[1].content).toContain('Thailand');
  });

  it('includes additional instructions when provided', async () => {
    mockChat.mockResolvedValue({ content: 'drafted content' });

    await draftDocument({
      documentType: 'legal-opinion',
      jurisdiction: 'china',
      caseDescription: '投资咨询',
      parties: { client: '某公司' },
      language: 'zh',
      additionalInstructions: '请重点分析外资准入限制',
    });

    const [messages] = mockChat.mock.calls[0]!;
    expect(messages[1].content).toContain('请重点分析外资准入限制');
  });
});

// ─── fillTemplate Tests (mocked LLM) ───────────────────────

describe('fillTemplate', () => {
  it('extracts variables and fills template', async () => {
    const extractedVars: Record<string, string> = {
      plaintiffName: '张三',
      plaintiffIdType: '身份证',
      plaintiffId: '110101199001011234',
      plaintiffAddress: '北京市朝阳区',
      defendantName: '李四',
      defendantIdType: '身份证',
      defendantId: '110101199002021234',
      defendantAddress: '上海市浦东新区',
      claims: '要求被告赔偿损失100万元',
      factsAndReasons: '双方签订合同后被告违约',
      courtName: '北京市朝阳区人民法院',
    };

    mockChat.mockResolvedValue({ content: JSON.stringify(extractedVars) });
    mockParseJSON.mockReturnValue(extractedVars);

    const result = await fillTemplate(
      'complaint-china',
      '张三（身份证110101199001011234，住北京市朝阳区）起诉李四（身份证110101199002021234，住上海市浦东新区），要求赔偿100万元，因合同违约，向北京市朝阳区人民法院提起诉讼',
    );

    expect(result).toContain('张三');
    expect(result).toContain('李四');
    expect(result).toContain('北京市朝阳区人民法院');
    expect(result).not.toContain('{{plaintiffName}}');
    expect(result).not.toContain('{{defendantName}}');
    expect(result).not.toContain('{{courtName}}');
  });

  it('throws error for non-existent template', async () => {
    await expect(fillTemplate('non-existent', 'some input')).rejects.toThrow('Template not found');
  });

  it('throws error when required variables are missing', async () => {
    // Return only partial variables — missing required ones
    const partialVars: Record<string, string> = {
      plaintiffName: '张三',
    };

    mockChat.mockResolvedValue({ content: JSON.stringify(partialVars) });
    mockParseJSON.mockReturnValue(partialVars);

    await expect(fillTemplate('complaint-china', '张三要起诉')).rejects.toThrow(
      'Missing required variables',
    );
  });
});

// ─── extractVariables Tests (mocked LLM) ────────────────────

describe('extractVariables', () => {
  it('calls LLM with correct prompt structure', async () => {
    const template = getTemplate('complaint-china')!;
    const extracted = { plaintiffName: '张三' };

    mockChat.mockResolvedValue({ content: JSON.stringify(extracted) });
    mockParseJSON.mockReturnValue(extracted);

    const result = await extractVariables(template, '张三要起诉');

    expect(mockChat).toHaveBeenCalledTimes(1);
    const [messages, options] = mockChat.mock.calls[0]!;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('plaintiffName');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('张三要起诉');
    expect(options.temperature).toBe(0.1);
    expect(options.responseFormat).toBe('json_object');
    expect(result).toEqual(extracted);
  });
});
