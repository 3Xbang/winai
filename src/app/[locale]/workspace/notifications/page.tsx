'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Tag, Spin, Empty, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { useRouter } from '@/i18n/navigation';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  relatedId: string | null;
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  DEADLINE_7DAY: { label: '7天提醒', color: 'orange' },
  DEADLINE_1DAY: { label: '紧急提醒', color: 'red' },
  DEADLINE_OVERDUE: { label: '已逾期', color: 'red' },
  CHANNEL_MESSAGE: { label: '新消息', color: 'blue' },
  STAGE_UPDATE: { label: '进展更新', color: 'teal' },
  EVIDENCE_CLASSIFIED: { label: '证据分析完成', color: 'green' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trpc/workspaceNotification.getUnread');
      const data = await res.json();
      setNotifications(data?.result?.data ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (notificationId: string) => {
    try {
      await fetch('/api/trpc/workspaceNotification.markRead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch {
      message.error('操作失败');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/trpc/workspaceNotification.markAllRead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      setNotifications([]);
      message.success('已全部标记为已读');
    } catch {
      message.error('操作失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button type="link" onClick={() => router.push('/workspace')} className="px-0">
              ← 返回工作台
            </Button>
            <h1 className="text-2xl font-bold text-gray-800 mt-1 flex items-center gap-2">
              <BellOutlined className="text-orange-500" />
              通知中心
            </h1>
          </div>
          {notifications.length > 0 && (
            <Button
              icon={<CheckOutlined />}
              onClick={handleMarkAllRead}
              className="rounded-xl"
            >
              全部已读
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Spin /></div>
        ) : notifications.length === 0 ? (
          <Empty description="暂无未读通知" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const typeConfig = TYPE_CONFIG[n.type] ?? { label: n.type, color: 'default' };
              return (
                <div
                  key={n.id}
                  className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-orange-300"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Tag color={typeConfig.color}>{typeConfig.label}</Tag>
                        <span className="text-xs text-gray-400">
                          {new Date(n.createdAt).toLocaleString('zh-CN')}
                        </span>
                      </div>
                      <p className="font-semibold text-gray-800">{n.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{n.body}</p>
                    </div>
                    <Button
                      size="small"
                      type="text"
                      icon={<CheckOutlined />}
                      onClick={() => handleMarkRead(n.id)}
                      className="shrink-0 text-gray-400 hover:text-green-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
