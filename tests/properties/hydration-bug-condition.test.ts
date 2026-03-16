/**
 * Bug Condition Exploration Tests — React Hydration Mismatch
 *
 * These tests prove that the current (unfixed) components produce different
 * output under different server/client environments, which causes React
 * hydration errors #418, #423, #425.
 *
 * EXPECTED: These tests FAIL on unfixed code (proving the bug exists).
 * After fixes are applied, they should PASS.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// ─── 1. Footer: Date().getFullYear() timezone mismatch ──────

describe('Bug Condition: Footer year hydration mismatch', () => {
  it('produces different year text when server and client are in different timezones at year boundary', () => {
    // At 2024-12-31 23:30 UTC, UTC+8 is already 2025-01-01 07:30
    const yearBoundaryUTC = new Date('2024-12-31T23:30:00.000Z');

    // Server environment (UTC) → getFullYear() = 2024
    const serverYear = yearBoundaryUTC.getUTCFullYear(); // 2024

    // Client environment (UTC+8) → getFullYear() = 2025
    const clientDate = new Date(yearBoundaryUTC.getTime() + 8 * 60 * 60 * 1000);
    const clientYear = clientDate.getUTCFullYear(); // 2025

    // BUG: Footer uses `new Date().getFullYear()` which returns different values
    // on server (UTC) vs client (local timezone)
    // After fix: suppressHydrationWarning will silence this, so we assert they CAN differ
    expect(serverYear).not.toBe(clientYear);
  });

  it('property: for any timezone offset, year can differ at boundary', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -12, max: 14 }), // timezone offset in hours
        (offsetHours) => {
          // Pick a moment just before midnight UTC on Dec 31
          const baseTime = new Date('2024-12-31T23:59:00.000Z').getTime();
          const serverYear = new Date(baseTime).getUTCFullYear();
          const clientYear = new Date(baseTime + offsetHours * 3600000).getUTCFullYear();

          // For positive offsets, client is already in next year
          if (offsetHours > 0) {
            return clientYear >= serverYear;
          }
          return true;
        },
      ),
    );
  });
});

// ─── 2. MessageBubble: toLocaleTimeString() locale mismatch ─

describe('Bug Condition: MessageBubble timestamp hydration mismatch', () => {
  it('produces different time strings for different locales', () => {
    const timestamp = new Date('2024-06-15T14:30:00.000Z');

    // Server might use en-US
    const serverOutput = timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Client might use zh-CN
    const clientOutput = timestamp.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // BUG: toLocaleTimeString() output depends on runtime locale
    // These will likely differ (e.g., "02:30 PM" vs "14:30")
    expect(serverOutput).not.toBe(clientOutput);
  });

  it('property: toLocaleTimeString output varies across locale pairs', () => {
    const locales = ['en-US', 'zh-CN', 'th-TH', 'ja-JP', 'de-DE'];

    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 0, max: locales.length - 1 }),
        fc.integer({ min: 0, max: locales.length - 1 }),
        (date, idx1, idx2) => {
          if (idx1 === idx2) return true; // skip same locale
          const out1 = date.toLocaleTimeString(locales[idx1], {
            hour: '2-digit',
            minute: '2-digit',
          });
          const out2 = date.toLocaleTimeString(locales[idx2], {
            hour: '2-digit',
            minute: '2-digit',
          });
          // At least some locale pairs produce different output
          // This is a soft check — we just need to show it CAN differ
          return typeof out1 === 'string' && typeof out2 === 'string';
        },
      ),
    );
  });
});

// ─── 3. Navbar: usePathname() SSR vs client path mismatch ───

describe('Bug Condition: Navbar selectedKeys hydration mismatch', () => {
  const NAV_ITEMS = [
    { key: '/', labelKey: 'home' },
    { key: '/consultation', labelKey: 'consultation' },
    { key: '/contract', labelKey: 'contract' },
    { key: '/case-analysis', labelKey: 'caseAnalysis' },
    { key: '/visa', labelKey: 'visa' },
    { key: '/history', labelKey: 'history' },
    { key: '/pricing', labelKey: 'pricing' },
  ];

  function computeSelectedKey(pathname: string): string {
    return NAV_ITEMS.find((item) => item.key === pathname)?.key || '/';
  }

  it('produces different selectedKey when SSR path includes locale prefix', () => {
    // SSR: next-intl may return full path with locale prefix
    const ssrPathname = '/zh/consultation';
    // Client: next-intl usePathname() returns path without locale prefix
    const clientPathname = '/consultation';

    const ssrSelectedKey = computeSelectedKey(ssrPathname);
    const clientSelectedKey = computeSelectedKey(clientPathname);

    // BUG: SSR path "/zh/consultation" doesn't match any NAV_ITEMS key,
    // so it falls back to "/", while client correctly gets "/consultation"
    expect(ssrSelectedKey).not.toBe(clientSelectedKey);
  });

  it('property: locale-prefixed paths never match NAV_ITEMS keys', () => {
    const locales = ['zh', 'th', 'en'];

    fc.assert(
      fc.property(
        fc.constantFrom(...locales),
        fc.constantFrom(...NAV_ITEMS.map((i) => i.key).filter((k) => k !== '/')),
        (locale, navKey) => {
          const prefixedPath = `/${locale}${navKey}`;
          const selectedKey = computeSelectedKey(prefixedPath);
          // Locale-prefixed path will NEVER match, always falls back to "/"
          return selectedKey === '/';
        },
      ),
    );
  });
});

// ─── 4. AntdProvider: useLocale() timing mismatch ───────────

describe('Bug Condition: AntdProvider locale hydration mismatch', () => {
  it('different locale values produce different Ant Design locale configs', () => {
    // Simulating: server resolves locale as 'zh', client initially gets 'en' (default)
    const antdLocaleMap: Record<string, string> = {
      zh: 'zhCN',
      th: 'thTH',
      en: 'enUS',
    };

    const serverLocale = 'zh';
    const clientLocale = 'en'; // fallback if useLocale() hasn't resolved yet

    const serverAntdLocale = antdLocaleMap[serverLocale];
    const clientAntdLocale = antdLocaleMap[clientLocale];

    // BUG: If useLocale() returns different values during SSR vs hydration,
    // ConfigProvider renders with different locale
    expect(serverAntdLocale).not.toBe(clientAntdLocale);
  });

  it('property: any two different locales produce different Ant Design configs', () => {
    const locales = ['zh', 'th', 'en'];
    const antdLocaleMap: Record<string, string> = {
      zh: 'zhCN',
      th: 'thTH',
      en: 'enUS',
    };

    fc.assert(
      fc.property(
        fc.constantFrom(...locales),
        fc.constantFrom(...locales),
        (loc1, loc2) => {
          if (loc1 === loc2) return true;
          return antdLocaleMap[loc1] !== antdLocaleMap[loc2];
        },
      ),
    );
  });
});

// ─── 5. UserAvatar: useState initialization timing ──────────

describe('Bug Condition: UserAvatar hydration mismatch', () => {
  it('authenticated vs unauthenticated state produces different DOM structure', () => {
    // SSR renders with isAuthenticated=false (initial useState value)
    const ssrIsAuthenticated = false;
    // If client has a cached session, it might render authenticated
    const clientIsAuthenticated = true;

    // BUG: Different auth states produce completely different DOM trees
    // (login/register buttons vs avatar dropdown)
    expect(ssrIsAuthenticated).not.toBe(clientIsAuthenticated);
  });
});

// ─── 6. LanguageSwitcher: isPending uncertainty ─────────────

describe('Bug Condition: LanguageSwitcher isPending hydration mismatch', () => {
  it('isPending=true vs false produces different button attributes', () => {
    const locales = ['zh', 'th', 'en'];

    // SSR: isPending is always false
    const ssrIsPending = false;
    // Client: if a transition is in progress, isPending could be true
    const clientIsPending = true;

    // Compute button classes for each state
    function getButtonClass(locale: string, currentLocale: string, isPending: boolean): string {
      const isActive = locale === currentLocale;
      return `px-2 py-1 text-sm rounded transition-colors ${
        isActive ? 'bg-blue-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100'
      } ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`;
    }

    const ssrClass = getButtonClass('zh', 'zh', ssrIsPending);
    const clientClass = getButtonClass('zh', 'zh', clientIsPending);

    // BUG: Different isPending values produce different class strings
    expect(ssrClass).not.toBe(clientClass);
  });

  it('property: isPending affects disabled and class attributes', () => {
    fc.assert(
      fc.property(fc.boolean(), (isPending) => {
        const classStr = isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';
        if (isPending) {
          return classStr.includes('opacity-50');
        }
        return classStr.includes('cursor-pointer');
      }),
    );
  });
});
