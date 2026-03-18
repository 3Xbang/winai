'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Button, Select, Spin, Empty, Badge } from 'antd';
import {
  PlusOutlined,
  ClockCircleOutlined,
  UserOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useRouter } from '@/i18n/navigation';

interface CaseItem {
  id: string;
  caseNumber: string;
  title: string;
  caseType: string;
  status: string;
  clientName: string;
  filedAt: string;
  updatedAt: string;
  deadlines: Array<{ id: string; title: string; dueDate: string }>;
  visitRecords: Array<{ outcome: string; nextSteps: string; visitedAt: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: '立案', color: 'blue', bg: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: '进行中', color: 'orange', bg: 'bg-orange-100 text-orange-700' },
  CLOSED: { label: '已结案', color: 'green', bg: 'bg-green-100 text-green-700' },
  ARCHIVED: { label: '已归档', color: 'default', bg: 'bg-gray-100 text-gray-500' },
};

function getDaysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function CaseCard({ case_: c, onClick }: { case_: CaseItem; onClick: () => void }) {
  const status = STATUS_CONFIG[c.status] ?? STATUS_CONFIG['OPEN']!;
  const nearestDeadline = c.deadlines[0];
  const latestVisit = c.visitRecords[0];
  const days = nearestDeadline ? getDaysUntil(nearestDeadline.dueDate) : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-orange-200 transition-all cursor-pointer"
    >
      {/* 顶部：案件号 + 状态 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400 font-mono">{c.caseNumber}</span>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status.bg}`}>
          {status.label}
        </span>
      </div>

      {/* 案件标题 */}
      <h3 className="text-xl font-bold text-gray-800 mb-1 leading-tight">{c.title}</h3>
      <p className="text-sm text-gray-500 mb-4">{c.caseType}</p>

      {/* 当事人 */}
      <div className="flex items-center gap-2 mb-3">
        <UserOutlined className="text-gray-400" />
        <span className="text-base text-gray-700 font-medium">{c.clientName}</span>
      </div>

      {/* 最新进展 */}
      {latestVisit && (
        <div className="bg-teal-50 rounded-xl p-3 mb-3">
          <p className="text-xs text-teal-600 font-semibold mb-1">最新进展</p>
          <p className="text-sm text-gray-700 line-clamp-2">{latestVisit.outcome}</p>
          {latestVisit.nextSteps && (
            <p className="text-xs text-teal-600 mt-1">→ {latestVisit.nextSteps}</p>
          )}
        </div>
      )}

      {/* 紧急期限 */}
      {nearestDeadline && days !== null && (
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 ${
            days <= 1
              ? 'bg-red-50 text-red-600'
              : days <= 7
              ? 'bg-orange-50 text-orange-600'
              : 'bg-blue-50 text-blue-600'
          }`}
        >
          <ClockCircleOutlined />
          <span className="text-sm font-medium">{nearestDeadline.title}</span>
          <span className="ml-auto text-sm font-bold">
            {days <= 0 ? '已逾期' : `${days}天后`}
          </span>
        </div>
      )}

      {/* 底部：立案日期 */}
      <p className="text-xs text-gray-400 mt-3">
        立案：{new Date(c.filedAt).toLocaleDateString('zh-CN')} ·
        更新：{new Date(c.updatedAt).toLocaleDateString('zh-CN')}
      </p>
    </button>
  );
}

export default function CaseListPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const input = statusFilter
        ? encodeURIComponent(JSON.stringify({ status: statusFilter }))
        : encodeURIComponent(JSON.stringify({}));
      const res = await fetch(`/api/trpc/workspaceCase.listCases?input=${input}`);
      const data = await res.json();
      setCases(data?.result?.data?.cases ?? []);
    } catch {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <FileTextOutlined className="text-orange-500" />
              案件管理
            </h1>
            <p className="text-gray-500 mt-1">共 {cases.length} 个案件</p>
          </div>
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

        {/* 筛选 */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {[
            { value: undefined, label: '全部' },
            { value: 'OPEN', label: '立案' },
            { value: 'IN_PROGRESS', label: '进行中' },
            { value: 'CLOSED', label: '已结案' },
            { value: 'ARCHIVED', label: '已归档' },
          ].map((opt) => (
            <button
              key={opt.label}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                statusFilter === opt.value
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 案件列表 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spin size="large" />
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-20">
            <Empty
              description="暂无案件，点击右上角新建"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              className="mt-4 rounded-xl"
              style={{ background: '#f97316', borderColor: '#f97316' }}
              onClick={() => router.push('/workspace/cases/new')}
            >
              新建第一个案件
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cases.map((c) => (
              <CaseCard
                key={c.id}
                case_={c}
                onClick={() => router.push(`/workspace/cases/${c.id}` as any)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
