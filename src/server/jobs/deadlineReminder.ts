/**
 * 期限提醒定时任务
 * 每日运行一次，检查 7 天和 1 天到期的期限并发送通知
 *
 * 触发方式：通过 Next.js API route + 外部 cron 服务（如 AWS EventBridge）调用
 * 调用路径：POST /api/jobs/deadline-reminder（需要 CRON_SECRET 验证）
 */

import { notificationService } from '../services/workspace/notificationService';

export async function runDeadlineReminder() {
  console.log('[DeadlineReminder] Starting deadline check...');
  const result = await notificationService.checkDeadlines();
  console.log(
    `[DeadlineReminder] Done. 7-day: ${result.checked7Day}, 1-day: ${result.checked1Day}`,
  );
  return result;
}
