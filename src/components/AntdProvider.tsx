'use client';

import { useState, useEffect } from 'react';
import { ConfigProvider } from 'antd';
import { useLocale } from 'next-intl';
import zhCN from 'antd/locale/zh_CN';
import thTH from 'antd/locale/th_TH';
import enUS from 'antd/locale/en_US';
import type { Locale as AntdLocale } from 'antd/es/locale';

const antdLocaleMap: Record<string, AntdLocale> = {
  zh: zhCN,
  th: thTH,
  en: enUS,
};

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const antdLocale = antdLocaleMap[locale] || enUS;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        token: {
          colorPrimary: '#2563eb',
          borderRadius: 6,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
