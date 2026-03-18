import { NextRequest, NextResponse } from 'next/server';
import { runDeadlineReminder } from '@/server/jobs/deadlineReminder';

/**
 * POST /api/jobs/deadline-reminder
 * 由外部 cron 服务（如 AWS EventBridge、Vercel Cron）每日触发
 * 需要 Authorization: Bearer {CRON_SECRET} 验证
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDeadlineReminder();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[DeadlineReminder] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
