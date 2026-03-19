import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { requireActiveWorkspace } from './workspace';
import { checkConflict } from '../services/workspace/conflictService';
import { prisma } from '@/lib/prisma';
import { CaseStatus } from '@prisma/client';

const caseInputSchema = z.object({
  caseNumber: z.string().min(1),
  title: z.string().min(1),
  caseType: z.string().min(1),
  clientName: z.string().min(1),
  clientId: z.string().optional(),
  opposingParty: z.string().optional(),
  filedAt: z.string().datetime(),
});

export const workspaceCaseRouter = createTRPCRouter({
  /**
   * 创建案件（含冲突检查）
   */
  createCase: protectedProcedure
    .input(caseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      requireActiveWorkspace(ws);

      // 冲突检查
      let conflictResult = null;
      if (input.opposingParty) {
        conflictResult = await checkConflict(ws.id, input.opposingParty);
      }

      const newCase = await prisma.case.create({
        data: {
          workspaceId: ws.id,
          caseNumber: input.caseNumber,
          title: input.title,
          caseType: input.caseType,
          clientName: input.clientName,
          clientId: input.clientId,
          opposingParty: input.opposingParty,
          filedAt: new Date(input.filedAt),
          status: CaseStatus.OPEN,
        },
      });

      // 创建时间线事件
      await prisma.caseTimelineEvent.create({
        data: {
          caseId: newCase.id,
          eventType: 'CASE_CREATED',
          description: `案件「${newCase.title}」已创建`,
          operatorId: ctx.userId,
        },
      });

      // 自动创建沟通频道
      await prisma.channel.create({
        data: { caseId: newCase.id },
      });

      return { case: newCase, conflictResult };
    }),

  /**
   * 更新案件
   */
  updateCase: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        title: z.string().optional(),
        caseType: z.string().optional(),
        status: z.nativeEnum(CaseStatus).optional(),
        opposingParty: z.string().optional(),
        closedAt: z.string().datetime().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      requireActiveWorkspace(ws);

      const existing = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND' });

      const { caseId, ...updateData } = input;
      const updated = await prisma.case.update({
        where: { id: caseId },
        data: {
          title: updateData.title,
          caseType: updateData.caseType,
          status: updateData.status,
          opposingParty: updateData.opposingParty,
          closedAt: updateData.closedAt ? new Date(updateData.closedAt) : undefined,
        },
      });

      // 状态变更时追加时间线
      if (updateData.status && updateData.status !== existing.status) {
        await prisma.caseTimelineEvent.create({
          data: {
            caseId,
            eventType: 'STATUS_CHANGED',
            description: `案件状态从 ${existing.status} 变更为 ${updateData.status}`,
            operatorId: ctx.userId,
            metadata: { from: existing.status, to: updateData.status },
          },
        });
      }

      return updated;
    }),

  /**
   * 获取案件详情
   */
  getCaseById: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
        include: {
          timeline: { orderBy: { occurredAt: 'desc' }, take: 20 },
          deadlines: { where: { isHandled: false }, orderBy: { dueDate: 'asc' } },
          visitRecords: { orderBy: { visitedAt: 'desc' }, take: 1 },
        },
      });

      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });
      return case_;
    }),

  /**
   * 案件列表
   */
  listCases: protectedProcedure
    .input(
      z.object({
        status: z.nativeEnum(CaseStatus).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
      }).default({}),
    )
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const where = {
        workspaceId: ws.id,
        ...(input.status ? { status: input.status } : {}),
      };

      const [cases, total] = await Promise.all([
        prisma.case.findMany({
          where,
          include: {
            deadlines: {
              where: { isHandled: false },
              orderBy: { dueDate: 'asc' },
              take: 1,
            },
            visitRecords: { orderBy: { visitedAt: 'desc' }, take: 1 },
          },
          orderBy: { updatedAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        prisma.case.count({ where }),
      ]);

      return { cases, total, page: input.page, pageSize: input.pageSize };
    }),

  /**
   * 案件时间线
   */
  getCaseTimeline: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.caseTimelineEvent.findMany({
        where: { caseId: input.caseId },
        orderBy: { occurredAt: 'desc' },
      });
    }),

  /**
   * 冲突检查（新建案件前调用）
   */
  checkConflict: protectedProcedure
    .input(z.object({ opposingParty: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      return checkConflict(ws.id, input.opposingParty);
    }),

  /**
   * AI 智能推荐案由（根据案件描述）
   */
  suggestCaseType: protectedProcedure
    .input(z.object({ description: z.string().min(5) }))
    .mutation(async ({ input }) => {
      const { getLLMGateway } = await import('../services/llm/gateway');
      const gateway = getLLMGateway();

      const prompt = `你是一位中国法律专家。根据以下案件描述，判断案件类别和具体案由。

案件描述：${input.description}

请从以下选项中选择最匹配的：

案件类别（category）：
- civil（民事）
- criminal（刑事）
- family（家事）
- administrative（行政）
- crossborder（涉外/跨境）

具体案由（caseType），根据类别选择：
- civil: 合同纠纷、侵权纠纷、劳动争议、知识产权、房产纠纷、债权债务、公司股权、其他民事
- criminal: 刑事辩护、刑事附带民事、取保候审、申诉再审、其他刑事
- family: 离婚纠纷、财产分割、子女抚养、继承纠纷、收养纠纷、其他家事
- administrative: 行政诉讼、行政复议、行政赔偿、其他行政
- crossborder: 中泰跨境合同、外籍人员劳动、签证移民、跨境投资、国际贸易、其他涉外

只返回 JSON，格式：{"category": "...", "caseType": "..."}`;

      const response = await gateway.chat(
        [{ role: 'user', content: prompt }],
        { provider: 'glm', model: 'glm-4-flash-250414', temperature: 0.1, maxTokens: 100 },
      );

      try {
        const match = response.content.match(/\{[\s\S]*\}/);
        if (!match) return { category: 'civil', caseType: '其他民事' };
        return JSON.parse(match[0]) as { category: string; caseType: string };
      } catch {
        return { category: 'civil', caseType: '其他民事' };
      }
    }),
});
