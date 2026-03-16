import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '@/server/trpc';
import {
  getProfile,
  updateProfile,
  getEnterprise,
  upsertEnterprise,
} from '@/server/services/user/profile';

export const userRouter = createTRPCRouter({
  // Get current user's profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    return getProfile(ctx.userId);
  }),

  // Update current user's profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, '姓名不能为空').max(100).optional(),
        phone: z.string().min(8, '请输入有效的手机号').max(20).optional(),
        avatar: z.string().url('请输入有效的头像 URL').optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return updateProfile(ctx.userId, input);
    }),

  // Get current user's enterprise info
  getEnterprise: protectedProcedure.query(async ({ ctx }) => {
    return getEnterprise(ctx.userId);
  }),

  // Create or update enterprise info
  upsertEnterprise: protectedProcedure
    .input(
      z.object({
        companyName: z.string().min(1, '公司名称不能为空').max(200),
        businessLicense: z.string().max(100).optional(),
        contactAddress: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return upsertEnterprise(ctx.userId, input);
    }),
});
