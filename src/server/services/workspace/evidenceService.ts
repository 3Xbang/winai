import { prisma } from '@/lib/prisma';
import redis from '@/lib/redis';
import { TRPCError } from '@trpc/server';
import { EvidenceCategory, AuditAction } from '@prisma/client';
import { storageService } from './storageService';
import { aiService } from './aiService';
import { workspaceService } from './workspaceService';
import { randomUUID } from 'crypto';

const CLASSIFY_QUEUE = 'evidence:classify:queue';
const CLASSIFY_RETRY_ZSET = 'evidence:classify:retry';
const MAX_RETRIES = 3;

export const evidenceService = {
  /**
   * 上传证据文件
   */
  async uploadEvidence(params: {
    lawyerId: string;
    caseId: string;
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
    description?: string;
  }) {
    const ws = await workspaceService.getWorkspace(params.lawyerId);

    // 验证案件归属
    const case_ = await prisma.case.findFirst({
      where: { id: params.caseId, workspaceId: ws.id },
    });
    if (!case_) throw new TRPCError({ code: 'NOT_FOUND', message: '案件不存在' });

    const fileId = randomUUID();
    const s3Key = await storageService.upload(
      params.lawyerId,
      params.caseId,
      fileId,
      params.fileName,
      params.fileBuffer,
      params.mimeType,
    );

    const evidence = await prisma.evidence.create({
      data: {
        caseId: params.caseId,
        fileName: params.fileName,
        fileSize: BigInt(params.fileBuffer.length),
        mimeType: params.mimeType,
        s3Key,
        category: EvidenceCategory.PENDING_CLASSIFICATION,
        uploadedBy: params.lawyerId,
      },
    });

    // 写入审计日志
    await prisma.workspaceAuditLog.create({
      data: {
        workspaceId: ws.id,
        operatorId: params.lawyerId,
        action: AuditAction.UPLOAD,
        resourceType: 'EVIDENCE',
        evidenceId: evidence.id,
        s3Key,
      },
    });

    // 追加时间线
    await prisma.caseTimelineEvent.create({
      data: {
        caseId: params.caseId,
        eventType: 'EVIDENCE_ADDED',
        description: `上传证据：${params.fileName}`,
        operatorId: params.lawyerId,
      },
    });

    // 触发异步分类
    await evidenceService.triggerClassification(evidence.id);

    return evidence;
  },

  /**
   * 将证据分类任务写入 Redis 队列（异步处理）
   */
  async triggerClassification(evidenceId: string) {
    await redis.lpush(CLASSIFY_QUEUE, evidenceId);
  },

  /**
   * 处理分类队列中的一个任务（供 worker 调用）
   */
  async processClassificationTask(evidenceId: string) {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { case: true },
    });
    if (!evidence) return;

    try {
      const result = await aiService.classifyEvidence({
        fileName: evidence.fileName,
        mimeType: evidence.mimeType,
        caseContext: evidence.case.caseType,
      });

      await prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          category: result.category as EvidenceCategory,
          proofPurpose: result.proofPurpose,
          legalBasis: result.legalBasis,
          strength: result.strength as any,
          similarCase: result.similarCase,
          classifiedAt: new Date(),
          classifyError: null,
        },
      });
    } catch (err) {
      await prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          category: EvidenceCategory.PENDING_CLASSIFICATION,
          classifyError: (err as Error).message,
        },
      });
      // 延迟 5 分钟重试，最多 3 次
      const retryScore = Date.now() + 5 * 60 * 1000;
      await redis.zadd(CLASSIFY_RETRY_ZSET, retryScore, evidenceId);
    }
  },

  /**
   * 获取案件证据列表
   */
  async listEvidences(caseId: string, workspaceId: string) {
    const case_ = await prisma.case.findFirst({
      where: { id: caseId, workspaceId },
    });
    if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

    return prisma.evidence.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * 生成证据清单（结构化数据）
   */
  async generateEvidenceList(caseId: string, workspaceId: string) {
    const case_ = await prisma.case.findFirst({
      where: { id: caseId, workspaceId },
      include: { evidences: { orderBy: { createdAt: 'asc' } } },
    });
    if (!case_) throw new TRPCError({ code: 'NOT_FOUND' });

    return {
      caseTitle: case_.title,
      caseNumber: case_.caseNumber,
      clientName: case_.clientName,
      generatedAt: new Date().toISOString(),
      evidences: case_.evidences.map((e, idx) => ({
        index: idx + 1,
        fileName: e.fileName,
        category: e.category,
        proofPurpose: e.proofPurpose ?? '待分析',
        legalBasis: e.legalBasis,
        strength: e.strength ?? 'MEDIUM',
        similarCase: e.similarCase ?? '',
        uploadedAt: e.createdAt.toISOString(),
      })),
    };
  },
};
