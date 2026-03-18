import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { evidenceService } from '../services/workspace/evidenceService';
import { storageService } from '../services/workspace/storageService';
import { prisma } from '@/lib/prisma';
import { AuditAction } from '@prisma/client';

export const workspaceEvidenceRouter = createTRPCRouter({
  /**
   * 上传证据（接收 base64 编码的文件内容）
   */
  upload: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileBase64: z.string(), // base64 编码
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const fileBuffer = Buffer.from(input.fileBase64, 'base64');
      return evidenceService.uploadEvidence({
        lawyerId: ctx.userId,
        caseId: input.caseId,
        fileName: input.fileName,
        fileBuffer,
        mimeType: input.mimeType,
        description: input.description,
      });
    }),

  /**
   * 获取证据列表
   */
  list: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      return evidenceService.listEvidences(input.caseId, ws.id);
    }),

  /**
   * 获取证据预签名下载 URL
   */
  getDownloadUrl: protectedProcedure
    .input(z.object({ evidenceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const evidence = await prisma.evidence.findFirst({
        where: { id: input.evidenceId, case: { workspaceId: ws.id } },
      });
      if (!evidence) throw new TRPCError({ code: 'NOT_FOUND' });

      // 写入审计日志
      await prisma.workspaceAuditLog.create({
        data: {
          workspaceId: ws.id,
          operatorId: ctx.userId,
          action: AuditAction.DOWNLOAD,
          resourceType: 'EVIDENCE',
          evidenceId: evidence.id,
          s3Key: evidence.s3Key,
        },
      });

      return storageService.getPresignedUrl(evidence.s3Key, ctx.userId);
    }),

  /**
   * 删除证据
   */
  delete: protectedProcedure
    .input(z.object({ evidenceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);

      const evidence = await prisma.evidence.findFirst({
        where: { id: input.evidenceId, case: { workspaceId: ws.id } },
      });
      if (!evidence) throw new TRPCError({ code: 'NOT_FOUND' });

      await storageService.delete(evidence.s3Key, ctx.userId, evidence.fileSize);

      // 写入审计日志
      await prisma.workspaceAuditLog.create({
        data: {
          workspaceId: ws.id,
          operatorId: ctx.userId,
          action: AuditAction.DELETE,
          resourceType: 'EVIDENCE',
          evidenceId: evidence.id,
          s3Key: evidence.s3Key,
        },
      });

      await prisma.evidence.delete({ where: { id: input.evidenceId } });
      return { success: true };
    }),

  /**
   * 生成证据清单
   */
  generateList: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      return evidenceService.generateEvidenceList(input.caseId, ws.id);
    }),
});
