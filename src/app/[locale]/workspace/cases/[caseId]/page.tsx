'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, Button, Timeline, Alert, Spin, Tabs } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  DollarOutlined,
  FolderOutlined,
  UserOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useRouter } from '@/i18n/navigation';
import { useParams } from 'next/navigation';

interface CaseDetail {
  id: string;
  caseNumber: string;
  title: string;
  caseType: string;
  status: string;
  clientName: string;
  opposingParty: string | null;
  filedAt: string;
  timeline: Array<{ id: string; eventType: string; description: string; occurredAt: string }>;
  deadlines: Array<{ id: string; title: string; dueDate: string; isHandled: boolean }>;
  visitRecords: Array<{ id: string; outcome: string; nextSteps: string; visitedAt: string }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  OPEN: { label: '立案', color: 'blue' },
  IN_PROGRESS: { label: '进行中', color: 'orange' },
  CLOSED: { label: '已结案', color: 'green' },
  ARCHIVED: { label: '已归档', color: 'default' },
};

function getDaysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

const SUB_MODULES = [
  { key: 'evidence', label: '证据', icon: <FileTextOutlined />, path: 'evidence' },
  { key: 'visit', label: '会见', icon: <UserOutlined />, path: 'visit' },
  { key: 'channel', label: '沟通', icon: <MessageOutlined />, path: 'channel' },
  { key: 'deadlines', label: '期限', icon: <ClockCircleOutlined />, path: 'deadlines' },
  { key: 'fees', label: '费用', icon: <DollarOutlined />, path: 'fees' },
  { key: 'documents', label: '文件', icon: <FolderOutlined />, path: 'documents' },
];

export default function CaseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const caseId = params?.caseId as string;

  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadCase = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceCase.getCaseById?input=${input}`);
      const data = await res.json();
      setCaseData(data?.result?.data ?? null);
    } catch {
      setCaseData(null);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadCase();
  }, [loadCase]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Alert type="error" message="案件不存在或无权访问" />
      </div>
    );
  }

  const status = STATUS_CONFIG[caseData.status] ?? STATUS_CONFIG['OPEN']!;
  const latestVisit = caseData.visitRecords[0];
  const overdueDeadlines = caseData.deadlines.filter(
    (d) => !d.isHandled && getDaysUntil(d.dueDate) < 0,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* 返回 */}
        <Button type="link" onClick={() => router.push('/workspace/cases')} className="px-0">
          ← 返回案件列表
        </Button>

        {/* 案件头部 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-gray-400 font-mono">{caseData.caseNumber}</span>
                <Tag color={status.color}>{status.label}</Tag>
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-3">{caseData.title}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <UserOutlined /> {caseData.clientName}
                </span>
                <span>{caseData.caseType}</span>
                <span className="flex items-center gap-1">
                  <CalendarOutlined />
                  立案：{new Date(caseData.filedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              {caseData.opposingParty && (
                <p className="text-sm text-gray-500 mt-2">对立方：{caseData.opposingParty}</p>
              )}
            </div>
          </div>
        </div>

        {/* 逾期警告 */}
        {overdueDeadlines.length > 0 && (
          <Alert
            type="error"
            showIcon
            message={`${overdueDeadlines.length} 个期限已逾期`}
            description={overdueDeadlines.map((d) => d.title).join('、')}
            className="rounded-2xl"
          />
        )}

        {/* 最新会见结论（显眼位置） */}
        {latestVisit && (
          <div className="bg-teal-500 rounded-2xl p-6 text-white">
            <p className="text-sm font-semibold opacity-80 mb-2">
              最近会见结论 · {new Date(latestVisit.visitedAt).toLocaleDateString('zh-CN')}
            </p>
            <p className="text-lg font-medium mb-3">{latestVisit.outcome}</p>
            <div className="bg-white/20 rounded-xl p-3">
              <p className="text-sm opacity-90">下一步策略：{latestVisit.nextSteps}</p>
            </div>
            <Button
              type="text"
              className="mt-3 text-white opacity-80 hover:opacity-100 px-0"
              onClick={() => router.push(`/workspace/cases/${caseId}/visit` as any)}
            >
              查看全部会见记录 →
            </Button>
          </div>
        )}

        {/* 子模块导航 */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {SUB_MODULES.map((mod) => (
            <button
              key={mod.key}
              onClick={() => router.push(`/workspace/cases/${caseId}/${mod.path}` as any)}
              className="bg-white rounded-2xl p-4 text-center hover:shadow-md hover:border-orange-200 border border-gray-100 transition-all cursor-pointer"
            >
              <div className="text-2xl text-orange-500 mb-2">{mod.icon}</div>
              <p className="text-sm font-semibold text-gray-700">{mod.label}</p>
            </button>
          ))}
        </div>

        {/* 案件时间线 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-800 mb-4">案件时间线</h2>
          {caseData.timeline.length === 0 ? (
            <p className="text-gray-400 text-sm">暂无时间线记录</p>
          ) : (
            <Timeline
              items={caseData.timeline.map((event) => ({
                key: event.id,
                children: (
                  <div>
                    <p className="text-sm font-medium text-gray-700">{event.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(event.occurredAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ),
              }))}
            />
          )}
        </div>
      </div>
    </div>
  );
}
