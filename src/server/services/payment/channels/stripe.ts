/**
 * Stripe adapter (international credit cards).
 * Abstracted implementation — swap with real stripe SDK in production.
 * Requirements: 16.3, 16.8
 */

import type {
  PaymentChannel,
  PaymentOrderInfo,
  PaymentInitResult,
  CallbackVerification,
  RefundResult,
} from './types';
import { generateHmacSignature, verifyHmacSignature } from './types';

const STRIPE_CONFIG = {
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
};

export class StripeChannel implements PaymentChannel {
  readonly channelName = 'STRIPE' as const;

  async initiatePayment(order: PaymentOrderInfo): Promise<PaymentInitResult> {
    // In production: call Stripe Checkout Session or PaymentIntent API
    // https://stripe.com/docs/api/checkout/sessions/create
    const amountInCents = Math.round(order.amount * 100);

    return {
      success: true,
      channel: 'STRIPE',
      paymentUrl: `https://checkout.stripe.com/pay/cs_${order.orderId}`,
      paymentData: {
        publishableKey: STRIPE_CONFIG.publishableKey,
        sessionId: `cs_${order.orderId}_${Date.now()}`,
        amount: String(amountInCents),
        currency: order.currency.toLowerCase(),
      },
      channelTransactionId: `pi_${order.orderId}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      message: 'Stripe payment session created',
    };
  }

  async verifyCallback(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<CallbackVerification> {
    // In production: use stripe.webhooks.constructEvent(body, sig, webhookSecret)
    const event = payload as Record<string, any>;
    const paymentIntent = event.data?.object ?? {};

    const signPayload = JSON.stringify(payload);
    const verified = verifyHmacSignature(signPayload, signature, STRIPE_CONFIG.webhookSecret);

    const metadata = paymentIntent.metadata ?? {};

    return {
      verified,
      channel: 'STRIPE',
      orderId: metadata.orderId ?? '',
      channelTransactionId: paymentIntent.id ?? '',
      amount: (paymentIntent.amount ?? 0) / 100,
      currency: (paymentIntent.currency ?? 'usd').toUpperCase(),
      paidAt: new Date(),
      rawPayload: payload,
      message: verified ? 'Stripe webhook verified' : 'Stripe webhook signature verification failed',
    };
  }

  async processRefund(transactionId: string, amount: number): Promise<RefundResult> {
    // In production: call Stripe Refund API
    return {
      success: true,
      channel: 'STRIPE',
      refundId: `re_${transactionId}_${Date.now()}`,
      amount,
      message: 'Stripe refund initiated',
    };
  }
}
