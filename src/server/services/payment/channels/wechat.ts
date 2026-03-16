/**
 * WeChat Pay adapter.
 * Abstracted implementation — swap with real wechat-pay SDK in production.
 * Requirements: 16.1, 16.8
 */

import type {
  PaymentChannel,
  PaymentOrderInfo,
  PaymentInitResult,
  CallbackVerification,
  RefundResult,
} from './types';
import { generateHmacSignature, verifyHmacSignature } from './types';

const WECHAT_CONFIG = {
  appId: process.env.WECHAT_PAY_APP_ID ?? '',
  mchId: process.env.WECHAT_PAY_MCH_ID ?? '',
  apiKey: process.env.WECHAT_PAY_API_KEY ?? '',
  notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL ?? '',
};

export class WeChatPayChannel implements PaymentChannel {
  readonly channelName = 'WECHAT' as const;

  async initiatePayment(order: PaymentOrderInfo): Promise<PaymentInitResult> {
    // In production: call WeChat Unified Order API
    // https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_1_1.shtml
    const nonceStr = Math.random().toString(36).substring(2, 15);
    const signPayload = `${WECHAT_CONFIG.appId}\n${WECHAT_CONFIG.mchId}\n${order.orderNumber}\n${order.amount}\n${nonceStr}`;
    const sign = generateHmacSignature(signPayload, WECHAT_CONFIG.apiKey);

    return {
      success: true,
      channel: 'WECHAT',
      paymentUrl: `weixin://wxpay/bizpayurl?pr=${order.orderNumber}`,
      paymentData: {
        appId: WECHAT_CONFIG.appId,
        mchId: WECHAT_CONFIG.mchId,
        nonceStr,
        prepayId: `wx_prepay_${order.orderId}`,
        sign,
      },
      channelTransactionId: `wx_${order.orderId}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      message: '微信支付订单创建成功',
    };
  }

  async verifyCallback(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<CallbackVerification> {
    const { out_trade_no, transaction_id, total_fee, fee_type, time_end } = payload as Record<string, string>;

    // Verify signature using HMAC
    const signPayload = JSON.stringify(payload);
    const verified = verifyHmacSignature(signPayload, signature, WECHAT_CONFIG.apiKey);

    return {
      verified,
      channel: 'WECHAT',
      orderId: out_trade_no ?? '',
      channelTransactionId: transaction_id ?? '',
      amount: Number(total_fee ?? 0) / 100, // WeChat uses fen (cents)
      currency: fee_type ?? 'CNY',
      paidAt: time_end ? new Date(time_end) : new Date(),
      rawPayload: payload,
      message: verified ? '微信支付回调验证成功' : '微信支付回调签名验证失败',
    };
  }

  async processRefund(transactionId: string, amount: number): Promise<RefundResult> {
    // In production: call WeChat Refund API
    return {
      success: true,
      channel: 'WECHAT',
      refundId: `wx_refund_${transactionId}_${Date.now()}`,
      amount,
      message: '微信退款申请已提交',
    };
  }
}
