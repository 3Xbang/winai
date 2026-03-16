import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '@/server/trpc';
import {
  sendEmailVerificationCode,
  registerWithEmail,
  sendPhoneVerificationCode,
  registerWithPhone,
  sendPasswordResetCode,
  resetPassword,
  checkAccountLock,
} from '@/server/services/auth/registration';

const passwordSchema = z
  .string()
  .min(8, '密码至少8个字符')
  .max(128, '密码最多128个字符');

export const authRouter = createTRPCRouter({
  // Send email verification code for registration
  sendEmailCode: publicProcedure
    .input(z.object({ email: z.string().email('请输入有效的邮箱地址') }))
    .mutation(async ({ input }) => {
      await sendEmailVerificationCode(input.email);
      return { success: true, message: '验证码已发送至邮箱' };
    }),

  // Register with email
  registerEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email('请输入有效的邮箱地址'),
        code: z.string().length(6, '验证码为6位数字'),
        password: passwordSchema,
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return registerWithEmail(input.email, input.code, input.password, input.name);
    }),

  // Send phone verification code for registration
  sendPhoneCode: publicProcedure
    .input(z.object({ phone: z.string().min(8, '请输入有效的手机号') }))
    .mutation(async ({ input }) => {
      await sendPhoneVerificationCode(input.phone);
      return { success: true, message: '验证码已发送至手机' };
    }),

  // Register with phone
  registerPhone: publicProcedure
    .input(
      z.object({
        phone: z.string().min(8, '请输入有效的手机号'),
        code: z.string().length(6, '验证码为6位数字'),
        password: passwordSchema.optional(),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      return registerWithPhone(input.phone, input.code, input.password, input.name);
    }),

  // Send password reset code
  sendResetCode: publicProcedure
    .input(
      z.object({
        identifier: z.string().min(1),
        type: z.enum(['email', 'phone']),
      }),
    )
    .mutation(async ({ input }) => {
      await sendPasswordResetCode(input.identifier, input.type);
      return { success: true, message: '重置验证码已发送' };
    }),

  // Reset password
  resetPassword: publicProcedure
    .input(
      z.object({
        identifier: z.string().min(1),
        type: z.enum(['email', 'phone']),
        code: z.string().length(6, '验证码为6位数字'),
        newPassword: passwordSchema,
      }),
    )
    .mutation(async ({ input }) => {
      return resetPassword(
        input.identifier,
        input.type,
        input.code,
        input.newPassword,
      );
    }),

  // Check account lock status
  checkLock: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return checkAccountLock(input.userId);
    }),
});
