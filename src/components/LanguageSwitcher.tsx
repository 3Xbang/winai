'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { type Locale, locales } from '@/i18n/routing';
import { useTransition } from 'react';

const localeLabels: Record<Locale, string> = {
  zh: '中文',
  th: 'ไทย',
  en: 'EN',
};

export default function LanguageSwitcher() {
  const t = useTranslations('languageSwitcher');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleLocaleChange(newLocale: Locale) {
    if (newLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  }

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t('label')}>
      {locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleLocaleChange(loc)}
          disabled={isPending}
          aria-current={loc === locale ? 'true' : undefined}
          className={`px-2 py-1 text-sm rounded transition-colors ${
            loc === locale
              ? 'bg-blue-600 text-white font-medium'
              : 'text-gray-600 hover:bg-gray-100'
          } ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {localeLabels[loc]}
        </button>
      ))}
    </div>
  );
}
