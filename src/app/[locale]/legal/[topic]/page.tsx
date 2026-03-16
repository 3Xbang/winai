import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import LegalTopicContent from './LegalTopicContent';

const LEGAL_TOPICS = [
  'company-registration',
  'visa-consultation',
  'contract-disputes',
  'labor-law',
  'tax-advisory',
  'ip-protection',
] as const;

type LegalTopic = (typeof LEGAL_TOPICS)[number];

function isValidTopic(topic: string): topic is LegalTopic {
  return LEGAL_TOPICS.includes(topic as LegalTopic);
}

export async function generateStaticParams() {
  const locales = ['zh', 'en', 'th'];
  return locales.flatMap((locale) =>
    LEGAL_TOPICS.map((topic) => ({ locale, topic }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; topic: string }>;
}): Promise<Metadata> {
  const { locale, topic } = await params;
  if (!isValidTopic(topic)) return {};

  const t = await getTranslations({ locale, namespace: 'seo' });

  const title = t(`topics.${topic}.title`);
  const description = t(`topics.${topic}.description`);
  const keywords = t(`topics.${topic}.keywords`);

  return {
    title,
    description,
    keywords: keywords.split(','),
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

export default async function LegalTopicPage({
  params,
}: {
  params: Promise<{ locale: string; topic: string }>;
}) {
  const { topic } = await params;

  if (!isValidTopic(topic)) {
    notFound();
  }

  return <LegalTopicContent topic={topic} />;
}
