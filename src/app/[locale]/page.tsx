import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import Image from 'next/image';

export default function Home() {
  const t = useTranslations('home');

  return (
    <div className="flex flex-col">
      {/* Hero Section - Orange */}
      <section className="bg-[#E8500A] py-10 px-4 text-center">
        <p className="text-white font-bold text-xl tracking-widest mb-3">Winaii</p>
        <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2">
          {t('heroTitle')}
        </h1>
        <p className="text-white/80 text-sm mb-6">{t('heroDescription')}</p>
        <Link
          href="/consultation"
          className="inline-block px-6 py-2.5 border border-white text-white text-sm rounded hover:bg-white hover:text-[#E8500A] transition-colors"
        >
          {t('ctaPrimary')}
        </Link>
      </section>

      {/* Hero Image Banner */}
      <section className="relative w-full h-64 sm:h-80 lg:h-96 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80"
          alt="Professional team"
          fill
          className="object-cover object-center"
          priority
        />
      </section>

      {/* About Us Section */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-2xl font-bold text-[#E8500A] mb-10">
            {t('aboutTitle')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {/* Mission */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full overflow-hidden relative">
                <Image
                  src="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=300&q=80"
                  alt="Our Mission"
                  fill
                  className="object-cover"
                />
              </div>
              <h3 className="font-semibold text-gray-800">{t('missionTitle')}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{t('missionDesc')}</p>
            </div>
            {/* Team */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full overflow-hidden relative">
                <Image
                  src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=300&q=80"
                  alt="Our Team"
                  fill
                  className="object-cover"
                />
              </div>
              <h3 className="font-semibold text-gray-800">{t('teamTitle')}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{t('teamDesc')}</p>
            </div>
            {/* Service */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-28 h-28 rounded-full overflow-hidden relative">
                <Image
                  src="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=300&q=80"
                  alt="Our Service"
                  fill
                  className="object-cover"
                />
              </div>
              <h3 className="font-semibold text-gray-800">{t('serviceTitle')}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{t('serviceDesc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Marquee Banner */}
      <section className="bg-[#E8500A] py-3 overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="text-white text-sm font-medium mx-8">
              {t('marqueText')}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
