import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { workspaceService } from '../services/workspace/workspaceService';
import { storageService } from '../services/workspace/storageService';
import { prisma } from '@/lib/prisma';
import { AuditAction } from '@prisma/client';
import { randomUUID } from 'crypto';

export const workspaceDocumentRouter = createTRPCRouter({
  /**
   * 上传新版本（自动递增版本号）
   */
  uploadVersion: protectedProcedure
    .input(
      z.object({
        caseId: z.string(),
        documentId: z.string().optional(), // 不传则创建新文档
        title: z.string().min(1),
        fileName: z.string(),
        mimeType: z.string(),
        fileBase64: z.string(),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      const fileBuffer = Buffer.from(input.fileBase64, 'base64');

      // 获取或创建文档记录
      let doc = input.documentId
        ? await prisma.caseDocument.findFirst({
            where: { id: input.documentId, caseId: input.caseId },
          })
        : null;

      if (!doc) {
        doc = await prisma.caseDocument.create({
          data: { caseId: input.caseId, title: input.title },
        });
      }

      // 计算下一个版本号
      const lastVersion = await prisma.caseDocumentVersion.findFirst({
        where: { documentId: doc.id },
        orderBy: { versionNumber: 'desc' },
      });
      const nextVersion = (lastVersion?.versionNumber ?? 0) + 1;

      const s3Key = await storageService.uploadDocumentVersion(
        ctx.userId,
        input.caseId,
        doc.id,
        nextVersion,
        input.fileName,
        fileBuffer,
        input.mimeType,
      );

      // 将旧版本标记为非活跃
      await prisma.caseDocumentVersion.updateMany({
        where: { documentId: doc.id, isActive: true },
        data: { isActive: false },
      });

      const version = await prisma.caseDocumentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: nextVersion,
          s3Key,
          fileSize: BigInt(fileBuffer.length),
          uploadedBy: ctx.userId,
          notes: input.notes,
          isActive: true,
        },
      });

      // 更新文档当前版本
      await prisma.caseDocument.update({
        where: { id: doc.id },
        data: { currentVersionId: version.id },
      });

      // 审计日志
      await prisma.workspaceAuditLog.create({
        data: {
          workspaceId: ws.id,
          operatorId: ctx.userId,
          action: AuditAction.UPLOAD,
          resourceType: 'DOCUMENT_VERSION',
          documentVersionId: version.id,
          s3Key,
        },
      });

      return { document: doc, version };
    }),

  /**
   * 获取文档版本列表
   */
  listVersions: protectedProcedure
    .input(z.object({ documentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const doc = await prisma.caseDocument.findFirst({
        where: { id: input.documentId, case: { workspaceId: ws.id } },
      });
      if (!doc) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.caseDocumentVersion.findMany({
        where: { documentId: input.documentId },
        orderBy: { versionNumber: 'desc' },
      });
    }),

  /**
   * 设置活跃版本
   */
  setActiveVersion: protectedProcedure
    .input(z.object({ versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const version = await prisma.caseDocumentVersion.findFirst({
        where: { id: input.versionId, document: { case: { workspaceId: ws.id } } },
      });
      if (!version) throw new TRPCError({ code: 'NOT_FOUND' });

      await prisma.caseDocumentVersion.updateMany({
        where: { documentId: version.documentId, isActive: true },
        data: { isActive: false },
      });

      const updated = await prisma.caseDocumentVersion.update({
        where: { id: input.versionId },
        data: { isActive: true },
      });

      await prisma.caseDocument.update({
        where: { id: version.documentId },
        data: { currentVersionId: input.versionId },
      });

      // 审计日志
      await prisma.workspaceAuditLog.create({
        data: {
          workspaceId: ws.id,
          operatorId: ctx.userId,
          action: AuditAction.VERSION_RESTORE,
          resourceType: 'DOCUMENT_VERSION',
          documentVersionId: input.versionId,
          s3Key: version.s3Key,
        },
      });

      return updated;
    }),

  /**
   * 获取文档列表（按案件）
   */
  listDocuments: protectedProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const case_ = await prisma.case.findFirst({
        where: { id: input.caseId, workspaceId: ws.id },
      });
      if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

      return prisma.caseDocument.findMany({
        where: { caseId: input.caseId },
        include: {
          versions: {
            where: { isActive: true },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  /**
   * 获取版本下载 URL
   */
  getVersionDownloadUrl: protectedProcedure
    .input(z.object({ versionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ws = await workspaceService.getWorkspace(ctx.userId);
      const version = await prisma.caseDocumentVersion.findFirst({
        where: { id: input.versionId, document: { case: { workspaceId: ws.id } } },
      });
      if (!version) throw new TRPCError({ code: 'NOT_FOUND' });

      // 审计日志
      await prisma.workspaceAuditLog.create({
        data: {
          workspaceId: ws.id,
          operatorId: ctx.userId,
          action: AuditAction.DOWNLOAD,
          resourceType: 'DOCUMENT_VERSION',
          documentVersionId: version.id,
          s3Key: version.s3Key,
        },
      });

      return storageService.getPresignedUrl(version.s3Key, ctx.userId);
    }),
});
