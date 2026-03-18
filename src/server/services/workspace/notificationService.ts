import { prisma } from '@/lib/prisma';
import { NotificationType } from '@prisma/client';

export const notificationService = {
  async send(params: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    relatedId?: string;
    deadlineId?: string;
  }) {
    return prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        relatedId: params.relatedId,
        deadlineId: params.deadlineId,
      },
    });
  },

  async getUnread(userId: string) {
    return prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async markRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  },

  /**
   * 检查期限并发送提醒通知（供定时任务调用）
   */
  async checkDeadlines() {
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in1Day = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // 7 天提醒
    const deadlines7Day = await prisma.deadline.findMany({
      where: {
        isHandled: false,
        dueDate: {
          gte: new Date(in7Days.getTime() - 60 * 60 * 1000), // ±1小时容差
          lte: new Date(in7Days.getTime() + 60 * 60 * 1000),
        },
      },
      include: { case: { include: { workspace: true } } },
    });

    for (const deadline of deadlines7Day) {
      await notificationService.send({
        userId: deadline.case.workspace.lawyerId,
        type: NotificationType.DEADLINE_7DAY,
        title: `期限提醒：${deadline.title}`,
        body: `案件「${deadline.case.title}」的期限「${deadline.title}」将在 7 天后到期`,
        relatedId: deadline.caseId,
        deadlineId: deadline.id,
      });
    }

    // 1 天提醒
    const deadlines1Day = await prisma.deadline.findMany({
      where: {
        isHandled: false,
        dueDate: {
          gte: new Date(in1Day.getTime() - 60 * 60 * 1000),
          lte: new Date(in1Day.getTime() + 60 * 60 * 1000),
        },
      },
      include: { case: { include: { workspace: true } } },
    });

    for (const deadline of deadlines1Day) {
      await notificationService.send({
        userId: deadline.case.workspace.lawyerId,
        type: NotificationType.DEADLINE_1DAY,
        title: `紧急提醒：${deadline.title}`,
        body: `案件「${deadline.case.title}」的期限「${deadline.title}」将在明天到期，请尽快处理！`,
        relatedId: deadline.caseId,
        deadlineId: deadline.id,
      });
    }

    return { checked7Day: deadlines7Day.length, checked1Day: deadlines1Day.length };
  },
};
