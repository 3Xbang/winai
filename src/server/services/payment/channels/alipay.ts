/**
 * Alipay adapter.
 * Abstracted implementation — swap with real alipay-sdk in production.
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

const ALIPAY_CONFIG = {
  appId: process.env.ALIPAY_APP_ID ?? '',
  privateKey: process.env.ALIPAY_PRIVATE_KEY ?? '',
  publicKey: process.env.ALIPAY_PUBLIC_KEY ?? '',
  notifyUrl: process.env.ALIPAY_NOTIFY_URL ?? '',
};

export class AlipayChannel implements PaymentChannel {
  readonly channelName = 'ALIPAY' as const;

  async initiatePayment(order: PaymentOrderInfo): Promise<PaymentInitResult> {
    // In production: call Alipay Trade Create / Trade Page Pay API
    // https://opendocs.alipay.com/open/028r8t
    const timestamp = new Date().toISOString();
    const signPayload = `${ALIPAY_CONFIG.appId}\n${order.orderNumber}\n${order.amount}\n${timestamp}`;
    const sign = generateHmacSignature(signPayload, ALIPAY_CONFIG.privateKey);

    return {
      success: true,
      channel: 'ALIPAY',
      paymentUrl: `https://openapi.alipay.com/gateway.do?out_trade_no=${order.orderNumber}&total_amount=${order.amount}`,
      paymentData: {
        appId: ALIPAY_CONFIG.appId,
        outTradeNo: order.orderNumber,
        totalAmount: String(order.amount),
        sign,
        timestamp,
      },
      channelTransactionId: `ali_${order.orderId}_${Date.now()}`,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      message: '支付宝订单创建成功',
    };
  }

  async verifyCallback(
    payload: Record<string, unknown>,
    signature: string,
  ): Promise<CallbackVerification> {
    const { out_trade_no, trade_no, total_amount, gmt_payment } = payload as Record<string, string>;

    const signPayload = JSON.stringify(payload);
    const verified = verifyHmacSignature(signPayload, signature, ALIPAY_CONFIG.publicKey);

    return {
      verified,
      channel: 'ALIPAY',
      orderId: out_trade_no ?? '',
      channelTransactionId: trade_no ?? '',
      amount: Number(total_amount ?? 0),
      currency: 'CNY',
      paidAt: gmt_payment ? new Date(gmt_payment) : new Date(),
      rawPayload: payload,
      message: verified ? '支付宝回调验证成功' : '支付宝回调签名验证失败',
    };
  }

  async processRefund(transactionId: string, amount: number): Promise<RefundResult> {
    // In production: call Alipay Trade Refund API
    return {
      success: true,
      channel: 'ALIPAY',
      refundId: `ali_refund_${transactionId}_${Date.now()}`,
      amount,
      message: '支付宝退款申请已提交',
    };
  }
}
