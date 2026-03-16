/**
 * Tests for Legal Document Generator
 * Task 30.1 — 多类型文书生成引擎
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: vi.fn(() => mockGateway),
}));

const mockGateway = {
  chat: vi.fn(),
  parseJSON: vi.fn((resp: { content: string }) => JSON.parse(resp.content)),
};

import { generate, hasPlaceholders, SUPPORTED_TYPES } from '@/server/services/ai/document/generator';
import type { DocumentGenerationRequest } from '@/server/services/ai/document/generator';

const sampleRequest: DocumentGenerationRequest = {
  type: 'COMPLAINT',
  jurisdiction: 'china',
  parties: [
    { name: '张三', role: '原告', idNumber: '110101199001011234', address: '北京市朝阳区', contact: '13800138000' },
    { name: '李四', role: '被告', address: '上海市浦东新区' },
  ],
  facts: '被告未按合同约定交付货物，造成原告经济损失50万元。',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('SUPPORTED_TYPES', () => {
  it('supports 10+ document types', () => {
    expect(SUPPORTED_TYPES.length).toBeGreaterThanOrEqual(10);
    expect(SUPPORTED_TYPES).toContain('COMPLAINT');
    expect(SUPPORTED_TYPES).toContain('NDA');
    expect(SUPPORTED_TYPES).toContain('EMPLOYMENT_CONTRACT');
  });
});

describe('hasPlaceholders', () => {
  it('detects bracket placeholders', () => {
    expect(hasPlaceholders('请填写[姓名]')).toBe(true);
    expect(hasPlaceholders('请填写{待填写}')).toBe(true);
    expect(hasPlaceholders('请填写XXX')).toBe(true);
    expect(hasPlaceholders('请填写____')).toBe(true);
  });

  it('returns false for clean content', () => {
    expect(hasPlaceholders('张三与李四合同纠纷案')).toBe(false);
  });
});

describe('generate', () => {
  it('generates document with party info included', async () => {
    const docContent = '起诉状\n\n原告：张三\n被告：李四\n\n案件事实：被告未按合同约定交付货物...';
    mockGateway.chat.mockResolvedValue({ content: docContent });

    const result = await generate(sampleRequest);
    expect(result).toBe(docContent);
    expect(mockGateway.chat).toHaveBeenCalledTimes(1);

    // Verify prompt includes party info
    const callArgs = mockGateway.chat.mock.calls[0];
    const userMsg = callArgs[0].find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('张三');
    expect(userMsg.content).toContain('李四');
    expect(userMsg.content).toContain('50万元');
  });

  it('includes jurisdiction in system prompt', async () => {
    mockGateway.chat.mockResolvedValue({ content: '文书内容' });

    await generate({ ...sampleRequest, jurisdiction: 'thailand' });
    const callArgs = mockGateway.chat.mock.calls[0];
    const sysMsg = callArgs[0].find((m: { role: string }) => m.role === 'system');
    expect(sysMsg.content).toContain('泰国');
  });

  it('includes additional requirements when provided', async () => {
    mockGateway.chat.mockResolvedValue({ content: '文书内容' });

    await generate({ ...sampleRequest, additionalRequirements: '请使用简体中文' });
    const callArgs = mockGateway.chat.mock.calls[0];
    const userMsg = callArgs[0].find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('请使用简体中文');
  });

  it('returns empty string on LLM failure', async () => {
    mockGateway.chat.mockRejectedValue(new Error('timeout'));
    const result = await generate(sampleRequest);
    expect(result).toBe('');
  });

  it('formats party info with optional fields', async () => {
    mockGateway.chat.mockResolvedValue({ content: '文书' });

    await generate(sampleRequest);
    const callArgs = mockGateway.chat.mock.calls[0];
    const userMsg = callArgs[0].find((m: { role: string }) => m.role === 'user');
    expect(userMsg.content).toContain('身份证号: 110101199001011234');
    expect(userMsg.content).toContain('联系方式: 13800138000');
  });
});
