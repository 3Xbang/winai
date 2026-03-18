import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { TRPCError } from '@trpc/server';
import { prisma } from '@/lib/prisma';
import { checkQuota } from './workspaceService';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-southeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET = process.env.AWS_S3_BUCKET ?? '';

/**
 * 验证 s3Key 归属于指定律师（防止越权访问）
 */
function assertKeyBelongsToLawyer(s3Key: string, lawyerId: string) {
  const expectedPrefix = `workspaces/${lawyerId}/`;
  if (!s3Key.startsWith(expectedPrefix)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问此文件' });
  }
}

export const storageService = {
  /**
   * 上传文件到 S3，前置配额检查，成功后更新已用存储量
   */
  async upload(
    lawyerId: string,
    caseId: string,
    fileId: string,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const fileSize = BigInt(fileBuffer.length);

    // 配额检查
    const ws = await prisma.lawyerWorkspace.findUnique({ where: { lawyerId } });
    if (!ws) throw new TRPCError({ code: 'NOT_FOUND', message: '工作空间不存在' });

    const totalGB = ws.storageQuotaGB + ws.storageAddOnGB;
    const quotaBytes = BigInt(totalGB) * BigInt(1024 * 1024 * 1024);

    if (!checkQuota(ws.storageUsedBytes, fileSize, quotaBytes)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'STORAGE_QUOTA_EXCEEDED' });
    }

    const s3Key = `workspaces/${lawyerId}/cases/${caseId}/evidence/${fileId}/${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
      }),
    );

    // 更新已用存储量
    await prisma.lawyerWorkspace.update({
      where: { lawyerId },
      data: { storageUsedBytes: { increment: fileSize } },
    });

    return s3Key;
  },

  /**
   * 上传文档版本到 S3
   */
  async uploadDocumentVersion(
    lawyerId: string,
    caseId: string,
    documentId: string,
    versionNumber: number,
    fileName: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    const fileSize = BigInt(fileBuffer.length);
    const ws = await prisma.lawyerWorkspace.findUnique({ where: { lawyerId } });
    if (!ws) throw new TRPCError({ code: 'NOT_FOUND', message: '工作空间不存在' });

    const totalGB = ws.storageQuotaGB + ws.storageAddOnGB;
    const quotaBytes = BigInt(totalGB) * BigInt(1024 * 1024 * 1024);

    if (!checkQuota(ws.storageUsedBytes, fileSize, quotaBytes)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'STORAGE_QUOTA_EXCEEDED' });
    }

    const s3Key = `workspaces/${lawyerId}/cases/${caseId}/documents/${documentId}/v${versionNumber}/${fileName}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: mimeType,
      }),
    );

    await prisma.lawyerWorkspace.update({
      where: { lawyerId },
      data: { storageUsedBytes: { increment: fileSize } },
    });

    return s3Key;
  },

  /**
   * 获取预签名下载 URL（有效期 1 小时）
   */
  async getPresignedUrl(s3Key: string, lawyerId: string): Promise<string> {
    assertKeyBelongsToLawyer(s3Key, lawyerId);

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
    return getSignedUrl(s3, command, { expiresIn: 3600 });
  },

  /**
   * 删除文件并更新存储用量
   */
  async delete(s3Key: string, lawyerId: string, fileSize: bigint): Promise<void> {
    assertKeyBelongsToLawyer(s3Key, lawyerId);

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));

    await prisma.lawyerWorkspace.update({
      where: { lawyerId },
      data: { storageUsedBytes: { decrement: fileSize } },
    });
  },
};
