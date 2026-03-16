import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Consultation History Page', () => {
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
      'history.title',
      'history.allSessions',
      'history.bookmarks',
      'history.searchPlaceholder',
      'history.startDate',
      'history.endDate',
      'history.allDomains',
      'history.noResults',
      'history.messageCount',
      'history.addBookmark',
      'history.removeBookmark',
      'history.viewDetails',
      'history.continueConsultation',
      'history.exportPDF',
      'history.domains.CORPORATE',
      'history.domains.CONTRACT',
      'history.domains.CRIMINAL',
      'history.domains.CIVIL',
      'history.domains.VISA',
      'history.domains.TAX',
      'history.domains.IP',
      'history.domains.LABOR',
      'history.domains.TRADE',
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

  describe('Component file exists', () => {
    it('should have history page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/history/page.tsx');
      expect(fs.existsSync(filePath), 'history/page.tsx should exist').toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/history/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default HistoryPage function', () => {
      expect(content).toContain('export default function HistoryPage');
    });

    it('should use next-intl translations with history namespace', () => {
      expect(content).toContain("useTranslations('history')");
    });

    it('should have search input', () => {
      expect(content).toContain('SearchOutlined');
      expect(content).toContain('searchKeyword');
      expect(content).toContain('search-input');
    });

    it('should have date range picker for date filtering', () => {
      expect(content).toContain('RangePicker');
      expect(content).toContain('dateRange');
      expect(content).toContain('date-range-picker');
    });

    it('should have legal domain filter select', () => {
      expect(content).toContain('Select');
      expect(content).toContain('selectedDomain');
      expect(content).toContain('domain-filter');
      expect(content).toContain('CORPORATE');
      expect(content).toContain('CONTRACT');
      expect(content).toContain('CRIMINAL');
      expect(content).toContain('CIVIL');
      expect(content).toContain('VISA');
      expect(content).toContain('TAX');
      expect(content).toContain("'IP'");
      expect(content).toContain('LABOR');
      expect(content).toContain('TRADE');
    });

    it('should have bookmarks tab for quick access', () => {
      expect(content).toContain('bookmarks');
      expect(content).toContain('StarFilled');
      expect(content).toContain('Tabs');
      expect(content).toContain('history-tabs');
    });

    it('should have session cards with title, date, domain tag, and summary', () => {
      expect(content).toContain('session.title');
      expect(content).toContain('session.date');
      expect(content).toContain('session.legalDomain');
      expect(content).toContain('Tag');
      expect(content).toContain('session.summary');
    });

    it('should have bookmark toggle button on each card', () => {
      expect(content).toContain('handleToggleBookmark');
      expect(content).toContain('bookmark-btn-');
    });

    it('should have view details button linking to session detail', () => {
      expect(content).toContain('EyeOutlined');
      expect(content).toContain('view-btn-');
      expect(content).toContain('/history/${session.id}');
    });

    it('should have continue consultation button', () => {
      expect(content).toContain('MessageOutlined');
      expect(content).toContain('continue-btn-');
      expect(content).toContain('continueConsultation');
      expect(content).toContain('/consultation?resume=');
    });

    it('should have PDF export button', () => {
      expect(content).toContain('FilePdfOutlined');
      expect(content).toContain('handleExportPDF');
      expect(content).toContain('export-btn-');
    });

    it('should show empty state when no results', () => {
      expect(content).toContain('Empty');
      expect(content).toContain('empty-state');
    });
  });
});
