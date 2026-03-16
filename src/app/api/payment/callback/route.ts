/**
 * Unified payment callback handler (Next.js API route).
 * Handles POST requests from all payment channels.
 * Requirements: 16.1, 16.2, 16.3, 16.8
 *
 * Usage: POST /api/payment/callback?channel=wechat|alipay|stripe|promptpay
 * Headers: x-payment-signature — HMAC signature from the channel
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getPaymentChannel, resolveChannelFromRequest } from '@/server/services/payment/channels';

export async function POST(request: NextRequest) {
  try {
    // 1. Identify the payment channel from query param or header
    const channelParam =
      request.nextUrl.searchParams.get('channel') ??
      request.headers.get('x-payment-channel') ??
      '';

    const method = resolveChannelFromRequest(channelParam);
    if (!method) {
      return NextResponse.json(
        { success: false, message: `Unknown payment channel: ${channelParam}` },
        { status: 400 },
      );
    }

    // 2. Parse the request body
    const payload = (await request.json()) as Record<string, unknown>;
    const signature = request.headers.get('x-payment-signature') ?? '';

    // 3. Get the channel adapter and verify the callback
    const channel = getPaymentChannel(method);
    const verification = await channel.verifyCallback(payload, signature);

    if (!verification.verified) {
      return NextResponse.json(
        { success: false, message: verification.message },
        { status: 403 },
      );
    }

    // 4. Update the order in the database
    const order = await prisma.order.findFirst({
      where: { orderNumber: verification.orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, message: `Order not found: ${verification.orderId}` },
        { status: 404 },
      );
    }

    if (order.paymentStatus === 'PAID') {
      // Idempotent — already processed
      return NextResponse.json({ success: true, message: 'Order already paid' });
    }

    if (order.paymentStatus !== 'PENDING') {
      return NextResponse.json(
        { success: false, message: `Order is in non-payable status: ${order.paymentStatus}` },
        { status: 400 },
      );
    }

    // 5. Mark order as paid
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        transactionId: verification.channelTransactionId,
        paidAt: verification.paidAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment callback processed successfully',
      orderId: order.id,
      transactionId: verification.channelTransactionId,
    });
  } catch (error: any) {
    console.error('Payment callback error:', error);
    return NextResponse.json(
      { success: false, message: error.message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
