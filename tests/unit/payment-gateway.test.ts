import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock Redis
vi.mock('@/lib/redis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
  return { default: mockRedis, redis: mockRedis };
});

// Mock Prisma
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import {
  createOrder,
  processPayment,
  refund,
  generateInvoice,
  expirePendingOrders,
} from '@/server/services/payment/gateway';

const mockPrisma = prisma as any;
const mockRedis = redis as any;

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== createOrder ====================

describe('createOrder', () => {
  const validRequest = {
    userId: 'user-1',
    amount: 99.99,
    currency: 'CNY' as const,
    method: 'WECHAT' as const,
    productType: 'SUBSCRIPTION' as const,
    productId: 'plan-std',
  };

  it('should create an order with 30-minute expiry', async () => {
    const now = new Date();
    vi.setSystemTime(now);

    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.order.create.mockImplementation(({ data }: any) => {
      return Promise.resolve({
        id: 'order-1',
        ...data,
        createdAt: now,
      });
    });

    const result = await createOrder(validRequest);

    expect(result.id).toBe('order-1');
    expect(result.userId).toBe('user-1');
    expect(result.amount).toBe(99.99);
    expect(result.currency).toBe('CNY');
    expect(result.paymentMethod).toBe('WECHAT');
    expect(result.paymentStatus).toBe('PENDING');
    expect(result.productType).toBe('SUBSCRIPTION');
    expect(result.orderNumber).toMatch(/^ORD-/);
    expect(result.transactionId).toBeFalsy();
    expect(result.paidAt).toBeFalsy();

    // Verify 30-minute expiry
    const expectedExpiry = new Date(now.getTime() + 30 * 60 * 1000);
    expect(result.expiresAt.getTime()).toBe(expectedExpiry.getTime());

    vi.useRealTimers();
  });

  it('should throw BAD_REQUEST when amount is zero or negative', async () => {
    await expect(createOrder({ ...validRequest, amount: 0 })).rejects.toThrow('订单金额必须大于0');
    await expect(createOrder({ ...validRequest, amount: -10 })).rejects.toThrow('订单金额必须大于0');
  });

  it('should throw NOT_FOUND when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(createOrder(validRequest)).rejects.toThrow('用户不存在');
  });

  it('should support different currencies and payment methods', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.order.create.mockImplementation(({ data }: any) => {
      return Promise.resolve({ id: 'order-2', ...data, createdAt: new Date() });
    });

    const thbOrder = await createOrder({
      ...validRequest,
      currency: 'THB',
      method: 'PROMPTPAY',
    });

    expect(thbOrder.currency).toBe('THB');
    expect(thbOrder.paymentMethod).toBe('PROMPTPAY');
  });
});

// ==================== processPayment ====================

describe('processPayment', () => {
  it('should process payment successfully with distributed lock', async () => {
    const futureExpiry = new Date(Date.now() + 20 * 60 * 1000);

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'PENDING',
      expiresAt: futureExpiry,
    });
    mockPrisma.order.update.mockResolvedValue({});

    const result = await processPayment('order-1');

    expect(result.success).toBe(true);
    expect(result.orderId).toBe('order-1');
    expect(result.transactionId).toMatch(/^TXN-/);
    expect(result.paidAt).toBeInstanceOf(Date);
    expect(result.message).toBe('支付成功');

    // Verify lock was acquired and released
    expect(mockRedis.set).toHaveBeenCalledWith(
      'payment:lock:order-1',
      '1',
      'EX',
      30,
      'NX',
    );
    expect(mockRedis.del).toHaveBeenCalledWith('payment:lock:order-1');
  });

  it('should reject duplicate payment with CONFLICT when lock is held', async () => {
    mockRedis.set.mockResolvedValue(null); // Lock not acquired

    await expect(processPayment('order-1')).rejects.toThrow('支付正在处理中，请勿重复提交');
  });

  it('should throw NOT_FOUND when order does not exist', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(processPayment('nonexistent')).rejects.toThrow('订单不存在');
    // Lock should still be released
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('should reject payment for already paid order', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'PAID',
    });

    await expect(processPayment('order-1')).rejects.toThrow('订单已支付');
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('should reject payment for expired order (by status)', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'EXPIRED',
    });

    await expect(processPayment('order-1')).rejects.toThrow('订单已过期');
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('should expire and reject order that has passed expiresAt', async () => {
    const pastExpiry = new Date(Date.now() - 5 * 60 * 1000);

    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'PENDING',
      expiresAt: pastExpiry,
    });
    mockPrisma.order.update.mockResolvedValue({});

    await expect(processPayment('order-1')).rejects.toThrow('订单已过期');

    // Should have updated order status to EXPIRED
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { paymentStatus: 'EXPIRED' },
    });
    expect(mockRedis.del).toHaveBeenCalled();
  });

  it('should release lock even when an error occurs', async () => {
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.del.mockResolvedValue(1);
    mockPrisma.order.findUnique.mockRejectedValue(new Error('DB error'));

    await expect(processPayment('order-1')).rejects.toThrow('DB error');
    expect(mockRedis.del).toHaveBeenCalledWith('payment:lock:order-1');
  });
});

// ==================== refund ====================

describe('refund', () => {
  it('should process refund for a paid order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'PAID',
    });
    mockPrisma.order.update.mockResolvedValue({});

    const result = await refund('order-1', '服务未使用');

    expect(result.success).toBe(true);
    expect(result.orderId).toBe('order-1');
    expect(result.reason).toBe('服务未使用');
    expect(result.refundedAt).toBeInstanceOf(Date);
    expect(result.message).toBe('退款处理成功');

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        paymentStatus: 'REFUNDED',
        refundReason: '服务未使用',
      }),
    });
  });

  it('should throw BAD_REQUEST when reason is empty', async () => {
    await expect(refund('order-1', '')).rejects.toThrow('退款原因不能为空');
    await expect(refund('order-1', '   ')).rejects.toThrow('退款原因不能为空');
  });

  it('should throw NOT_FOUND when order does not exist', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(refund('nonexistent', '退款')).rejects.toThrow('订单不存在');
  });

  it('should throw BAD_REQUEST when order is not paid', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'PENDING',
    });

    await expect(refund('order-1', '退款')).rejects.toThrow('只有已支付的订单才能退款');
  });

  it('should throw BAD_REQUEST when order is already refunded', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'REFUNDED',
    });

    await expect(refund('order-1', '退款')).rejects.toThrow('只有已支付的订单才能退款');
  });
});

// ==================== generateInvoice ====================

describe('generateInvoice', () => {
  const paidOrder = {
    id: 'order-1',
    userId: 'user-1',
    orderNumber: 'ORD-ABC-123',
    amount: 299,
    currency: 'CNY',
    paymentStatus: 'PAID',
    productType: 'SUBSCRIPTION',
  };

  it('should generate CN_VAT invoice for a paid order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(paidOrder);
    mockPrisma.order.update.mockResolvedValue({});

    const result = await generateInvoice('order-1', 'CN_VAT');

    expect(result.orderId).toBe('order-1');
    expect(result.format).toBe('CN_VAT');
    expect(result.invoiceNumber).toMatch(/^INV-CN-/);
    expect(result.orderNumber).toBe('ORD-ABC-123');
    expect(result.amount).toBe(299);
    expect(result.currency).toBe('CNY');
    expect(result.productType).toBe('SUBSCRIPTION');
    expect(result.issuedAt).toBeInstanceOf(Date);
    expect(result.buyerInfo.userId).toBe('user-1');
    expect(result.taxDetails.taxType).toBe('增值税电子普通发票');
    expect(result.taxDetails.taxRate).toBe('6%');
    expect(result.url).toMatch(/^\/invoices\/INV-CN-/);
  });

  it('should generate TH_TAX invoice for a paid order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      ...paidOrder,
      currency: 'THB',
    });
    mockPrisma.order.update.mockResolvedValue({});

    const result = await generateInvoice('order-1', 'TH_TAX');

    expect(result.format).toBe('TH_TAX');
    expect(result.invoiceNumber).toMatch(/^INV-TH-/);
    expect(result.taxDetails.taxType).toBe('ใบกำกับภาษี');
    expect(result.taxDetails.taxRate).toBe('7%');
  });

  it('should throw NOT_FOUND when order does not exist', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);

    await expect(generateInvoice('nonexistent', 'CN_VAT')).rejects.toThrow('订单不存在');
  });

  it('should throw BAD_REQUEST when order is not paid', async () => {
    mockPrisma.order.findUnique.mockResolvedValue({
      ...paidOrder,
      paymentStatus: 'PENDING',
    });

    await expect(generateInvoice('order-1', 'CN_VAT')).rejects.toThrow(
      '只有已支付的订单才能开具发票',
    );
  });

  it('should store invoice URL on the order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(paidOrder);
    mockPrisma.order.update.mockResolvedValue({});

    await generateInvoice('order-1', 'CN_VAT');

    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: { invoiceUrl: expect.stringMatching(/^\/invoices\/INV-CN-/) },
    });
  });
});

// ==================== expirePendingOrders ====================

describe('expirePendingOrders', () => {
  it('should expire pending orders past their expiresAt', async () => {
    mockPrisma.order.updateMany.mockResolvedValue({ count: 3 });

    const result = await expirePendingOrders();

    expect(result).toBe(3);
    expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
      where: {
        paymentStatus: 'PENDING',
        expiresAt: { lt: expect.any(Date) },
      },
      data: { paymentStatus: 'EXPIRED' },
    });
  });

  it('should return 0 when no orders need expiring', async () => {
    mockPrisma.order.updateMany.mockResolvedValue({ count: 0 });

    const result = await expirePendingOrders();

    expect(result).toBe(0);
  });
});
