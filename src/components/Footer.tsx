'use client';

import { useTranslations } from 'next-intl';
import { Layout } from 'antd';
import { Link } from '@/i18n/navigation';

const { Footer: AntFooter } = Layout;

export default function Footer() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <AntFooter className="text-center border-t px-4 py-8" style={{ background: 'var(--winai-navy)', borderColor: 'var(--winai-navy-light)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Brand */}
        <div className="mb-4">
          <span className="text-xl font-extrabold text-white tracking-tight">
            WIN<span style={{ color: 'var(--winai-gold)' }}>AI</span>
          </span>
          <p className="text-xs text-gray-400 mt-1">Legal Intelligence Platform</p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap justify-center gap-6 mb-4 text-sm">
          <Link href="/privacy" className="text-gray-400 hover:text-white winai-transition">
            {t('privacy')}
          </Link>
          <Link href="/terms" className="text-gray-400 hover:text-white winai-transition">
            {t('terms')}
          </Link>
          <Link href="/contact" className="text-gray-400 hover:text-white winai-transition">
            {t('contact')}
          </Link>
        </div>

        {/* Disclaimer & Copyright */}
        <p className="text-xs text-gray-500 mb-1">
          {t('disclaimer')}
        </p>
        <p className="text-xs text-gray-500">
          {t('copyright', { year: String(year) })}
        </p>
      </div>
    </AntFooter>
  );
}
