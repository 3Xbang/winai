import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const FEATURES = [
  { icon: '💬', titleKey: 'consultation', descKey: 'consultationDesc', href: '/consultation' },
  { icon: '📄', titleKey: 'contract', descKey: 'contractDesc', href: '/contract' },
  { icon: '⚖️', titleKey: 'caseAnalysis', descKey: 'caseAnalysisDesc', href: '/case-analysis' },
  { icon: '🛂', titleKey: 'visa', descKey: 'visaDesc', href: '/visa' },
  { icon: '📊', titleKey: 'evidence', descKey: 'evidenceDesc', href: '/evidence' },
  { icon: '🔍', titleKey: 'caseSearch', descKey: 'caseSearchDesc', href: '/consultation' },
] as const;

export default function Home() {
  const t = useTranslations();
  const tHome = useTranslations('home');

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative winai-gradient overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 rounded-full blur-3xl" style={{ background: 'var(--winai-gold)' }} />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 lg:py-36 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {tHome('badge')}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
            {tHome('heroTitle')}
            <br />
            <span className="winai-text-gradient">{tHome('heroHighlight')}</span>
          </h1>

          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
            {tHome('heroDescription')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/consultation"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-semibold winai-gradient-gold text-white shadow-lg hover:shadow-xl winai-transition winai-pulse"
            >
              {tHome('ctaPrimary')}
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-base font-semibold bg-white/10 backdrop-blur-sm text-white border border-white/20 hover:bg-white/20 winai-transition"
            >
              {tHome('ctaSecondary')}
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 mt-14 text-white/60 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🇨🇳</span>
              <span>{tHome('trustChina')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🇹🇭</span>
              <span>{tHome('trustThailand')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <span>{tHome('trustAI')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6" style={{ background: 'var(--winai-bg)' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--winai-navy)' }}>
              {tHome('featuresTitle')}
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              {tHome('featuresSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <Link
                key={f.titleKey}
                href={f.href}
                className="group block p-6 rounded-2xl bg-white border border-gray-100 shadow-sm winai-hover-lift"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2 group-hover:text-[var(--winai-gold-dark)] winai-transition" style={{ color: 'var(--winai-navy)' }}>
                  {tHome(f.titleKey)}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {tHome(f.descKey)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="winai-gradient py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {tHome('ctaTitle')}
          </h2>
          <p className="text-gray-300 text-lg mb-8">
            {tHome('ctaDescription')}
          </p>
          <Link
            href="/consultation"
            className="inline-flex items-center justify-center px-10 py-4 rounded-xl text-lg font-semibold winai-gradient-gold text-white shadow-lg hover:shadow-xl winai-transition"
          >
            {tHome('ctaButton')}
          </Link>
        </div>
      </section>
    </div>
  );
}
