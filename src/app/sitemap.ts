import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.china-thailand-legal.com';

const LOCALES = ['zh', 'th', 'en'] as const;

const STATIC_PAGES = [
  { path: '', changeFrequency: 'weekly' as const, priority: 1.0 },
  { path: '/pricing', changeFrequency: 'monthly' as const, priority: 0.8 },
  { path: '/consultation', changeFrequency: 'weekly' as const, priority: 0.9 },
  { path: '/blog', changeFrequency: 'daily' as const, priority: 0.8 },
  { path: '/visa', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/contract/draft', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/contract/review', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/case-analysis', changeFrequency: 'monthly' as const, priority: 0.7 },
  { path: '/evidence', changeFrequency: 'monthly' as const, priority: 0.6 },
  { path: '/referral', changeFrequency: 'monthly' as const, priority: 0.5 },
  { path: '/testimonials', changeFrequency: 'weekly' as const, priority: 0.5 },
];

const LEGAL_TOPICS = [
  'company-registration',
  'visa-consultation',
  'contract-disputes',
  'labor-law',
  'tax-advisory',
  'ip-protection',
] as const;

// Mock published blog posts - in production, this would query the database
const PUBLISHED_BLOG_POSTS = [
  { slug: 'thailand-company-registration-guide', updatedAt: '2024-01-15' },
  { slug: 'thailand-visa-types-comparison', updatedAt: '2024-01-10' },
  { slug: 'cross-border-contract-risks', updatedAt: '2024-01-05' },
  { slug: 'thailand-labor-law-essentials', updatedAt: '2023-12-28' },
  { slug: 'china-thailand-tax-planning', updatedAt: '2023-12-20' },
  { slug: 'ip-protection-in-thailand', updatedAt: '2023-12-15' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  // Static pages for all locales
  for (const page of STATIC_PAGES) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified: new Date(),
        changeFrequency: page.changeFrequency,
        priority: page.priority,
      });
    }
  }

  // Legal topic pages for all locales
  for (const topic of LEGAL_TOPICS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}/legal/${topic}`,
        lastModified: new Date(),
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    }
  }

  // Blog post pages for all locales
  for (const post of PUBLISHED_BLOG_POSTS) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}/blog/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  }

  return entries;
}

export { BASE_URL, LOCALES, STATIC_PAGES, LEGAL_TOPICS, PUBLISHED_BLOG_POSTS };
