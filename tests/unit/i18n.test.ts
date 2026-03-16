import { describe, it, expect } from 'vitest';
import { routing, locales, defaultLocale, type Locale } from '@/i18n/routing';
import zhMessages from '../../messages/zh.json';
import thMessages from '../../messages/th.json';
import enMessages from '../../messages/en.json';

describe('i18n routing configuration', () => {
  it('should define zh, th, en as supported locales', () => {
    expect(locales).toEqual(['zh', 'th', 'en']);
  });

  it('should set zh as the default locale', () => {
    expect(defaultLocale).toBe('zh');
  });

  it('should use always locale prefix mode', () => {
    expect(routing.localePrefix).toBe('always');
  });
});

describe('translation files completeness', () => {
  function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        return getKeys(value as Record<string, unknown>, fullKey);
      }
      return [fullKey];
    });
  }

  const zhKeys = getKeys(zhMessages);
  const thKeys = getKeys(thMessages);
  const enKeys = getKeys(enMessages);

  it('should have the same translation keys across all locales', () => {
    expect(zhKeys.sort()).toEqual(thKeys.sort());
    expect(zhKeys.sort()).toEqual(enKeys.sort());
  });

  it('should include languageSwitcher keys in all locales', () => {
    const requiredKeys = ['languageSwitcher.label', 'languageSwitcher.zh', 'languageSwitcher.th', 'languageSwitcher.en'];
    for (const key of requiredKeys) {
      expect(zhKeys).toContain(key);
      expect(thKeys).toContain(key);
      expect(enKeys).toContain(key);
    }
  });

  it('should include nav keys in all locales', () => {
    const navKeys = zhKeys.filter((k) => k.startsWith('nav.'));
    expect(navKeys.length).toBeGreaterThan(0);
    for (const key of navKeys) {
      expect(thKeys).toContain(key);
      expect(enKeys).toContain(key);
    }
  });

  it('should include auth keys in all locales', () => {
    const authKeys = zhKeys.filter((k) => k.startsWith('auth.'));
    expect(authKeys.length).toBeGreaterThan(0);
    for (const key of authKeys) {
      expect(thKeys).toContain(key);
      expect(enKeys).toContain(key);
    }
  });

  it('should have non-empty string values for all translation keys', () => {
    const allMessages = { zh: zhMessages, th: thMessages, en: enMessages };
    for (const [locale, messages] of Object.entries(allMessages)) {
      const keys = getKeys(messages);
      for (const key of keys) {
        const value = key.split('.').reduce((obj: unknown, k) => {
          return (obj as Record<string, unknown>)?.[k];
        }, messages);
        expect(value, `${locale}.${key} should be a non-empty string`).toBeTruthy();
        expect(typeof value, `${locale}.${key} should be a string`).toBe('string');
      }
    }
  });
});
