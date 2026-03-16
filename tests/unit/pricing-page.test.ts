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

describe('Pricing Page', () => {
  describe('Component file exists', () => {
    it('should have pricing page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/pricing/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/pricing/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default PricingPage function', () => {
      expect(content).toContain('export default function PricingPage');
    });

    it('should use next-intl translations with pricing namespace', () => {
      expect(content).toContain("useTranslations('pricing')");
    });

    it('should have billing period toggle (monthly/annual)', () => {
      expect(content).toContain('billing-toggle');
      expect(content).toContain('MONTHLY');
      expect(content).toContain('YEARLY');
      expect(content).toContain('Switch');
    });

    it('should display all three plan tiers', () => {
      expect(content).toContain('FREE');
      expect(content).toContain('STANDARD');
      expect(content).toContain('VIP');
      expect(content).toContain('plan-cards');
    });

    it('should have subscribe/action buttons for each plan', () => {
      expect(content).toContain('subscribe-btn-');
      expect(content).toContain('data-testid={`subscribe-btn-${plan.tier}`}');
    });

    it('should have a comparison table', () => {
      expect(content).toContain('comparison-table');
      expect(content).toContain('Table');
    });

    it('should show annual discount savings', () => {
      expect(content).toContain('annual-discount-tag');
      expect(content).toContain('getAnnualSavings');
    });

    it('should display features list for each plan', () => {
      expect(content).toContain('CheckOutlined');
      expect(content).toContain('features');
    });
  });

  describe('Pricing translation keys completeness', () => {
    const requiredKeys = [
      'pricing.title',
      'pricing.subtitle',
      'pricing.monthly',
      'pricing.annual',
      'pricing.annualDiscount',
      'pricing.savePercent',
      'pricing.perMonth',
      'pricing.perYear',
      'pricing.currentPlan',
      'pricing.subscribe',
      'pricing.upgrade',
      'pricing.freeTrial',
      'pricing.features',
      'pricing.plans.FREE.name',
      'pricing.plans.FREE.description',
      'pricing.plans.FREE.dailyLimit',
      'pricing.plans.FREE.monthlyLimit',
      'pricing.plans.STANDARD.name',
      'pricing.plans.STANDARD.description',
      'pricing.plans.STANDARD.dailyLimit',
      'pricing.plans.STANDARD.monthlyLimit',
      'pricing.plans.VIP.name',
      'pricing.plans.VIP.description',
      'pricing.plans.VIP.dailyLimit',
      'pricing.plans.VIP.monthlyLimit',
      'pricing.comparison.feature',
      'pricing.comparison.basicConsultation',
      'pricing.comparison.contractService',
      'pricing.comparison.caseAnalysis',
      'pricing.comparison.visaConsultation',
      'pricing.comparison.priorityResponse',
      'pricing.comparison.unlimitedConsultation',
    ];

    for (const key of requiredKeys) {
      it(`should have translation key "${key}" in all locales`, () => {
        for (const locale of locales) {
          const value = getNestedValue(translations[locale], key);
          expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
        }
      });
    }
  });
});

describe('Payment Page', () => {
  describe('Component file exists', () => {
    it('should have payment page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/payment/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/payment/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default PaymentPage function', () => {
      expect(content).toContain('export default function PaymentPage');
    });

    it('should use next-intl translations with payment namespace', () => {
      expect(content).toContain("useTranslations('payment')");
    });

    it('should support all four payment methods', () => {
      expect(content).toContain('WECHAT');
      expect(content).toContain('ALIPAY');
      expect(content).toContain('PROMPTPAY');
      expect(content).toContain('STRIPE');
      expect(content).toContain('payment-methods');
    });

    it('should have order summary section', () => {
      expect(content).toContain('order-summary');
      expect(content).toContain('Descriptions');
    });

    it('should have pay now button', () => {
      expect(content).toContain('pay-now-btn');
    });

    it('should implement payment status polling', () => {
      expect(content).toContain('POLLING');
      expect(content).toContain('payment-polling');
      expect(content).toContain('setInterval');
    });

    it('should show success result', () => {
      expect(content).toContain('payment-success');
      expect(content).toContain('SUCCESS');
    });

    it('should show failed result', () => {
      expect(content).toContain('payment-failed');
      expect(content).toContain('FAILED');
    });

    it('should show expired result', () => {
      expect(content).toContain('payment-expired');
      expect(content).toContain('EXPIRED');
    });

    it('should have retry functionality', () => {
      expect(content).toContain('handleRetry');
      expect(content).toContain('retry-btn');
    });
  });

  describe('Payment translation keys completeness', () => {
    const requiredKeys = [
      'payment.title',
      'payment.orderSummary',
      'payment.plan',
      'payment.period',
      'payment.amount',
      'payment.selectMethod',
      'payment.methods.WECHAT',
      'payment.methods.ALIPAY',
      'payment.methods.PROMPTPAY',
      'payment.methods.STRIPE',
      'payment.payNow',
      'payment.processing',
      'payment.polling',
      'payment.success',
      'payment.successMessage',
      'payment.failed',
      'payment.failedMessage',
      'payment.expired',
      'payment.expiredMessage',
      'payment.retry',
      'payment.backToPricing',
      'payment.goToConsultation',
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
});

describe('Orders Page', () => {
  describe('Component file exists', () => {
    it('should have orders page file', () => {
      const filePath = path.resolve(__dirname, '../../src/app/[locale]/orders/page.tsx');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('Component structure validation', () => {
    const filePath = path.resolve(__dirname, '../../src/app/[locale]/orders/page.tsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('should be a client component', () => {
      expect(content).toContain("'use client'");
    });

    it('should export default OrdersPage function', () => {
      expect(content).toContain('export default function OrdersPage');
    });

    it('should use next-intl translations with orders namespace', () => {
      expect(content).toContain("useTranslations('orders')");
    });

    it('should have orders table', () => {
      expect(content).toContain('orders-table');
      expect(content).toContain('Table');
    });

    it('should display order status with colored tags', () => {
      expect(content).toContain('PAID');
      expect(content).toContain('PENDING');
      expect(content).toContain('EXPIRED');
      expect(content).toContain('REFUNDED');
      expect(content).toContain('FAILED');
      expect(content).toContain('Tag');
    });

    it('should have invoice request button for paid orders', () => {
      expect(content).toContain('invoice-btn-');
      expect(content).toContain('handleRequestInvoice');
    });

    it('should have invoice request modal', () => {
      expect(content).toContain('invoice-modal');
      expect(content).toContain('Modal');
    });

    it('should support CN_VAT and TH_TAX invoice types', () => {
      expect(content).toContain('CN_VAT');
      expect(content).toContain('TH_TAX');
      expect(content).toContain('invoice-type-select');
    });

    it('should have invoice form fields', () => {
      expect(content).toContain('invoice-company-input');
      expect(content).toContain('invoice-taxid-input');
      expect(content).toContain('invoice-address-input');
    });

    it('should show empty state when no orders', () => {
      expect(content).toContain('Empty');
      expect(content).toContain('noOrders');
    });
  });

  describe('Orders translation keys completeness', () => {
    const requiredKeys = [
      'orders.title',
      'orders.noOrders',
      'orders.orderNumber',
      'orders.date',
      'orders.product',
      'orders.amount',
      'orders.status',
      'orders.action',
      'orders.requestInvoice',
      'orders.viewDetails',
      'orders.statuses.PAID',
      'orders.statuses.PENDING',
      'orders.statuses.EXPIRED',
      'orders.statuses.REFUNDED',
      'orders.statuses.FAILED',
      'orders.invoice.title',
      'orders.invoice.type',
      'orders.invoice.CN_VAT',
      'orders.invoice.TH_TAX',
      'orders.invoice.companyName',
      'orders.invoice.taxId',
      'orders.invoice.address',
      'orders.invoice.submitRequest',
      'orders.invoice.success',
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
});
