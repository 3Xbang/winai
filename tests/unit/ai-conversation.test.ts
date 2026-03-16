/**
 * Unit tests for AI Conversation — Intent Classifier & Language Detector
 * Requirements: 21.2, 21.7, 28.6
 */

import { describe, it, expect } from 'vitest';
import {
  classifyIntent,
  LegalDomain,
  ROUTING_MAP,
} from '@/server/services/ai/conversation/intent-classifier';
import { detectLanguage } from '@/server/services/ai/conversation/language-detector';

// ─── Intent Classification Tests ────────────────────────────

describe('classifyIntent', () => {
  describe('single domain classification', () => {
    it('classifies CORPORATE intent from Chinese keywords', () => {
      const result = classifyIntent('我想在泰国进行公司注册，需要了解股权结构设计');
      expect(result.primaryIntent).toBe(LegalDomain.CORPORATE);
      expect(result.routingTarget).toBe('case-analyzer');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('classifies CONTRACT intent from Chinese keywords', () => {
      const result = classifyIntent('请帮我审查这份合同，检查合同条款是否有违约风险');
      expect(result.primaryIntent).toBe(LegalDomain.CONTRACT);
      expect(result.routingTarget).toBe('contract');
    });

    it('classifies CRIMINAL intent from Chinese keywords', () => {
      const result = classifyIntent('我被指控诈骗罪，需要刑事辩护');
      expect(result.primaryIntent).toBe(LegalDomain.CRIMINAL);
      expect(result.routingTarget).toBe('case-analyzer');
    });

    it('classifies CIVIL intent from Chinese keywords', () => {
      const result = classifyIntent('我要提起民事诉讼，要求损害赔偿');
      expect(result.primaryIntent).toBe(LegalDomain.CIVIL);
      expect(result.routingTarget).toBe('case-analyzer');
    });

    it('classifies VISA intent from Chinese keywords', () => {
      const result = classifyIntent('我想申请泰国精英签，需要了解签证续签流程');
      expect(result.primaryIntent).toBe(LegalDomain.VISA);
      expect(result.routingTarget).toBe('visa');
    });

    it('classifies TAX intent from Chinese keywords', () => {
      const result = classifyIntent('关于避免双重征税协定和企业所得税的问题');
      expect(result.primaryIntent).toBe(LegalDomain.TAX);
      expect(result.routingTarget).toBe('case-analyzer');
    });

    it('classifies IP intent from Chinese keywords', () => {
      const result = classifyIntent('我的商标被侵权了，需要知识产权保护');
      expect(result.primaryIntent).toBe(LegalDomain.IP);
      expect(result.routingTarget).toBe('case-analyzer');
    });

    it('classifies LABOR intent from Chinese keywords', () => {
      const result = classifyIntent('公司拖欠工资，我想申请劳动仲裁');
      expect(result.primaryIntent).toBe(LegalDomain.LABOR);
      expect(result.routingTarget).toBe('case-analyzer');
    });

    it('classifies TRADE intent from Chinese keywords', () => {
      const result = classifyIntent('跨境贸易的进出口关税问题');
      expect(result.primaryIntent).toBe(LegalDomain.TRADE);
      expect(result.routingTarget).toBe('case-analyzer');
    });
  });

  describe('English keyword classification', () => {
    it('classifies CORPORATE from English keywords', () => {
      const result = classifyIntent('I need help with company registration and shareholder structure');
      expect(result.primaryIntent).toBe(LegalDomain.CORPORATE);
    });

    it('classifies CONTRACT from English keywords', () => {
      const result = classifyIntent('Please review this contract agreement for breach of contract risks');
      expect(result.primaryIntent).toBe(LegalDomain.CONTRACT);
    });

    it('classifies VISA from English keywords', () => {
      const result = classifyIntent('I want to apply for a work permit and retirement visa in Thailand');
      expect(result.primaryIntent).toBe(LegalDomain.VISA);
    });
  });

  describe('Thai keyword classification', () => {
    it('classifies CORPORATE from Thai keywords', () => {
      const result = classifyIntent('ต้องการจดทะเบียนบริษัทและตั้งโครงสร้างผู้ถือหุ้น');
      expect(result.primaryIntent).toBe(LegalDomain.CORPORATE);
    });

    it('classifies VISA from Thai keywords', () => {
      const result = classifyIntent('ต้องการต่อวีซ่าและขอใบอนุญาตทำงาน');
      expect(result.primaryIntent).toBe(LegalDomain.VISA);
    });
  });

  describe('multi-domain (secondaryIntents) detection', () => {
    it('detects secondary intents when input spans multiple domains', () => {
      const result = classifyIntent('公司注册后需要签订劳动合同，还要处理税务合规问题');
      expect(result.secondaryIntents.length).toBeGreaterThan(0);
      // Should detect at least CORPORATE + LABOR or TAX or CONTRACT
      const allIntents = [result.primaryIntent, ...result.secondaryIntents];
      expect(allIntents.length).toBeGreaterThanOrEqual(2);
    });

    it('includes all detected domains in secondaryIntents', () => {
      const result = classifyIntent('合同纠纷涉及知识产权侵权和商标问题');
      const allIntents = [result.primaryIntent, ...result.secondaryIntents];
      expect(allIntents).toContain(LegalDomain.CONTRACT);
      expect(allIntents).toContain(LegalDomain.IP);
    });

    it('primary intent has highest keyword match count', () => {
      // "合同" + "合同审查" + "合同条款" = 3 CONTRACT matches
      // "知识产权" = 1 IP match
      const result = classifyIntent('合同审查发现合同条款中有知识产权问题');
      expect(result.primaryIntent).toBe(LegalDomain.CONTRACT);
      expect(result.secondaryIntents).toContain(LegalDomain.IP);
    });
  });

  describe('routingTarget mapping', () => {
    it('maps all LegalDomain values to routing targets', () => {
      for (const domain of Object.values(LegalDomain)) {
        expect(ROUTING_MAP[domain]).toBeDefined();
        expect(typeof ROUTING_MAP[domain]).toBe('string');
        expect(ROUTING_MAP[domain].length).toBeGreaterThan(0);
      }
    });

    it('routes CONTRACT to contract module', () => {
      expect(ROUTING_MAP[LegalDomain.CONTRACT]).toBe('contract');
    });

    it('routes VISA to visa module', () => {
      expect(ROUTING_MAP[LegalDomain.VISA]).toBe('visa');
    });

    it('routes CORPORATE to case-analyzer module', () => {
      expect(ROUTING_MAP[LegalDomain.CORPORATE]).toBe('case-analyzer');
    });
  });

  describe('confidence scoring', () => {
    it('returns confidence between 0 and 1', () => {
      const result = classifyIntent('合同审查');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('returns low confidence for unrecognized input', () => {
      const result = classifyIntent('hello world');
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('returns higher confidence for input with many matching keywords', () => {
      const singleKeyword = classifyIntent('合同');
      const multiKeyword = classifyIntent('合同审查发现合同条款有违约风险，需要合同起草');
      expect(multiKeyword.confidence).toBeGreaterThanOrEqual(singleKeyword.confidence);
    });
  });

  describe('edge cases', () => {
    it('handles empty string input', () => {
      const result = classifyIntent('');
      expect(result.primaryIntent).toBeDefined();
      expect(result.routingTarget).toBeDefined();
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it('defaults to CIVIL with low confidence for no keyword matches', () => {
      const result = classifyIntent('这是一段没有法律关键词的普通文本');
      expect(result.primaryIntent).toBe(LegalDomain.CIVIL);
      expect(result.confidence).toBe(0.3);
      expect(result.secondaryIntents).toEqual([]);
    });
  });
});

// ─── Language Detection Tests ───────────────────────────────

describe('detectLanguage', () => {
  describe('Chinese detection', () => {
    it('detects Chinese text', () => {
      expect(detectLanguage('我想咨询关于公司注册的法律问题')).toBe('zh');
    });

    it('detects Chinese with some English words', () => {
      expect(detectLanguage('我想了解BOI投资促进政策的具体要求')).toBe('zh');
    });
  });

  describe('Thai detection', () => {
    it('detects Thai text', () => {
      expect(detectLanguage('ต้องการปรึกษาเรื่องกฎหมายการจดทะเบียนบริษัท')).toBe('th');
    });

    it('detects Thai with some English words', () => {
      expect(detectLanguage('ต้องการสมัคร work permit ในประเทศไทย')).toBe('th');
    });
  });

  describe('English detection', () => {
    it('detects English text', () => {
      expect(detectLanguage('I need legal advice about company registration in Thailand')).toBe('en');
    });

    it('detects English with legal terminology', () => {
      expect(detectLanguage('What are the requirements for a business visa application?')).toBe('en');
    });
  });

  describe('mixed language input', () => {
    it('returns dominant language for mixed Chinese-English', () => {
      // More Chinese characters than Latin
      const result = detectLanguage('请问在泰国注册company需要什么条件');
      expect(result).toBe('zh');
    });

    it('returns dominant language for mixed Thai-English', () => {
      // More Thai characters than Latin
      const result = detectLanguage('ต้องการทราบเกี่ยวกับ visa requirements');
      expect(result).toBe('th');
    });
  });

  describe('edge cases', () => {
    it('defaults to en for empty string', () => {
      expect(detectLanguage('')).toBe('en');
    });

    it('defaults to en for numbers and symbols only', () => {
      expect(detectLanguage('12345 !@#$%')).toBe('en');
    });
  });
});
