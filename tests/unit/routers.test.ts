import { describe, it, expect, vi } from 'vitest';

// Mock external dependencies before importing routers
vi.mock('next-auth/jwt', () => ({ getToken: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ default: { subscriptionPlan: { findMany: vi.fn() }, user: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), findUnique: vi.fn() } } }));
vi.mock('@/lib/redis', () => ({ default: { get: vi.fn(), set: vi.fn(), incr: vi.fn(), expire: vi.fn() } }));
vi.mock('@/server/services/llm/gateway', () => ({
  getLLMGateway: () => ({ chat: vi.fn(), parseJSON: vi.fn() }),
}));
vi.mock('@/server/services/llm/prompt-engine', () => ({
  getPromptEngine: () => ({}),
}));

import { appRouter } from '@/server/root';
import { createCallerFactory } from '@/server/trpc';
import { TRPCError } from '@trpc/server';

const createCaller = createCallerFactory(appRouter);

function mockCtx(session: { userId: string; role: string } | null) {
  return { headers: new Headers(), session: session as any };
}

// ─── Router Structure Tests ─────────────────────────────────

describe('appRouter structure', () => {
  it('should have all expected top-level routers', () => {
    const routerKeys = Object.keys(appRouter._def.procedures).concat(
      ...Object.keys(appRouter._def.record),
    );
    // Check via the record which contains sub-routers
    const record = appRouter._def.record;
    expect(record).toHaveProperty('auth');
    expect(record).toHaveProperty('user');
    expect(record).toHaveProperty('consultation');
    expect(record).toHaveProperty('contract');
    expect(record).toHaveProperty('case');
    expect(record).toHaveProperty('evidence');
    expect(record).toHaveProperty('caseSearch');
    expect(record).toHaveProperty('visa');
    expect(record).toHaveProperty('report');
    expect(record).toHaveProperty('subscription');
    expect(record).toHaveProperty('payment');
    expect(record).toHaveProperty('session');
    expect(record).toHaveProperty('admin');
  });

  it('should have 20 top-level routers', () => {
    const count = Object.keys(appRouter._def.record).length;
    expect(count).toBe(20);
  });
});

describe('consultation router procedures', () => {
  it('should have submit and getResult procedures', () => {
    const record = appRouter._def.record;
    const consultation = record.consultation._def.record;
    expect(consultation).toHaveProperty('submit');
    expect(consultation).toHaveProperty('getResult');
  });
});

describe('contract router procedures', () => {
  it('should have draft and review procedures', () => {
    const contract = appRouter._def.record.contract._def.record;
    expect(contract).toHaveProperty('draft');
    expect(contract).toHaveProperty('review');
  });
});

describe('case router procedures', () => {
  it('should have analyze and generateStrategy procedures', () => {
    const caseRouter = appRouter._def.record.case._def.record;
    expect(caseRouter).toHaveProperty('analyze');
    expect(caseRouter).toHaveProperty('generateStrategy');
  });
});

describe('evidence router procedures', () => {
  it('should have generateChecklist, assessStrength, and identifyGaps', () => {
    const evidence = appRouter._def.record.evidence._def.record;
    expect(evidence).toHaveProperty('generateChecklist');
    expect(evidence).toHaveProperty('assessStrength');
    expect(evidence).toHaveProperty('identifyGaps');
  });
});

describe('caseSearch router procedures', () => {
  it('should have search and analyzeTrends procedures', () => {
    const caseSearch = appRouter._def.record.caseSearch._def.record;
    expect(caseSearch).toHaveProperty('search');
    expect(caseSearch).toHaveProperty('analyzeTrends');
  });
});

describe('visa router procedures', () => {
  it('should have recommend, getRenewalInfo, and getConversionPaths', () => {
    const visa = appRouter._def.record.visa._def.record;
    expect(visa).toHaveProperty('recommend');
    expect(visa).toHaveProperty('getRenewalInfo');
    expect(visa).toHaveProperty('getConversionPaths');
  });
});

describe('report router procedures', () => {
  it('should have generate and exportPDF procedures', () => {
    const report = appRouter._def.record.report._def.record;
    expect(report).toHaveProperty('generate');
    expect(report).toHaveProperty('exportPDF');
  });
});

describe('subscription router procedures', () => {
  it('should have checkQuota, subscribe, cancel, startTrial, and plans', () => {
    const sub = appRouter._def.record.subscription._def.record;
    expect(sub).toHaveProperty('checkQuota');
    expect(sub).toHaveProperty('subscribe');
    expect(sub).toHaveProperty('cancel');
    expect(sub).toHaveProperty('startTrial');
    expect(sub).toHaveProperty('plans');
  });
});

describe('payment router procedures', () => {
  it('should have createOrder, processPayment, refund, and generateInvoice', () => {
    const payment = appRouter._def.record.payment._def.record;
    expect(payment).toHaveProperty('createOrder');
    expect(payment).toHaveProperty('processPayment');
    expect(payment).toHaveProperty('refund');
    expect(payment).toHaveProperty('generateInvoice');
  });
});

describe('session router procedures', () => {
  it('should have save, search, exportPDF, bookmark, unbookmark, and resume', () => {
    const session = appRouter._def.record.session._def.record;
    expect(session).toHaveProperty('save');
    expect(session).toHaveProperty('search');
    expect(session).toHaveProperty('exportPDF');
    expect(session).toHaveProperty('bookmark');
    expect(session).toHaveProperty('unbookmark');
    expect(session).toHaveProperty('resume');
  });
});

describe('admin router procedures', () => {
  it('should have listUsers, updateUserRole, processExpiredSubscriptions, sendRenewalNotifications', () => {
    const admin = appRouter._def.record.admin._def.record;
    expect(admin).toHaveProperty('listUsers');
    expect(admin).toHaveProperty('updateUserRole');
    expect(admin).toHaveProperty('processExpiredSubscriptions');
    expect(admin).toHaveProperty('sendRenewalNotifications');
  });
});

// ─── Input Validation Tests ─────────────────────────────────

describe('consultation input validation', () => {
  it('should reject empty query for consultation.submit', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'FREE_USER' }));
    await expect(
      caller.consultation.submit({ query: '' }),
    ).rejects.toThrow();
  });
});

describe('contract input validation', () => {
  it('should reject empty contractText for contract.review', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'PAID_USER' }));
    await expect(
      caller.contract.review({
        contractText: '',
        jurisdiction: { jurisdiction: 'CHINA', confidence: 0.9 },
      }),
    ).rejects.toThrow();
  });

  it('should reject invalid contract type for contract.draft', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'PAID_USER' }));
    await expect(
      caller.contract.draft({
        contractType: 'INVALID' as any,
        parties: [{ name: 'A', role: '甲方' }],
        keyTerms: {},
        languages: ['zh'],
        jurisdiction: { jurisdiction: 'CHINA', confidence: 0.9 },
      }),
    ).rejects.toThrow();
  });
});

describe('payment input validation', () => {
  it('should reject negative amount for payment.createOrder', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'FREE_USER' }));
    await expect(
      caller.payment.createOrder({
        amount: -100,
        currency: 'CNY',
        method: 'WECHAT',
        productType: 'SUBSCRIPTION',
        productId: 'plan-1',
      }),
    ).rejects.toThrow();
  });

  it('should reject invalid currency for payment.createOrder', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'FREE_USER' }));
    await expect(
      caller.payment.createOrder({
        amount: 100,
        currency: 'EUR' as any,
        method: 'STRIPE',
        productType: 'SUBSCRIPTION',
        productId: 'plan-1',
      }),
    ).rejects.toThrow();
  });
});

// ─── Auth / Permission Tests ────────────────────────────────

describe('permission enforcement', () => {
  it('should reject unauthenticated access to consultation.submit', async () => {
    const caller = createCaller(mockCtx(null));
    await expect(
      caller.consultation.submit({ query: 'test' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('should reject FREE_USER access to contract.draft', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'FREE_USER' }));
    await expect(
      caller.contract.draft({
        contractType: 'LEASE',
        parties: [{ name: 'A', role: '甲方' }],
        keyTerms: {},
        languages: ['zh'],
        jurisdiction: { jurisdiction: 'CHINA', confidence: 0.9 },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('should reject non-admin access to payment.refund', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'PAID_USER' }));
    await expect(
      caller.payment.refund({ orderId: 'ord-1', reason: 'test' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('should reject non-admin access to admin.listUsers', async () => {
    const caller = createCaller(mockCtx({ userId: 'u1', role: 'VIP_MEMBER' }));
    await expect(
      caller.admin.listUsers({ page: 1, pageSize: 10 }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
