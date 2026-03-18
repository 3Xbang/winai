'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Badge, Tag, Button, Spin, Empty, Progress, Statistic } from 'antd';
import {
  AlertOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  BellOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useRouter } from '@/i18n/navigation';

interface UpcomingDeadline {
  id: string;
  title: string;
  dueDate: string;
  deadlineType: string;
  case: { title: string; caseNumber: string };
}

interface StorageUsage {
  usedGB: number;
  totalGB: number;
}

interface DashboardData {
  deadlines: UpcomingDeadline[];
  storage: StorageUsage | null;
  unreadCount: number;
}

const DEADLINE_TYPE_LABELS: Record<string, string> = {
  STATUTE_OF_LIMITATIONS: '诉讼时效',
  COURT_DATE: '开庭日期',
  APPEAL_DEADLINE: '上诉截止',
  OTHER: '其他',
};

function getDaysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function DeadlineCard({ deadline }: { deadline: UpcomingDeadline }) {
  const days = getDaysUntil(deadline.dueDate);
  const isUrgent = days <= 1;
  const isWarning = days <= 7;

  return (
    <div
      className={`rounded-2xl p-5 border-2 ${
        isUrgent
          ? 'border-red-400 bg-red-50'
          : isWarning
          ? 'border-orange-300 bg-orange-50'
          : 'border-blue-200 bg-blue-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-800 truncate">{deadline.title}</p>
          <p className="text-sm text-gray-500 mt-1 truncate">
            {deadline.case.caseNumber} · {deadline.case.title}
          </p>
          <Tag
            className="mt-2"
            color={isUrgent ? 'red' : isWarning ? 'orange' : 'blue'}
          >
            {DEADLINE_TYPE_LABELS[deadline.deadlineType] ?? deadline.deadlineType}
          </Tag>
        </div>
        <div className="text-right shrink-0">
          <p
            className={`text-2xl font-bold ${
              isUrgent ? 'text-red-500' : isWarning ? 'text-orange-500' : 'text-blue-500'
            }`}
          >
            {days <= 0 ? '已逾期' : `${days}天`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(deadline.dueDate).toLocaleDateString('zh-CN')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WorkspaceDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>({
    deadlines: [],
    storage: null,
    unreadCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [deadlineRes, storageRes, notifRes] = await Promise.all([
        fetch('/api/trpc/workspaceDeadline.getUpcoming?input=%7B%22days%22%3A7%7D'),
        fetch('/api/trpc/workspace.getStorageUsage'),
        fetch('/api/trpc/workspaceNotification.getUnread'),
      ]);

      const [deadlineData, storageData, notifData] = await Promise.all([
        deadlineRes.json(),
        storageRes.json(),
        notifRes.json(),
      ]);

      setData({
        deadlines: deadlineData?.result?.data ?? [],
        storage: storageData?.result?.data ?? null,
        unreadCount: (notifData?.result?.data ?? []).length,
      });
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const storagePercent = data.storage
    ? Math.round((data.storage.usedGB / data.storage.totalGB) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 顶部标题栏 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">律师工作台</h1>
            <p className="text-gray-500 mt-1">
              {new Date().toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </p>
          </div>
          <div className="flex gap-3">
            <Badge count={data.unreadCount} size="small">
              <Button
                icon={<BellOutlined />}
                shape="circle"
                size="large"
                onClick={() => router.push('/workspace/notifications')}
              />
            </Badge>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              size="large"
              className="rounded-xl"
              style={{ background: '#f97316', borderColor: '#f97316' }}
              onClick={() => router.push('/workspace/cases/new')}
            >
              新建案件
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* 快速导航卡片 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  icon: <FileTextOutlined className="text-2xl text-orange-500" />,
                  label: '案件管理',
                  path: '/workspace/cases',
                  bg: 'bg-orange-100',
                },
                {
                  icon: <ClockCircleOutlined className="text-2xl text-red-500" />,
                  label: '期限提醒',
                  badge: data.deadlines.length,
                  path: '/workspace/cases',
                  bg: 'bg-red-100',
                },
                {
                  icon: <BellOutlined className="text-2xl text-teal-500" />,
                  label: '通知中心',
                  badge: data.unreadCount,
                  path: '/workspace/notifications',
                  bg: 'bg-teal-100',
                },
                {
                  icon: <AlertOutlined className="text-2xl text-purple-500" />,
                  label: '工作空间设置',
                  path: '/workspace/settings',
                  bg: 'bg-purple-100',
                },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => router.push(item.path as any)}
                  className={`${item.bg} rounded-2xl p-5 text-left hover:scale-105 transition-transform cursor-pointer border-0 w-full`}
                >
                  <div className="flex items-center justify-between mb-2">
                    {item.icon}
                    {item.badge ? (
                      <Badge count={item.badge} size="small" />
                    ) : null}
                  </div>
                  <p className="text-base font-semibold text-gray-700">{item.label}</p>
                </button>
              ))}
            </div>

            {/* 紧急期限 */}
            <Card
              title={
                <span className="text-lg font-bold flex items-center gap-2">
                  <ClockCircleOutlined className="text-red-500" />
                  近7天期限
                  {data.deadlines.length > 0 && (
                    <Badge count={data.deadlines.length} color="red" />
                  )}
                </span>
              }
              className="rounded-2xl shadow-sm"
              styles={{ body: { padding: '16px' } }}
            >
              {data.deadlines.length === 0 ? (
                <Empty description="近7天暂无到期事项，继续保持！" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.deadlines.map((d) => (
                    <DeadlineCard key={d.id} deadline={d} />
                  ))}
                </div>
              )}
            </Card>

            {/* 存储用量 */}
            {data.storage && (
              <Card
                title={<span className="text-lg font-bold">存储空间</span>}
                className="rounded-2xl shadow-sm"
                extra={
                  <Button
                    type="link"
                    onClick={() => router.push('/workspace/settings')}
                  >
                    管理
                  </Button>
                }
              >
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <Progress
                      percent={storagePercent}
                      strokeColor={
                        storagePercent > 90
                          ? '#ef4444'
                          : storagePercent > 70
                          ? '#f97316'
                          : '#14b8a6'
                      }
                      trailColor="#e5e7eb"
                      strokeWidth={12}
                    />
                  </div>
                  <Statistic
                    value={data.storage.usedGB.toFixed(2)}
                    suffix={`/ ${data.storage.totalGB} GB`}
                    valueStyle={{ fontSize: 16, fontWeight: 600 }}
                  />
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
