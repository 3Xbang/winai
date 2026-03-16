import { describe, it, expect, vi } from 'vitest';
import sitemap, {
  BASE_URL,
  LOCALES,
  STATIC_PAGES,
  LEGAL_TOPICS,
  PUBLISHED_BLOG_POSTS,
} from '../../src/app/sitemap';
import robots, { BASE_URL as ROBOTS_BASE_URL } from '../../src/app/robots';
import {
  renderTemplate,
  sendNewsletter,
  sendPromotion,
  createMockSESClient,
  TEMPLATES,
  type EmailRecipient,
  type NewsletterContent,
  type PromotionContent,
  type SESClient,
  type TemplateName,
} from '../../src/server/services/marketing/email';

// ============================================================
// Sitemap Tests
// ============================================================

describe('Sitemap Generation', () => {
  const entries = sitemap();

  it('should return a non-empty array of sitemap entries', () => {
    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('should include all static pages for all 3 locales', () => {
    for (const page of STATIC_PAGES) {
      for (const locale of LOCALES) {
        const expectedUrl = `${BASE_URL}/${locale}${page.path}`;
        const found = entries.find((e) => e.url === expectedUrl);
        expect(found, `Missing sitemap entry for ${expectedUrl}`).toBeDefined();
      }
    }
  });

  it('should include all 6 legal topic pages for all 3 locales', () => {
    for (const topic of LEGAL_TOPICS) {
      for (const locale of LOCALES) {
        const expectedUrl = `${BASE_URL}/${locale}/legal/${topic}`;
        const found = entries.find((e) => e.url === expectedUrl);
        expect(found, `Missing sitemap entry for ${expectedUrl}`).toBeDefined();
      }
    }
  });

  it('should include all published blog posts for all 3 locales', () => {
    for (const post of PUBLISHED_BLOG_POSTS) {
      for (const locale of LOCALES) {
        const expectedUrl = `${BASE_URL}/${locale}/blog/${post.slug}`;
        const found = entries.find((e) => e.url === expectedUrl);
        expect(found, `Missing sitemap entry for ${expectedUrl}`).toBeDefined();
      }
    }
  });

  it('every entry should have url, lastModified, changeFrequency, and priority', () => {
    for (const entry of entries) {
      expect(entry.url).toBeDefined();
      expect(typeof entry.url).toBe('string');
      expect(entry.url.startsWith('http')).toBe(true);
      expect(entry.lastModified).toBeDefined();
      expect(entry.changeFrequency).toBeDefined();
      expect(entry.priority).toBeDefined();
      expect(typeof entry.priority).toBe('number');
      expect(entry.priority).toBeGreaterThanOrEqual(0);
      expect(entry.priority).toBeLessThanOrEqual(1);
    }
  });

  it('should have correct total entry count (static + legal + blog) × 3 locales', () => {
    const expectedCount =
      (STATIC_PAGES.length + LEGAL_TOPICS.length + PUBLISHED_BLOG_POSTS.length) * LOCALES.length;
    expect(entries.length).toBe(expectedCount);
  });

  it('home page should have highest priority (1.0)', () => {
    for (const locale of LOCALES) {
      const homeEntry = entries.find((e) => e.url === `${BASE_URL}/${locale}`);
      expect(homeEntry).toBeDefined();
      expect(homeEntry!.priority).toBe(1.0);
    }
  });

  it('new blog posts would appear in sitemap when added to PUBLISHED_BLOG_POSTS', () => {
    // Verify the pattern: blog posts are included based on the PUBLISHED_BLOG_POSTS array
    // Adding a new post to that array would automatically include it in the sitemap
    const blogEntries = entries.filter((e) => e.url.includes('/blog/'));
    expect(blogEntries.length).toBe(PUBLISHED_BLOG_POSTS.length * LOCALES.length);
  });
});

// ============================================================
// Robots.txt Tests
// ============================================================

describe('Robots.txt Configuration', () => {
  const config = robots();

  it('should return a valid robots config object', () => {
    expect(config).toBeDefined();
    expect(config.rules).toBeDefined();
  });

  it('should allow all crawlers', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    expect(wildcardRule).toBeDefined();
    expect(wildcardRule!.allow).toBe('/');
  });

  it('should disallow admin routes', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    expect(wildcardRule).toBeDefined();
    const disallowed = Array.isArray(wildcardRule!.disallow)
      ? wildcardRule!.disallow
      : [wildcardRule!.disallow];
    expect(disallowed).toContain('/admin/');
  });

  it('should disallow API routes', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    const disallowed = Array.isArray(wildcardRule!.disallow)
      ? wildcardRule!.disallow
      : [wildcardRule!.disallow];
    expect(disallowed).toContain('/api/');
  });

  it('should disallow auth and payment routes', () => {
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const wildcardRule = rules.find((r) => r.userAgent === '*');
    const disallowed = Array.isArray(wildcardRule!.disallow)
      ? wildcardRule!.disallow
      : [wildcardRule!.disallow];
    expect(disallowed).toContain('/auth/');
    expect(disallowed).toContain('/payment/');
  });

  it('should reference the sitemap URL', () => {
    expect(config.sitemap).toBeDefined();
    expect(config.sitemap).toContain('sitemap.xml');
    expect(config.sitemap).toContain(ROBOTS_BASE_URL);
  });
});

// ============================================================
// Email Template Rendering Tests
// ============================================================

describe('Email Template Rendering', () => {
  it('should have all 3 templates defined', () => {
    expect(TEMPLATES['legal-newsletter']).toBeDefined();
    expect(TEMPLATES['promotion']).toBeDefined();
    expect(TEMPLATES['welcome']).toBeDefined();
  });

  it('should render legal-newsletter template with variables', () => {
    const html = renderTemplate('legal-newsletter', {
      subject: 'Test Newsletter',
      recipientName: 'John',
      articles: '<div>Article 1</div>',
      legalUpdates: '<p>Update 1</p>',
      unsubscribeUrl: 'https://example.com/unsub',
    });

    expect(html).toContain('Test Newsletter');
    expect(html).toContain('John');
    expect(html).toContain('Article 1');
    expect(html).toContain('Update 1');
    expect(html).toContain('https://example.com/unsub');
  });

  it('should render promotion template with variables', () => {
    const html = renderTemplate('promotion', {
      subject: 'Special Offer',
      recipientName: 'Alice',
      promotionTitle: 'VIP Discount',
      description: 'Get 50% off',
      discountPercent: '50',
      validUntil: '2024-12-31',
      ctaUrl: 'https://example.com/buy',
      ctaText: 'Buy Now',
      unsubscribeUrl: 'https://example.com/unsub',
    });

    expect(html).toContain('Special Offer');
    expect(html).toContain('Alice');
    expect(html).toContain('VIP Discount');
    expect(html).toContain('50% OFF');
    expect(html).toContain('2024-12-31');
    expect(html).toContain('Buy Now');
  });

  it('should render welcome template with variables', () => {
    const html = renderTemplate('welcome', {
      recipientName: 'Bob',
      dashboardUrl: 'https://example.com/dashboard',
    });

    expect(html).toContain('Bob');
    expect(html).toContain('https://example.com/dashboard');
    expect(html).toContain('欢迎加入');
  });

  it('should throw error for unknown template', () => {
    expect(() => renderTemplate('nonexistent' as TemplateName, {})).toThrow(
      'Template "nonexistent" not found'
    );
  });

  it('should handle conditional blocks - show when variable present', () => {
    const html = renderTemplate('promotion', {
      subject: 'Test',
      recipientName: 'Test',
      promotionTitle: 'Test',
      description: 'Test',
      discountPercent: '30',
      validUntil: '',
      ctaUrl: '#',
      ctaText: 'Click',
      unsubscribeUrl: '#',
    });

    expect(html).toContain('30% OFF');
  });

  it('should handle conditional blocks - hide when variable empty', () => {
    const html = renderTemplate('promotion', {
      subject: 'Test',
      recipientName: 'Test',
      promotionTitle: 'Test',
      description: 'Test',
      discountPercent: '',
      ctaUrl: '#',
      ctaText: 'Click',
      unsubscribeUrl: '#',
    });

    expect(html).not.toContain('% OFF');
  });
});

// ============================================================
// Newsletter Sending Tests
// ============================================================

describe('Newsletter Sending', () => {
  const mockRecipients: EmailRecipient[] = [
    { email: 'user1@example.com', name: 'User One', locale: 'zh' },
    { email: 'user2@example.com', name: 'User Two', locale: 'en' },
  ];

  const mockContent: NewsletterContent = {
    subject: '本周法律资讯',
    articles: [
      {
        title: '泰国公司注册新规',
        summary: '2024年泰国公司注册流程更新',
        url: 'https://example.com/article-1',
      },
    ],
    legalUpdates: ['民法典修正案通过'],
  };

  it('should send newsletter to all recipients successfully', async () => {
    const mockClient = createMockSESClient();
    const result = await sendNewsletter(mockRecipients, mockContent, mockClient);

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.errors).toBeUndefined();
  });

  it('should handle empty recipients list', async () => {
    const result = await sendNewsletter([], mockContent);

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });

  it('should handle SES failures gracefully', async () => {
    const failingClient: SESClient = {
      async sendEmail() {
        throw new Error('SES rate limit exceeded');
      },
    };

    const result = await sendNewsletter(mockRecipients, mockContent, failingClient);

    expect(result.success).toBe(false);
    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(2);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBe(2);
    expect(result.errors![0]).toContain('SES rate limit exceeded');
  });

  it('should handle partial failures', async () => {
    let callCount = 0;
    const partialFailClient: SESClient = {
      async sendEmail() {
        callCount++;
        if (callCount === 1) {
          return { messageId: 'msg-1', success: true };
        }
        throw new Error('Delivery failed');
      },
    };

    const result = await sendNewsletter(mockRecipients, mockContent, partialFailClient);

    expect(result.success).toBe(false);
    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(1);
  });
});

// ============================================================
// Promotion Sending Tests
// ============================================================

describe('Promotion Sending', () => {
  const mockRecipients: EmailRecipient[] = [
    { email: 'promo1@example.com', name: 'Promo User', locale: 'zh' },
  ];

  const mockPromotion: PromotionContent = {
    subject: 'VIP 限时优惠',
    promotionTitle: '年度会员特惠',
    description: '限时享受VIP会员50%折扣',
    discountPercent: 50,
    validUntil: new Date('2024-12-31'),
    ctaUrl: 'https://example.com/pricing',
    ctaText: '立即订阅',
  };

  it('should send promotion to all recipients successfully', async () => {
    const mockClient = createMockSESClient();
    const result = await sendPromotion(mockRecipients, mockPromotion, mockClient);

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('should handle empty recipients list', async () => {
    const result = await sendPromotion([], mockPromotion);

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(0);
    expect(result.failedCount).toBe(0);
  });

  it('should handle SES failures gracefully', async () => {
    const failingClient: SESClient = {
      async sendEmail() {
        throw new Error('Connection timeout');
      },
    };

    const result = await sendPromotion(mockRecipients, mockPromotion, failingClient);

    expect(result.success).toBe(false);
    expect(result.failedCount).toBe(1);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toContain('Connection timeout');
  });

  it('should handle promotion without discount percent', async () => {
    const noDiscountPromo: PromotionContent = {
      subject: 'Free Trial',
      promotionTitle: 'Try VIP Free',
      description: 'Get 7 days free trial',
      ctaUrl: 'https://example.com/trial',
      ctaText: 'Start Trial',
    };

    const mockClient = createMockSESClient();
    const result = await sendPromotion(mockRecipients, noDiscountPromo, mockClient);

    expect(result.success).toBe(true);
    expect(result.sentCount).toBe(1);
  });
});

// ============================================================
// Mock SES Client Tests
// ============================================================

describe('Mock SES Client', () => {
  it('should return a valid message ID', async () => {
    const client = createMockSESClient();
    const result = await client.sendEmail({
      to: ['test@example.com'],
      subject: 'Test',
      htmlBody: '<p>Test</p>',
      from: 'noreply@example.com',
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    expect(result.messageId.startsWith('mock-')).toBe(true);
  });
});
