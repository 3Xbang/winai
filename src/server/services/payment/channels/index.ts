/**
 * Payment channel registry/factory.
 * Provides a unified way to get the correct payment channel adapter.
 * Requirements: 16.1, 16.2, 16.3
 */

import type { PaymentChannel, PaymentMethod } from './types';
import { WeChatPayChannel } from './wechat';
import { AlipayChannel } from './alipay';
import { StripeChannel } from './stripe';
import { PromptPayChannel } from './promptpay';

const channelInstances: Record<PaymentMethod, PaymentChannel> = {
  WECHAT: new WeChatPayChannel(),
  ALIPAY: new AlipayChannel(),
  STRIPE: new StripeChannel(),
  PROMPTPAY: new PromptPayChannel(),
};

/**
 * Get a payment channel adapter by method name.
 * Throws if the method is not supported.
 */
export function getPaymentChannel(method: PaymentMethod): PaymentChannel {
  const channel = channelInstances[method];
  if (!channel) {
    throw new Error(`Unsupported payment method: ${method}`);
  }
  return channel;
}

/**
 * Resolve the payment channel from a callback request path or header.
 * Maps common path segments / header values to PaymentMethod.
 */
export function resolveChannelFromRequest(channelId: string): PaymentMethod | null {
  const mapping: Record<string, PaymentMethod> = {
    wechat: 'WECHAT',
    alipay: 'ALIPAY',
    stripe: 'STRIPE',
    promptpay: 'PROMPTPAY',
  };
  return mapping[channelId.toLowerCase()] ?? null;
}

/** List all supported payment methods */
export function getSupportedMethods(): PaymentMethod[] {
  return Object.keys(channelInstances) as PaymentMethod[];
}

// Re-export types and utilities
export type { PaymentChannel, PaymentMethod } from './types';
export type { PaymentOrderInfo, PaymentInitResult, CallbackVerification, RefundResult } from './types';
export { encryptPaymentData, decryptPaymentData } from './types';
