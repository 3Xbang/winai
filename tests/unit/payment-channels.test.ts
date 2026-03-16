import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== Tests for payment channel types & utilities ====================

import {
  encryptPaymentData,
  decryptPaymentData,
  generateHmacSignature,
  verifyHmacSignature,
} from '@/server/services/payment/channels/types';

describe('Payment encryption utilities', () => {
  const key = 'test-encryption-key-for-payment-data';

  it('should encrypt and decrypt data round-trip', () => {
    const plaintext = '{"cardNumber":"4242424242424242","cvv":"123"}';
    const encrypted = encryptPaymentData(plaintext, key);
    const decrypted = decryptPaymentData(encrypted, key);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for same plaintext (random IV)', () => {
    const plaintext = 'sensitive-data';
    const enc1 = encryptPaymentData(plaintext, key);
    const enc2 = encryptPaymentData(plaintext, key);
    expect(enc1).not.toBe(enc2);
    // Both should decrypt to the same value
    expect(decryptPaymentData(enc1, key)).toBe(plaintext);
    expect(decryptPaymentData(enc2, key)).toBe(plaintext);
  });

  it('should fail decryption with wrong key', () => {
    const encrypted = encryptPaymentData('secret', key);
    expect(() => decryptPaymentData(encrypted, 'wrong-key')).toThrow();
  });

  it('should throw on invalid encrypted data format', () => {
    expect(() => decryptPaymentData('invalid-data', key)).toThrow('Invalid encrypted data format');
  });
});

describe('HMAC signature utilities', () => {
  const secret = 'webhook-secret-key';

  it('should generate and verify a valid signature', () => {
    const payload = '{"orderId":"123","amount":100}';
    const sig = generateHmacSignature(payload, secret);
    expect(verifyHmacSignature(payload, sig, secret)).toBe(true);
  });

  it('should reject tampered payload', () => {
    const payload = '{"orderId":"123","amount":100}';
    const sig = generateHmacSignature(payload, secret);
    expect(verifyHmacSignature(payload + 'x', sig, secret)).toBe(false);
  });

  it('should reject wrong secret', () => {
    const payload = '{"orderId":"123"}';
    const sig = generateHmacSignature(payload, secret);
    expect(verifyHmacSignature(payload, sig, 'wrong-secret')).toBe(false);
  });
});

// ==================== Tests for channel registry ====================

import {
  getPaymentChannel,
  resolveChannelFromRequest,
  getSupportedMethods,
} from '@/server/services/payment/channels';

describe('Payment channel registry', () => {
  it('should return all four supported methods', () => {
    const methods = getSupportedMethods();
    expect(methods).toContain('WECHAT');
    expect(methods).toContain('ALIPAY');
    expect(methods).toContain('STRIPE');
    expect(methods).toContain('PROMPTPAY');
    expect(methods).toHaveLength(4);
  });

  it('should return correct channel adapter for each method', () => {
    expect(getPaymentChannel('WECHAT').channelName).toBe('WECHAT');
    expect(getPaymentChannel('ALIPAY').channelName).toBe('ALIPAY');
    expect(getPaymentChannel('STRIPE').channelName).toBe('STRIPE');
    expect(getPaymentChannel('PROMPTPAY').channelName).toBe('PROMPTPAY');
  });

  it('should throw for unsupported method', () => {
    expect(() => getPaymentChannel('BITCOIN' as any)).toThrow('Unsupported payment method');
  });

  it('should resolve channel from request identifiers', () => {
    expect(resolveChannelFromRequest('wechat')).toBe('WECHAT');
    expect(resolveChannelFromRequest('ALIPAY')).toBe('ALIPAY');
    expect(resolveChannelFromRequest('Stripe')).toBe('STRIPE');
    expect(resolveChannelFromRequest('promptpay')).toBe('PROMPTPAY');
    expect(resolveChannelFromRequest('unknown')).toBeNull();
  });
});

// ==================== Tests for individual channel adapters ====================

import { WeChatPayChannel } from '@/server/services/payment/channels/wechat';
import { AlipayChannel } from '@/server/services/payment/channels/alipay';
import { StripeChannel } from '@/server/services/payment/channels/stripe';
import { PromptPayChannel } from '@/server/services/payment/channels/promptpay';

const sampleOrder = {
  orderId: 'order-123',
  orderNumber: 'ORD-TEST-001',
  amount: 299.99,
  currency: 'CNY' as const,
  productType: 'SUBSCRIPTION',
  productId: 'plan-std',
  userId: 'user-1',
  description: 'Standard plan subscription',
};

describe('WeChatPayChannel', () => {
  const channel = new WeChatPayChannel();

  it('should have correct channel name', () => {
    expect(channel.channelName).toBe('WECHAT');
  });

  it('should initiate payment successfully', async () => {
    const result = await channel.initiatePayment(sampleOrder);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('WECHAT');
    expect(result.paymentUrl).toBeDefined();
    expect(result.paymentData).toBeDefined();
    expect(result.paymentData!.appId).toBeDefined();
    expect(result.paymentData!.prepayId).toContain(sampleOrder.orderId);
    expect(result.channelTransactionId).toContain('wx_');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.message).toContain('微信');
  });

  it('should verify callback with valid signature', async () => {
    const payload = {
      out_trade_no: 'ORD-TEST-001',
      transaction_id: 'wx_txn_123',
      total_fee: '29999',
      fee_type: 'CNY',
      time_end: new Date().toISOString(),
    };
    const sig = generateHmacSignature(JSON.stringify(payload), process.env.WECHAT_PAY_API_KEY ?? '');
    const result = await channel.verifyCallback(payload, sig);
    expect(result.verified).toBe(true);
    expect(result.channel).toBe('WECHAT');
    expect(result.orderId).toBe('ORD-TEST-001');
  });

  it('should reject callback with invalid signature', async () => {
    const payload = { out_trade_no: 'ORD-TEST-001', total_fee: '100' };
    const result = await channel.verifyCallback(payload, 'invalid-sig');
    expect(result.verified).toBe(false);
  });

  it('should process refund', async () => {
    const result = await channel.processRefund('wx_txn_123', 100);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('WECHAT');
    expect(result.refundId).toContain('wx_refund_');
    expect(result.amount).toBe(100);
  });
});

describe('AlipayChannel', () => {
  const channel = new AlipayChannel();

  it('should have correct channel name', () => {
    expect(channel.channelName).toBe('ALIPAY');
  });

  it('should initiate payment successfully', async () => {
    const result = await channel.initiatePayment(sampleOrder);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('ALIPAY');
    expect(result.paymentUrl).toContain('alipay.com');
    expect(result.paymentData!.outTradeNo).toBe(sampleOrder.orderNumber);
    expect(result.channelTransactionId).toContain('ali_');
  });

  it('should verify callback with valid signature', async () => {
    const payload = {
      out_trade_no: 'ORD-TEST-001',
      trade_no: 'ali_txn_456',
      total_amount: '299.99',
      gmt_payment: new Date().toISOString(),
    };
    const sig = generateHmacSignature(JSON.stringify(payload), process.env.ALIPAY_PUBLIC_KEY ?? '');
    const result = await channel.verifyCallback(payload, sig);
    expect(result.verified).toBe(true);
    expect(result.channel).toBe('ALIPAY');
    expect(result.orderId).toBe('ORD-TEST-001');
    expect(result.currency).toBe('CNY');
  });

  it('should process refund', async () => {
    const result = await channel.processRefund('ali_txn_456', 50);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('ALIPAY');
    expect(result.refundId).toContain('ali_refund_');
  });
});

describe('StripeChannel', () => {
  const channel = new StripeChannel();

  it('should have correct channel name', () => {
    expect(channel.channelName).toBe('STRIPE');
  });

  it('should initiate payment with amount in cents', async () => {
    const usdOrder = { ...sampleOrder, currency: 'USD' as const, amount: 29.99 };
    const result = await channel.initiatePayment(usdOrder);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('STRIPE');
    expect(result.paymentUrl).toContain('checkout.stripe.com');
    expect(result.paymentData!.amount).toBe('2999'); // cents
    expect(result.paymentData!.currency).toBe('usd');
    expect(result.channelTransactionId).toContain('pi_');
  });

  it('should verify webhook with valid signature', async () => {
    const payload = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 2999,
          currency: 'usd',
          metadata: { orderId: 'ORD-TEST-001' },
        },
      },
    };
    const sig = generateHmacSignature(JSON.stringify(payload), process.env.STRIPE_WEBHOOK_SECRET ?? '');
    const result = await channel.verifyCallback(payload, sig);
    expect(result.verified).toBe(true);
    expect(result.channel).toBe('STRIPE');
    expect(result.orderId).toBe('ORD-TEST-001');
    expect(result.amount).toBe(29.99);
  });

  it('should process refund', async () => {
    const result = await channel.processRefund('pi_test_123', 29.99);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('STRIPE');
    expect(result.refundId).toContain('re_');
  });
});

describe('PromptPayChannel', () => {
  const channel = new PromptPayChannel();

  it('should have correct channel name', () => {
    expect(channel.channelName).toBe('PROMPTPAY');
  });

  it('should initiate payment with QR data', async () => {
    const thbOrder = { ...sampleOrder, currency: 'THB' as const, amount: 3500 };
    const result = await channel.initiatePayment(thbOrder);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('PROMPTPAY');
    expect(result.paymentData!.qrPayload).toBeDefined();
    expect(result.paymentData!.currency).toBe('THB');
    expect(result.channelTransactionId).toContain('pp_');
  });

  it('should verify callback with valid signature', async () => {
    const payload = {
      reference: 'ORD-TEST-001',
      transaction_id: 'pp_txn_789',
      amount: '3500',
      paid_at: new Date().toISOString(),
    };
    const sig = generateHmacSignature(JSON.stringify(payload), process.env.PROMPTPAY_API_KEY ?? '');
    const result = await channel.verifyCallback(payload, sig);
    expect(result.verified).toBe(true);
    expect(result.channel).toBe('PROMPTPAY');
    expect(result.orderId).toBe('ORD-TEST-001');
    expect(result.currency).toBe('THB');
  });

  it('should process refund', async () => {
    const result = await channel.processRefund('pp_txn_789', 3500);
    expect(result.success).toBe(true);
    expect(result.channel).toBe('PROMPTPAY');
    expect(result.refundId).toContain('pp_refund_');
  });
});

// ==================== Tests for PaymentChannel interface compliance ====================

describe('All channels implement PaymentChannel interface', () => {
  const channels = [
    new WeChatPayChannel(),
    new AlipayChannel(),
    new StripeChannel(),
    new PromptPayChannel(),
  ];

  for (const channel of channels) {
    it(`${channel.channelName} has all required methods`, () => {
      expect(typeof channel.initiatePayment).toBe('function');
      expect(typeof channel.verifyCallback).toBe('function');
      expect(typeof channel.processRefund).toBe('function');
      expect(channel.channelName).toBeTruthy();
    });

    it(`${channel.channelName} initiatePayment returns correct structure`, async () => {
      const result = await channel.initiatePayment(sampleOrder);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('channel', channel.channelName);
      expect(result).toHaveProperty('message');
    });
  }
});
