/**
 * Unit tests for AI Paralegal — Timeline Generator & OCR Analyzer
 * Requirements: 22.3, 22.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TIMELINE_SYSTEM_PROMPT,
  generateTimeline,
  type TimelineNode,
} from '@/server/services/ai/paralegal/timeline-generator';
import {
  OCR_ANALYSIS_PROMPT,
  analyzeOCRDocument,
  analyzeText,
  type OCRAnalysisResult,
} from '@/server/services/ai/paralegal/ocr-analyzer';

// ─── Mock LLM Gateway ───────────────────────────────────────

const mockChat = vi.fn();
const mockParseJSON = vi.fn();

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: () => ({
    chat: mockChat,
    parseJSON: mockParseJSON,
  }),
}));

// ─── Mock AWS Textract ──────────────────────────────────────

const mockTextractSend = vi.fn();

vi.mock('@aws-sdk/client-textract', () => {
  return {
    TextractClient: class MockTextractClient {
      send = mockTextractSend;
    },
    DetectDocumentTextCommand: class MockDetectDocumentTextCommand {
      constructor(public input: unknown) {}
    },
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Timeline Generator Tests ───────────────────────────────

describe('Timeline Generator', () => {
  it('generates sorted timeline from case description', async () => {
    const timelineNodes: TimelineNode[] = [
      {
        date: '2024-03-15',
        description: '双方签订合同',
        legalSignificance: '合同关系成立',
        category: 'agreement',
      },
      {
        date: '2024-01-10',
        description: '双方开始商务谈判',
        legalSignificance: '确定合作意向',
        category: 'event',
      },
      {
        date: '2024-06-01',
        description: '被告未按期付款',
        legalSignificance: '构成违约',
        category: 'breach',
      },
    ];

    mockChat.mockResolvedValue({ content: JSON.stringify(timelineNodes) });
    mockParseJSON.mockReturnValue(timelineNodes);

    const result = await generateTimeline('案件描述：双方于2024年1月开始谈判，3月签订合同，6月被告违约');

    expect(result).toHaveLength(3);
    // Verify sorted by date ascending
    expect(result[0]!.date).toBe('2024-01-10');
    expect(result[1]!.date).toBe('2024-03-15');
    expect(result[2]!.date).toBe('2024-06-01');
    // Verify structure
    expect(result[0]!.description).toBeTruthy();
    expect(result[0]!.legalSignificance).toBeTruthy();
    expect(result[0]!.category).toBe('event');
  });

  it('handles empty LLM response gracefully', async () => {
    mockChat.mockResolvedValue({ content: '[]' });
    mockParseJSON.mockReturnValue([]);

    const result = await generateTimeline('一些案件描述');

    expect(result).toEqual([]);
  });

  it('handles LLM parse failure gracefully', async () => {
    mockChat.mockResolvedValue({ content: 'invalid json' });
    mockParseJSON.mockImplementation(() => {
      throw new Error('Failed to parse');
    });

    const result = await generateTimeline('一些案件描述');

    expect(result).toEqual([]);
  });

  it('handles wrapped object response (timeline key)', async () => {
    const nodes: TimelineNode[] = [
      {
        date: '2024-05-01',
        description: '提起诉讼',
        legalSignificance: '诉讼程序启动',
        category: 'filing',
      },
    ];

    mockChat.mockResolvedValue({ content: JSON.stringify({ timeline: nodes }) });
    mockParseJSON.mockReturnValue({ timeline: nodes });

    const result = await generateTimeline('案件描述');

    expect(result).toHaveLength(1);
    expect(result[0]!.date).toBe('2024-05-01');
  });

  it('system prompt contains required instructions', () => {
    expect(TIMELINE_SYSTEM_PROMPT).toContain('时间');
    expect(TIMELINE_SYSTEM_PROMPT).toContain('JSON');
    expect(TIMELINE_SYSTEM_PROMPT).toContain('date');
    expect(TIMELINE_SYSTEM_PROMPT).toContain('description');
    expect(TIMELINE_SYSTEM_PROMPT).toContain('legalSignificance');
    expect(TIMELINE_SYSTEM_PROMPT).toContain('category');
    expect(TIMELINE_SYSTEM_PROMPT).toContain('升序');
  });
});

// ─── OCR Analyzer Tests ─────────────────────────────────────

describe('OCR Analyzer', () => {
  it('extracts text via Textract then analyzes with LLM', async () => {
    // Mock Textract response
    mockTextractSend.mockResolvedValue({
      Blocks: [
        { BlockType: 'LINE', Text: '合同编号：CT-2024-001' },
        { BlockType: 'LINE', Text: '甲方：北京某某公司' },
        { BlockType: 'LINE', Text: '乙方：泰国某某公司' },
        { BlockType: 'LINE', Text: '合同金额：500万元人民币' },
        { BlockType: 'WORD', Text: '合同' }, // Should be filtered out (not LINE)
      ],
    });

    const nlpResult = {
      keyFacts: ['合同编号CT-2024-001', '合同金额500万元'],
      parties: ['北京某某公司', '泰国某某公司'],
      amounts: ['500万元人民币'],
      legalReferences: [],
      documentType: '合同',
      confidence: 0.85,
    };

    mockChat.mockResolvedValue({ content: JSON.stringify(nlpResult) });
    mockParseJSON.mockReturnValue(nlpResult);

    const result = await analyzeOCRDocument('documents/contract.pdf');

    expect(result.extractedText).toContain('合同编号：CT-2024-001');
    expect(result.extractedText).toContain('甲方：北京某某公司');
    expect(result.keyFacts).toHaveLength(2);
    expect(result.parties).toContain('北京某某公司');
    expect(result.parties).toContain('泰国某某公司');
    expect(result.amounts).toContain('500万元人民币');
    expect(result.documentType).toBe('合同');
    expect(result.confidence).toBe(0.85);
    expect(mockTextractSend).toHaveBeenCalledTimes(1);
    expect(mockChat).toHaveBeenCalledTimes(1);
  });

  it('handles Textract failure gracefully (returns empty result)', async () => {
    mockTextractSend.mockRejectedValue(new Error('Textract service unavailable'));

    const result = await analyzeOCRDocument('documents/broken.pdf');

    expect(result.extractedText).toBe('');
    expect(result.keyFacts).toEqual([]);
    expect(result.parties).toEqual([]);
    expect(result.amounts).toEqual([]);
    expect(result.legalReferences).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(mockChat).not.toHaveBeenCalled(); // LLM should not be called
  });

  it('analyzeText extracts key facts from text', async () => {
    const nlpResult = {
      keyFacts: ['被告于2024年6月1日未按期支付货款', '合同约定付款期限为30天'],
      parties: ['原告公司', '被告公司'],
      amounts: ['100万元'],
      legalReferences: ['《民法典》第577条'],
      documentType: '起诉状',
      confidence: 0.9,
    };

    mockChat.mockResolvedValue({ content: JSON.stringify(nlpResult) });
    mockParseJSON.mockReturnValue(nlpResult);

    const result = await analyzeText('被告于2024年6月1日未按期支付货款100万元，违反合同约定...');

    expect(result.keyFacts).toHaveLength(2);
    expect(result.keyFacts[0]).toContain('未按期支付');
    expect(result.parties).toContain('原告公司');
    expect(result.amounts).toContain('100万元');
    expect(result.legalReferences).toContain('《民法典》第577条');
    expect(result.documentType).toBe('起诉状');
    expect(result.confidence).toBe(0.9);
  });

  it('system prompt contains NLP analysis instructions', () => {
    expect(OCR_ANALYSIS_PROMPT).toContain('keyFacts');
    expect(OCR_ANALYSIS_PROMPT).toContain('parties');
    expect(OCR_ANALYSIS_PROMPT).toContain('amounts');
    expect(OCR_ANALYSIS_PROMPT).toContain('legalReferences');
    expect(OCR_ANALYSIS_PROMPT).toContain('documentType');
    expect(OCR_ANALYSIS_PROMPT).toContain('confidence');
    expect(OCR_ANALYSIS_PROMPT).toContain('NLP');
    expect(OCR_ANALYSIS_PROMPT).toContain('JSON');
  });

  it('handles empty Textract blocks', async () => {
    mockTextractSend.mockResolvedValue({ Blocks: [] });

    const result = await analyzeOCRDocument('documents/empty.pdf');

    expect(result.extractedText).toBe('');
    expect(result.confidence).toBe(0);
    expect(mockChat).not.toHaveBeenCalled();
  });
});
