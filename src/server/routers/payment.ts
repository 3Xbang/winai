import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '@/server/trpc';
import {
  createOrder,
  processPayment,
  refund,
  generateInvoice,
} from '@/server/services/payment/gateway';

export const paymentRouter = createTRPCRouter({
  createOrder: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive('金额必须大于0'),
        currency: z.enum(['CNY', 'THB', 'USD']),
        method: z.enum(['WECHAT', 'ALIPAY', 'PROMPTPAY', 'STRIPE']),
        productType: z.enum(['SUBSCRIPTION', 'SINGLE_CONSULTATION']),
        productId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return createOrder({ userId: ctx.userId, ...input });
    }),

  processPayment: protectedProcedure
    .input(z.object({ orderId: z.string().min(1, '订单ID不能为空') }))
    .mutation(async ({ input }) => {
      return processPayment(input.orderId);
    }),

  refund: adminProcedure
    .input(
      z.object({
        orderId: z.string().min(1, '订单ID不能为空'),
        reason: z.string().min(1, '退款原因不能为空'),
      }),
    )
    .mutation(async ({ input }) => {
      return refund(input.orderId, input.reason);
    }),

  generateInvoice: protectedProcedure
    .input(
      z.object({
        orderId: z.string().min(1, '订单ID不能为空'),
        format: z.enum(['CN_VAT', 'TH_TAX']),
      }),
    )
    .mutation(async ({ input }) => {
      return generateInvoice(input.orderId, input.format);
    }),
});
