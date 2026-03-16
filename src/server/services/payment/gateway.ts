import { TRPCError } from '@trpc/server';
import prisma from '@/lib/prisma';
import redis from '@/lib/redis';

// ==================== Types ====================

export interface PaymentRequest {
  userId: string;
  amount: number;
  currency: 'CNY' | 'THB' | 'USD';
  method: 'WECHAT' | 'ALIPAY' | 'PROMPTPAY' | 'STRIPE';
  productType: 'SUBSCRIPTION' | 'SINGLE_CONSULTATION';
  productId: string;
}

export interface Order {
  id: string;
  userId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  productType: string;
  productId: string;
  transactionId: string | null;
  paidAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  transactionId: string;
  paidAt: Date;
  message: string;
}

export interface RefundResult {
  success: boolean;
  orderId: string;
  refundedAt: Date;
  reason: string;
  message: string;
}

export interface Invoice {
  orderId: string;
  invoiceNumber: string;
  format: 'CN_VAT' | 'TH_TAX';
  orderNumber: string;
  amount: number;
  currency: string;
  productType: string;
  issuedAt: Date;
  buyerInfo: { userId: string };
  taxDetails: Record<string, string>;
  url: string;
}

// ==================== Constants ====================

const ORDER_EXPIRY_MINUTES = 30;
const LOCK_TTL_SECONDS = 30;

// Redis key helpers
const paymentLockKey = (orderId: string) => `payment:lock:${orderId}`;

/**
 * Generate a unique order number: ORD-{timestamp}-{random}
 */
function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

/**
 * Generate a unique invoice number: INV-{format}-{timestamp}-{random}
 */
function generateInvoiceNumber(format: 'CN_VAT' | 'TH_TAX'): string {
  const prefix = format === 'CN_VAT' ? 'CN' : 'TH';
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${prefix}-${ts}-${rand}`;
}

/**
 * Generate a transaction ID: TXN-{timestamp}-{random}
 */
function generateTransactionId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `TXN-${ts}-${rand}`;
}

// ==================== Payment Gateway ====================

/**
 * Create a new payment order with 30-minute expiry.
 * Requirements: 16.4, 16.7
 */
export async function createOrder(request: PaymentRequest): Promise<Order> {
  const { userId, amount, currency, method, productType, productId } = request;

  if (amount <= 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '订单金额必须大于0' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ORDER_EXPIRY_MINUTES * 60 * 1000);
  const orderNumber = generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      userId,
      orderNumber,
      amount,
      currency,
      paymentMethod: method,
      paymentStatus: 'PENDING',
      productType,
      productId,
      expiresAt,
    },
  });

  return {
    id: order.id,
    userId: order.userId,
    orderNumber: order.orderNumber,
    amount: Number(order.amount),
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    productType: order.productType,
    productId: order.productId,
    transactionId: order.transactionId,
    paidAt: order.paidAt,
    expiresAt: order.expiresAt,
    createdAt: order.createdAt,
  };
}

/**
 * Process payment for an order using Redis distributed lock to prevent duplicates.
 * Requirements: 16.4
 */
export async function processPayment(orderId: string): Promise<PaymentResult> {
  const lockKey = paymentLockKey(orderId);

  // Acquire distributed lock
  const lockAcquired = await redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
  if (!lockAcquired) {
    throw new TRPCError({ code: 'CONFLICT', message: '支付正在处理中，请勿重复提交' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
    }

    if (order.paymentStatus === 'PAID') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '订单已支付' });
    }

    if (order.paymentStatus === 'EXPIRED') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '订单已过期' });
    }

    // Check if order has expired by time
    const now = new Date();
    if (now > order.expiresAt) {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'EXPIRED' },
      });
      throw new TRPCError({ code: 'BAD_REQUEST', message: '订单已过期' });
    }

    const transactionId = generateTransactionId();
    const paidAt = new Date();

    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: 'PAID',
        transactionId,
        paidAt,
      },
    });

    return {
      success: true,
      orderId,
      transactionId,
      paidAt,
      message: '支付成功',
    };
  } finally {
    // Release lock
    await redis.del(lockKey);
  }
}

/**
 * Process a refund for a paid order.
 * Requirements: 16.6
 */
export async function refund(orderId: string, reason: string): Promise<RefundResult> {
  if (!reason || reason.trim().length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '退款原因不能为空' });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
  }

  if (order.paymentStatus !== 'PAID') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已支付的订单才能退款' });
  }

  const refundedAt = new Date();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'REFUNDED',
      refundedAt,
      refundReason: reason,
    },
  });

  return {
    success: true,
    orderId,
    refundedAt,
    reason,
    message: '退款处理成功',
  };
}

/**
 * Generate an invoice for a paid order.
 * Requirements: 16.5
 */
export async function generateInvoice(
  orderId: string,
  format: 'CN_VAT' | 'TH_TAX',
): Promise<Invoice> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '订单不存在' });
  }

  if (order.paymentStatus !== 'PAID') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '只有已支付的订单才能开具发票' });
  }

  const invoiceNumber = generateInvoiceNumber(format);
  const issuedAt = new Date();

  const taxDetails: Record<string, string> =
    format === 'CN_VAT'
      ? {
          taxType: '增值税电子普通发票',
          taxRate: '6%',
          taxAuthority: '中华人民共和国国家税务总局',
        }
      : {
          taxType: 'ใบกำกับภาษี',
          taxRate: '7%',
          taxAuthority: 'กรมสรรพากร',
        };

  const invoiceUrl = `/invoices/${invoiceNumber}.pdf`;

  // Store invoice URL on the order
  await prisma.order.update({
    where: { id: orderId },
    data: { invoiceUrl },
  });

  return {
    orderId,
    invoiceNumber,
    format,
    orderNumber: order.orderNumber,
    amount: Number(order.amount),
    currency: order.currency,
    productType: order.productType,
    issuedAt,
    buyerInfo: { userId: order.userId },
    taxDetails,
    url: invoiceUrl,
  };
}

/**
 * Expire pending orders that have passed their expiresAt time.
 * Returns the number of orders expired.
 */
export async function expirePendingOrders(): Promise<number> {
  const now = new Date();

  const result = await prisma.order.updateMany({
    where: {
      paymentStatus: 'PENDING',
      expiresAt: { lt: now },
    },
    data: { paymentStatus: 'EXPIRED' },
  });

  return result.count;
}
