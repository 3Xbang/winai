import { prisma } from '@/lib/prisma';
import { LawyerPlanTier, WorkspaceStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';

// 套餐配额常量（GB）
export const PLAN_QUOTA_GB: Record<LawyerPlanTier, number> = {
  BASIC: 5,
  PROFESSIONAL: 50,
  FIRM: 500,
};

const GB_TO_BYTES = 1024 * 1024 * 1024;

/**
 * 检查存储配额（纯函数）
 * @returns true 表示允许上传，false 表示超限
 */
export function checkQuota(
  usedBytes: bigint,
  fileSize: bigint,
  quotaBytes: bigint,
): boolean {
  return usedBytes + fileSize <= quotaBytes;
}

export const workspaceService = {
  /**
   * 律师注册后自动调用，创建专属工作空间
   */
  async initWorkspace(lawyerId: string, planTier: LawyerPlanTier = LawyerPlanTier.BASIC) {
    const quotaGB = PLAN_QUOTA_GB[planTier];
    const s3BasePath = `workspaces/${lawyerId}/`;

    return prisma.$transaction(async (tx) => {
      // 幂等：已存在则直接返回
      const existing = await tx.lawyerWorkspace.findUnique({
        where: { lawyerId },
      });
      if (existing) return existing;

      return tx.lawyerWorkspace.create({
        data: {
          lawyerId,
          planTier,
          status: WorkspaceStatus.ACTIVE,
          storageQuotaGB: quotaGB,
          storageAddOnGB: 0,
          storageUsedBytes: BigInt(0),
          s3BasePath,
        },
      });
    });
  },

  /**
   * 获取存储用量（字节）和总配额（字节）
   */
  async getStorageUsage(lawyerId: string) {
    const ws = await prisma.lawyerWorkspace.findUnique({
      where: { lawyerId },
      include: { lawyerSubscription: { include: { addOns: true } } },
    });

    if (!ws) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '工作空间不存在' });
    }

    const totalGB = ws.storageQuotaGB + ws.storageAddOnGB;
    const quotaBytes = BigInt(totalGB) * BigInt(GB_TO_BYTES);

    return {
      used: ws.storageUsedBytes,
      quota: quotaBytes,
      usedGB: Number(ws.storageUsedBytes) / GB_TO_BYTES,
      totalGB,
    };
  },

  /**
   * 检查是否可以上传指定大小的文件
   */
  async checkQuotaForUpload(lawyerId: string, fileSize: bigint): Promise<boolean> {
    const { used, quota } = await workspaceService.getStorageUsage(lawyerId);
    return checkQuota(used, fileSize, quota);
  },

  /**
   * 获取工作空间（含状态检查）
   */
  async getWorkspace(lawyerId: string) {
    const ws = await prisma.lawyerWorkspace.findUnique({
      where: { lawyerId },
    });
    if (!ws) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '工作空间不存在' });
    }
    return ws;
  },
};
