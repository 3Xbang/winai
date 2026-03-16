/**
 * Tests for Voice Input & Query Router
 * Task 31.3 — 语音输入与 OCR 图片输入
 */

import { describe, it, expect } from 'vitest';
import { processVoiceInput } from '@/server/services/ai/qa/voice-input';
import { routeQuery } from '@/server/services/ai/qa/router';

describe('processVoiceInput', () => {
  it('processes Chinese text', () => {
    const result = processVoiceInput('我想咨询合同纠纷');
    expect(result.text).toBe('我想咨询合同纠纷');
    expect(result.language).toBe('zh');
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('processes Thai text', () => {
    const result = processVoiceInput('ฉันต้องการปรึกษา');
    expect(result.language).toBe('th');
  });

  it('processes English text', () => {
    const result = processVoiceInput('I need legal advice');
    expect(result.language).toBe('en');
  });

  it('uses provided language override', () => {
    const result = processVoiceInput('test', 'zh');
    expect(result.language).toBe('zh');
  });

  it('returns zero confidence for empty input', () => {
    const result = processVoiceInput('  ');
    expect(result.confidence).toBe(0);
    expect(result.text).toBe('');
  });
});

describe('routeQuery', () => {
  it('routes contract queries to CONTRACT_REVIEW', () => {
    const result = routeQuery('请帮我审查这份合同');
    expect(result.route).toBe('CONTRACT_REVIEW');
    expect(result.suggestedMode).toBe('deep');
  });

  it('routes case queries to CASE_ANALYSIS', () => {
    const result = routeQuery('这个案件的胜诉概率如何？');
    expect(result.route).toBe('CASE_ANALYSIS');
  });

  it('routes document generation queries', () => {
    const result = routeQuery('帮我起草一份律师函');
    expect(result.route).toBe('DOCUMENT_GENERATION');
  });

  it('routes simple questions to QUICK_QA', () => {
    const result = routeQuery('什么是不可抗力？');
    expect(result.route).toBe('QUICK_QA');
    expect(result.suggestedMode).toBe('quick');
  });

  it('defaults long queries to DEEP_ANALYSIS', () => {
    const longQuery = '我在泰国经营一家公司，最近遇到了一些劳动纠纷的问题，员工要求加班费但我们的劳动关系中没有明确约定，请问应该按照什么标准来处理这种情况？';
    const result = routeQuery(longQuery);
    expect(result.route).toBe('DEEP_ANALYSIS');
    expect(result.suggestedMode).toBe('deep');
  });

  it('defaults short unknown queries to GENERAL', () => {
    const result = routeQuery('hello');
    expect(result.route).toBe('GENERAL');
  });
});
