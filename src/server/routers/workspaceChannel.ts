import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { prisma } from '@/lib/prisma';
import { ChannelMessageType } from '@prisma/client';

export const workspaceChannelRouter = createTRPCRouter({
  /**
   * 发送消息（消息永久保存，不可删除）
   */
  sendMessage: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        content: z.string().min(1),
        messageType: z.nativeEnum(ChannelMessageType).default(ChannelMessageType.TEXT),
        s3Key: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      // 验证案件归属（律师或案件客户均可发送）
      const case_ = await prisma.case.findFirst({
        where: {
          id: input.caseId,
          OR: [
            { workspaceId: ws.id },
            { clientId: ctx.userId },
          ],
        },
        include: { channel: true },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      // 确保频道存在
      let channel = case_.channel;
      if (!channel) {
        channel = await prisma.channel.create({ data: { caseId: input.caseId } });
      }

      const message = await prisma.channelMessage.create({
        data: {
          channelId: channel.id,
          senderId: ctx.userId,
          messageType: input.messageType,
          content: input.content,
          s3Key: input.s3Key,
          metadata: input.metadata as any,
        },
      });

      // 追加时间线（仅律师发布进展时）
      if (input.messageType === ChannelMessageType.STAGE_UPDATE) {
        await prisma.caseTimelineEvent.create({
          data: {
            caseId: input.caseId,
            eventType: 'STAGE_UPDATE',
            description: `律师发布进展：${input.content.slice(0, 80)}`,
            operatorId: ctx.userId,
          },
        });
      }

      return message;
    }),

  /**
   * 获取消息列表
   */
  listMessages: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        cursor: z.string().optional(), // 消息 ID，用于分页
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      // 律师或案件客户均可查看
      const case_ = await prisma.case.findFirst({
        where: {
          id: input.caseId,
          OR: [
            { workspaceId: ws.id },
            { clientId: ctx.userId },
          ],
        },
        include: { channel: true },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });
      if (!case_.channel) return { messages: [], nextCursor: null };

      const messages = await prisma.channelMessage.findMany({
        where: {
          channelId: case_.channel.id,
          ...(input.cursor ? { id: { lt: input.cursor } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
      });

      const hasMore = messages.length > input.limit;
      const items = hasMore ? messages.slice(0, input.limit) : messages;

      return {
        messages: items.reverse(),
        nextCursor: hasMore ? items[0]?.id ?? null : null,
      };
    }),
});
