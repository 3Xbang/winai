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

describe('Admin Layout', () => {
  describe('Component file exists', () => {
    it('should have admin layout file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/layout.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/layout.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should use next-intl translations with admin namespace', () => {
      expect(content).toContain("useTranslations('admin')");
    });

    it('should render sidebar navigation', () => {
      expect(content).toContain('admin-sidebar');
      expect(content).toContain('Sider');
      expect(content).toContain('admin-menu');
    });

    it('should have menu items for dashboard, users, content, orders', () => {
      expect(content).toContain('/admin"');
      expect(content).toContain('/admin/users');
      expect(content).toContain('/admin/content');
      expect(content).toContain('/admin/orders');
    });

    it('should have admin-only access indicator', () => {
      expect(content).toContain('admin-only-badge');
      expect(content).toContain('adminOnly');
    });

    it('should have collapsible sidebar for responsive design', () => {
      expect(content).toContain('collapsible');
      expect(content).toContain('collapsed');
      expect(content).toContain('breakpoint');
      expect(content).toContain('sidebar-toggle');
    });
  });
});

describe('Admin Dashboard Page', () => {
  describe('Component file exists', () => {
    it('should have admin dashboard page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should use next-intl translations with admin namespace', () => {
      expect(content).toContain("useTranslations('admin')");
    });

    it('should have statistics cards', () => {
      expect(content).toContain('stats-cards');
      expect(content).toContain('Statistic');
      expect(content).toContain('stat-total-users');
      expect(content).toContain('stat-active-subscriptions');
      expect(content).toContain('stat-total-orders');
      expect(content).toContain('stat-total-revenue');
    });

    it('should have recent activity list', () => {
      expect(content).toContain('recent-activity');
      expect(content).toContain('List');
    });

    it('should have quick action buttons', () => {
      expect(content).toContain('quick-actions');
      expect(content).toContain('quick-manage-users');
      expect(content).toContain('quick-manage-content');
      expect(content).toContain('quick-view-orders');
    });
  });
});

describe('Admin User Management Page', () => {
  describe('Component file exists', () => {
    it('should have user management page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/users/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/users/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should use next-intl translations with admin namespace', () => {
      expect(content).toContain("useTranslations('admin')");
    });

    it('should render users table', () => {
      expect(content).toContain('users-table');
      expect(content).toContain('Table');
    });

    it('should have search input', () => {
      expect(content).toContain('users-search');
      expect(content).toContain('SearchOutlined');
    });

    it('should have role filter', () => {
      expect(content).toContain('users-role-filter');
      expect(content).toContain('Select');
    });

    it('should support all user roles', () => {
      expect(content).toContain('FREE_USER');
      expect(content).toContain('PAID_USER');
      expect(content).toContain('VIP_MEMBER');
      expect(content).toContain('ADMIN');
    });

    it('should have role modification dropdown', () => {
      expect(content).toContain('role-select-');
    });

    it('should have pagination', () => {
      expect(content).toContain('pageSize');
    });
  });
});

describe('Admin Content Management Page', () => {
  describe('Component file exists', () => {
    it('should have content management page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/content/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/content/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should use next-intl translations with admin namespace', () => {
      expect(content).toContain("useTranslations('admin')");
    });

    it('should render tabs for blog posts and testimonials', () => {
      expect(content).toContain('content-tabs');
      expect(content).toContain('Tabs');
      expect(content).toContain('blogPosts');
      expect(content).toContain('testimonials');
    });

    it('should have blog posts table', () => {
      expect(content).toContain('blog-table');
      expect(content).toContain('blog-edit-');
      expect(content).toContain('blog-delete-');
      expect(content).toContain('blog-publish-');
    });

    it('should have testimonials table with approve/reject actions', () => {
      expect(content).toContain('testimonial-table');
      expect(content).toContain('testimonial-approve-');
      expect(content).toContain('testimonial-reject-');
    });

    it('should display blog post statuses', () => {
      expect(content).toContain('draft');
      expect(content).toContain('published');
    });

    it('should display testimonial statuses', () => {
      expect(content).toContain('pending');
      expect(content).toContain('approved');
      expect(content).toContain('rejected');
    });

    it('should display ratings for testimonials', () => {
      expect(content).toContain('Rate');
    });
  });
});

describe('Admin Order Management Page', () => {
  describe('Component file exists', () => {
    it('should have order management page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/orders/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/admin/orders/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should use next-intl translations with admin namespace', () => {
      expect(content).toContain("useTranslations('admin')");
    });

    it('should render orders table', () => {
      expect(content).toContain('admin-orders-table');
      expect(content).toContain('Table');
    });

    it('should have search by order number', () => {
      expect(content).toContain('orders-search');
      expect(content).toContain('SearchOutlined');
    });

    it('should have status filter', () => {
      expect(content).toContain('orders-status-filter');
    });

    it('should display all order statuses', () => {
      expect(content).toContain('PAID');
      expect(content).toContain('PENDING');
      expect(content).toContain('EXPIRED');
      expect(content).toContain('REFUNDED');
      expect(content).toContain('FAILED');
    });

    it('should have refund action button', () => {
      expect(content).toContain('refund-btn-');
      expect(content).toContain('RollbackOutlined');
    });

    it('should have pagination', () => {
      expect(content).toContain('pageSize');
    });
  });
});

describe('Admin translation keys completeness', () => {
  const requiredKeys = [
    'admin.title',
    'admin.sidebar.dashboard',
    'admin.sidebar.users',
    'admin.sidebar.content',
    'admin.sidebar.orders',
    'admin.adminOnly',
    'admin.dashboard.title',
    'admin.dashboard.totalUsers',
    'admin.dashboard.activeSubscriptions',
    'admin.dashboard.totalOrders',
    'admin.dashboard.totalRevenue',
    'admin.dashboard.recentActivity',
    'admin.dashboard.quickActions',
    'admin.dashboard.manageUsers',
    'admin.dashboard.manageContent',
    'admin.dashboard.viewOrders',
    'admin.users.title',
    'admin.users.searchPlaceholder',
    'admin.users.filterByRole',
    'admin.users.allRoles',
    'admin.users.name',
    'admin.users.email',
    'admin.users.role',
    'admin.users.subscription',
    'admin.users.status',
    'admin.users.createdAt',
    'admin.users.actions',
    'admin.users.changeRole',
    'admin.users.active',
    'admin.users.inactive',
    'admin.users.roles.FREE_USER',
    'admin.users.roles.PAID_USER',
    'admin.users.roles.VIP_MEMBER',
    'admin.users.roles.ADMIN',
    'admin.content.title',
    'admin.content.blogPosts',
    'admin.content.testimonials',
    'admin.content.blog.postTitle',
    'admin.content.blog.author',
    'admin.content.blog.status',
    'admin.content.blog.date',
    'admin.content.blog.actions',
    'admin.content.blog.draft',
    'admin.content.blog.published',
    'admin.content.blog.edit',
    'admin.content.blog.delete',
    'admin.content.blog.publish',
    'admin.content.testimonial.user',
    'admin.content.testimonial.content',
    'admin.content.testimonial.rating',
    'admin.content.testimonial.status',
    'admin.content.testimonial.actions',
    'admin.content.testimonial.pending',
    'admin.content.testimonial.approved',
    'admin.content.testimonial.rejected',
    'admin.content.testimonial.approve',
    'admin.content.testimonial.reject',
    'admin.orders.title',
    'admin.orders.searchPlaceholder',
    'admin.orders.filterByStatus',
    'admin.orders.allStatuses',
    'admin.orders.orderNumber',
    'admin.orders.user',
    'admin.orders.product',
    'admin.orders.amount',
    'admin.orders.status',
    'admin.orders.date',
    'admin.orders.actions',
    'admin.orders.refund',
    'admin.orders.viewDetails',
    'admin.orders.statuses.PAID',
    'admin.orders.statuses.PENDING',
    'admin.orders.statuses.EXPIRED',
    'admin.orders.statuses.REFUNDED',
    'admin.orders.statuses.FAILED',
  ];

  for (const key of requiredKeys) {
    it(`should have translation key "${key}" in all locales`, () => {
      for (const locale of locales) {
        const value = getNestedValue(translations[locale], key);
        expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
        expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
        expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
      }
    });
  }
});
