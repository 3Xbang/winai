import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Consultation Chat Interface', () => {
  describe('Translation keys completeness', () => {
    const locales = ['zh', 'en', 'th'];
    const translations = locales.reduce(
      (acc, locale) => {
        const filePath = path.resolve(__dirname, `../../messages/${locale}.json`);
        acc[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return acc;
      },
      {} as Record<string, Record<string, unknown>>
    );

    const requiredKeys = [
      'consultation.title',
      'consultation.placeholder',
      'consultation.send',
      'consultation.typing',
      'consultation.disclaimer',
      'consultation.loadingHistory',
      'consultation.noMoreHistory',
      'consultation.statusAnalyzing',
      'consultation.statusSearching',
      'consultation.statusGenerating',
      'consultation.irac.issue',
      'consultation.irac.rule',
      'consultation.irac.analysis',
      'consultation.irac.conclusion',
      'consultation.risk.highRisk',
      'consultation.risk.disclaimer',
      'consultation.risk.lawyerAdvice',
    ];

    function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
      return keyPath.split('.').reduce((current: unknown, key) => {
        if (current && typeof current === 'object') {
          return (current as Record<string, unknown>)[key];
        }
        return undefined;
      }, obj);
    }

    for (const key of requiredKeys) {
      it(`should have translation key "${key}" in all locales`, () => {
        for (const locale of locales) {
          const value = getNestedValue(translations[locale], key);
          expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
          expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
          expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('Component files exist', () => {
    const componentFiles = [
      'src/components/chat/MessageBubble.tsx',
      'src/components/chat/ChatInput.tsx',
      'src/components/chat/IRACDisplay.tsx',
      'src/components/chat/RiskWarning.tsx',
      'src/components/chat/TypingStatus.tsx',
      'src/hooks/useSSEStream.ts',
      'src/hooks/useScrollLoad.ts',
      'src/app/[locale]/consultation/page.tsx',
    ];

    for (const file of componentFiles) {
      it(`should have component file: ${file}`, () => {
        const filePath = path.resolve(__dirname, `../../${file}`);
        expect(fs.existsSync(filePath), `${file} should exist`).toBe(true);
      });
    }
  });

  describe('Component structure validation', () => {
    it('MessageBubble should export ChatMessage type and default component', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/MessageBubble.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'use client'");
      expect(content).toContain('export interface ChatMessage');
      expect(content).toContain('export default function MessageBubble');
      expect(content).toContain("role: 'user' | 'assistant'");
      expect(content).toContain('timestamp');
    });

    it('ChatInput should be a client component with send functionality', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/ChatInput.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'use client'");
      expect(content).toContain('export default function ChatInput');
      expect(content).toContain('onSend');
      expect(content).toContain('Enter');
      expect(content).toContain('shiftKey');
    });

    it('IRACDisplay should have collapsible sections for all four IRAC parts', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/IRACDisplay.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'use client'");
      expect(content).toContain('export default function IRACDisplay');
      expect(content).toContain('Collapse');
      expect(content).toContain("key: 'issue'");
      expect(content).toContain("key: 'rule'");
      expect(content).toContain("key: 'analysis'");
      expect(content).toContain("key: 'conclusion'");
    });

    it('RiskWarning should export alert components for different risk levels', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/RiskWarning.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'use client'");
      expect(content).toContain('export function RiskWarningAlert');
      expect(content).toContain('export function DisclaimerBanner');
      expect(content).toContain('export function LawyerAdviceNotice');
      expect(content).toContain('Alert');
    });

    it('TypingStatus should display processing phase indicators', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/TypingStatus.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'use client'");
      expect(content).toContain('export default function TypingStatus');
      expect(content).toContain('ProcessingPhase');
      expect(content).toContain('analyzing');
      expect(content).toContain('searching');
      expect(content).toContain('generating');
      expect(content).toContain('aria-live');
    });

    it('Consultation page should be a client component with chat layout', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/consultation/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'use client'");
      expect(content).toContain('export default function ConsultationPage');
      expect(content).toContain('MessageBubble');
      expect(content).toContain('ChatInput');
      expect(content).toContain('IRACDisplay');
      expect(content).toContain('RiskWarningAlert');
      expect(content).toContain('DisclaimerBanner');
    });

    it('Consultation page should implement streaming text effect', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/consultation/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('useStreamingText');
      expect(content).toContain('setInterval');
      expect(content).toContain('streamingMessageId');
    });

    it('Consultation page should have processing phase status indicator', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/consultation/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('TypingStatus');
      expect(content).toContain('processingPhase');
      expect(content).toContain("'analyzing'");
      expect(content).toContain("'searching'");
      expect(content).toContain("'generating'");
    });

    it('Consultation page should have historical message scroll loading', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/consultation/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('hasMoreHistory');
      expect(content).toContain('isLoadingHistory');
      expect(content).toContain('loadHistory');
      expect(content).toContain('history-loading');
      expect(content).toContain('scrollTop');
    });

    it('Consultation page should have loading state indicator', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/consultation/page.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('isLoading');
      expect(content).toContain('Spin');
      expect(content).toContain('loading-indicator');
    });
  });

  describe('SSE Stream hook structure', () => {
    it('useSSEStream should support start, stop, and state management', () => {
      const filePath = path.resolve(__dirname, '../../src/hooks/useSSEStream.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export function useSSEStream');
      expect(content).toContain('isStreaming');
      expect(content).toContain('AbortController');
      expect(content).toContain('text/event-stream');
      expect(content).toContain('onChunk');
      expect(content).toContain('onComplete');
      expect(content).toContain('onError');
      expect(content).toContain('[DONE]');
    });

    it('useSSEStream should handle SSE data parsing', () => {
      const filePath = path.resolve(__dirname, '../../src/hooks/useSSEStream.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("data: ");
      expect(content).toContain('TextDecoder');
      expect(content).toContain('getReader');
    });
  });

  describe('Scroll load hook structure', () => {
    it('useScrollLoad should detect scroll-to-top and manage loading state', () => {
      const filePath = path.resolve(__dirname, '../../src/hooks/useScrollLoad.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export function useScrollLoad');
      expect(content).toContain('isLoadingMore');
      expect(content).toContain('hasMore');
      expect(content).toContain('threshold');
      expect(content).toContain('scrollHeight');
      expect(content).toContain('scrollTop');
    });
  });
});
