import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
  return keyPath.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

const locales = ['zh', 'en', 'th'];
const translations = locales.reduce(
  (acc, locale) => {
    const filePath = path.resolve(__dirname, `../../messages/${locale}.json`);
    acc[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return acc;
  },
  {} as Record<string, Record<string, unknown>>
);

const LEGAL_TOPICS = [
  'company-registration',
  'visa-consultation',
  'contract-disputes',
  'labor-law',
  'tax-advisory',
  'ip-protection',
];

describe('SEO Landing Pages', () => {
  describe('Page files exist', () => {
    it('should have legal topic page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/legal/[topic]/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have legal topic content component', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/legal/[topic]/LegalTopicContent.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Landing page structure validation', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/[locale]/legal/[topic]/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');
    const contentPath = path.resolve(__dirname, '../../src/app/[locale]/legal/[topic]/LegalTopicContent.tsx');
    const contentFile = fs.readFileSync(contentPath, 'utf-8');

    it('should use generateStaticParams for SSG', () => {
      expect(pageContent).toContain('generateStaticParams');
    });

    it('should use generateMetadata for dynamic meta tags', () => {
      expect(pageContent).toContain('generateMetadata');
    });

    it('should generate metadata with title, description, and keywords', () => {
      expect(pageContent).toContain('title');
      expect(pageContent).toContain('description');
      expect(pageContent).toContain('keywords');
    });

    it('should define all 6 legal topics', () => {
      for (const topic of LEGAL_TOPICS) {
        expect(pageContent).toContain(topic);
      }
    });

    it('should have hero section', () => {
      expect(contentFile).toContain('hero-section');
      expect(contentFile).toContain('hero-title');
      expect(contentFile).toContain('hero-description');
    });

    it('should have features section', () => {
      expect(contentFile).toContain('features-section');
      expect(contentFile).toContain('feature-card-');
    });

    it('should have FAQ section with Collapse', () => {
      expect(contentFile).toContain('faq-section');
      expect(contentFile).toContain('faq-collapse');
      expect(contentFile).toContain('Collapse');
    });

    it('should have CTA section', () => {
      expect(contentFile).toContain('cta-section');
      expect(contentFile).toContain('cta-button');
    });

    it('should have JSON-LD structured data (LegalService)', () => {
      expect(contentFile).toContain('application/ld+json');
      expect(contentFile).toContain('LegalService');
      expect(contentFile).toContain('schema.org');
    });

    it('should use next-intl translations with seo namespace', () => {
      expect(contentFile).toContain("useTranslations('seo')");
    });
  });
});

describe('Blog List Page', () => {
  describe('Page file exists', () => {
    it('should have blog list page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/blog/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Blog list page structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/blog/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should use next-intl translations with blog namespace', () => {
      expect(content).toContain("useTranslations('blog')");
    });

    it('should have search functionality', () => {
      expect(content).toContain('blog-search');
      expect(content).toContain('SearchOutlined');
    });

    it('should have category filter', () => {
      expect(content).toContain('blog-category-filter');
      expect(content).toContain('Select');
    });

    it('should have blog post cards in a grid', () => {
      expect(content).toContain('blog-posts-grid');
      expect(content).toContain('blog-card-');
    });

    it('should display post metadata (title, excerpt, author, date, category, readTime)', () => {
      expect(content).toContain('post.title');
      expect(content).toContain('post.excerpt');
      expect(content).toContain('post.author');
      expect(content).toContain('post.date');
      expect(content).toContain('post.category');
      expect(content).toContain('readTime');
    });

    it('should have pagination', () => {
      expect(content).toContain('blog-pagination');
      expect(content).toContain('Pagination');
    });
  });
});

describe('Blog Post Page', () => {
  describe('Page files exist', () => {
    it('should have blog post page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/blog/[slug]/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should have blog post content component', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/blog/[slug]/BlogPostContent.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Blog post page structure validation', () => {
    const pagePath = path.resolve(__dirname, '../../src/app/[locale]/blog/[slug]/page.tsx');
    const pageContent = fs.readFileSync(pagePath, 'utf-8');
    const contentPath = path.resolve(__dirname, '../../src/app/[locale]/blog/[slug]/BlogPostContent.tsx');
    const contentFile = fs.readFileSync(contentPath, 'utf-8');

    it('should use generateMetadata for SEO', () => {
      expect(pageContent).toContain('generateMetadata');
    });

    it('should generate metadata with title, description, and keywords', () => {
      expect(pageContent).toContain('title');
      expect(pageContent).toContain('description');
      expect(pageContent).toContain('keywords');
    });

    it('should have JSON-LD Article structured data', () => {
      expect(contentFile).toContain('application/ld+json');
      expect(contentFile).toContain('Article');
      expect(contentFile).toContain('schema.org');
    });

    it('should display article content', () => {
      expect(contentFile).toContain('blog-post-content');
      expect(contentFile).toContain('blog-post-title');
    });

    it('should display author info', () => {
      expect(contentFile).toContain('blog-author-info');
      expect(contentFile).toContain('post.author');
      expect(contentFile).toContain('post.authorBio');
    });

    it('should have share buttons', () => {
      expect(contentFile).toContain('blog-share-buttons');
      expect(contentFile).toContain('share-twitter');
      expect(contentFile).toContain('share-linkedin');
      expect(contentFile).toContain('share-wechat');
    });

    it('should have related posts section', () => {
      expect(contentFile).toContain('related-posts');
      expect(contentFile).toContain('related-post-');
    });

    it('should have back to blog link', () => {
      expect(contentFile).toContain('backToBlog');
      expect(contentFile).toContain('/blog');
    });

    it('should use next-intl translations with blog namespace', () => {
      expect(contentFile).toContain("useTranslations('blog')");
    });
  });
});

describe('SEO translation keys completeness', () => {
  const seoKeys = [
    'seo.featuresTitle',
    'seo.faqTitle',
    'seo.cta.title',
    'seo.cta.description',
    'seo.cta.button',
  ];

  for (const topic of LEGAL_TOPICS) {
    seoKeys.push(
      `seo.topics.${topic}.title`,
      `seo.topics.${topic}.description`,
      `seo.topics.${topic}.keywords`,
      `seo.topics.${topic}.heroTitle`,
      `seo.topics.${topic}.heroDescription`,
      `seo.topics.${topic}.faq.q1`,
      `seo.topics.${topic}.faq.a1`,
      `seo.topics.${topic}.faq.q2`,
      `seo.topics.${topic}.faq.a2`,
      `seo.topics.${topic}.faq.q3`,
      `seo.topics.${topic}.faq.a3`,
    );
  }

  for (const key of seoKeys) {
    it(`should have SEO translation key "${key}" in all locales`, () => {
      for (const locale of locales) {
        const value = getNestedValue(translations[locale], key);
        expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
        expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
        expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
      }
    });
  }
});

describe('Blog translation keys completeness', () => {
  const blogKeys = [
    'blog.title',
    'blog.subtitle',
    'blog.searchPlaceholder',
    'blog.allCategories',
    'blog.categories.company',
    'blog.categories.visa',
    'blog.categories.contract',
    'blog.categories.labor',
    'blog.categories.tax',
    'blog.categories.ip',
    'blog.readMore',
    'blog.readTime',
    'blog.author',
    'blog.publishedAt',
    'blog.category',
    'blog.backToBlog',
    'blog.relatedPosts',
    'blog.share',
    'blog.shareOn.twitter',
    'blog.shareOn.linkedin',
    'blog.shareOn.wechat',
    'blog.noResults',
    'blog.pagination.prev',
    'blog.pagination.next',
  ];

  for (const key of blogKeys) {
    it(`should have blog translation key "${key}" in all locales`, () => {
      for (const locale of locales) {
        const value = getNestedValue(translations[locale], key);
        expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
        expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
        expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
      }
    });
  }
});
