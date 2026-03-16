/**
 * PromptPay adapter (Thailand).
 * Abstracted implementation — swap with real PromptPay/Thai bank SDK in production.
 * Requirements: 16.2, 16.8
 */

import type {
  PaymentChannel,
  PaymentOrderInfo,
  PaymentInitResult,
  CallbackVerification,
  RefundResult,
} from './types';
import { generateHmacSignature, verifyHmacSignature } from './types';

const PROMPTPAY_CONFIG = {
  merchantId: process.env.PROMPTPAY_MERCHANT_ID ?? '',
  apiKey: process.env.PROMPTPAY_API_KEY ?? '',
};

export class PromptPayChannel implements PaymentChannel {
  readonly channelName = 'PROMPTPAY' as const;

  async initiatePayment(order: PaymentOrderInfo): Promise<PaymentInitResult> {
    // In production: call PromptPay QR generation API
    // Generate a PromptPay QR code payload
    const qrPayload = `promptpay://${PROMPTPAY_CONFIG.merchantId}/${order.amount}/${order.orderNumber}`;

    return {
      success: true,
      channel: 'PROMPTPAY',
      paymentUrl: `https://promptpay.io/${PROMPTPAY_CONFIG.merchantId}?amount=${order.amount}`,
      paymentData: {
        merchantId: PROMPTPAY_CONFIG.merchantId,
        qrPayload,
        amount: String(order.amount),
        currency: 'THB',
        reference: order.orderNumber,
      },
      channelTransactionId: `pp_${order.orderId}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      message: 'PromptPay QR code generated',
    };
  }

  async verifyCallback(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<CallbackVerification> {
    const { reference, transaction_id, amount, paid_at } = payload as Record<string, string>;

    const signPayload = JSON.stringify(payload);
    const verified = verifyHmacSignature(signPayload, signature, PROMPTPAY_CONFIG.apiKey);

    return {
      verified,
      channel: 'PROMPTPAY',
      orderId: reference ?? '',
      channelTransactionId: transaction_id ?? '',
      amount: Number(amount ?? 0),
      currency: 'THB',
      paidAt: paid_at ? new Date(paid_at) : new Date(),
      rawPayload: payload,
      message: verified ? 'PromptPay callback verified' : 'PromptPay callback signature verification failed',
    };
  }

  async processRefund(transactionId: string, amount: number): Promise<RefundResult> {
    // In production: call Thai bank refund/reversal API
    return {
      success: true,
      channel: 'PROMPTPAY',
      refundId: `pp_refund_${transactionId}_${Date.now()}`,
      amount,
      message: 'PromptPay refund initiated',
    };
  }
}
