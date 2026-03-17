'use client';

import { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Space, Empty, Popconfirm, message } from 'antd';
import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { ColumnsType } from 'antd/es/table';
import type { MockCourtSessionSummary } from '@/types/mock-court';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'blue',
  COMPLETED: 'green',
  PAUSED: 'orange',
  ABANDONED: 'default',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  BEGINNER: 'green',
  INTERMEDIATE: 'orange',
  ADVANCED: 'red',
};

export default function MockCourtHistoryPage() {
  const t = useTranslations('mockCourt');
  const router = useRouter();
  const [sessions, setSessions] = useState<MockCourtSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trpc/mockCourt.listSessions', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data?.result?.data) {
        setSessions(data.result.data);
      }
    } catch {
      // Keep empty list on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = useCallback(async (sessionId: string) => {
    setDeletingId(sessionId);
    try {
      const res = await fetch('/api/trpc/mockCourt.deleteSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        message.success(t('history.deleteSuccess'));
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        const data = await res.json();
        message.error(data?.error?.message ?? t('errors.createFailed'));
      }
    } catch {
      message.error(t('errors.createFailed'));
    } finally {
      setDeletingId(null);
    }
  }, [t]);

  const handleExportPDF = useCallback(async (sessionId: string) => {
    setExportingId(sessionId);
    try {
      const res = await fetch('/api/trpc/mockCourt.exportPDF', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data?.error?.message ?? t('errors.exportFailed'));
        return;
      }
      const base64 = data?.result?.data?.pdf;
      if (base64) {
        const html = atob(base64);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mock-court-${sessionId}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      message.error(t('errors.exportFailed'));
    } finally {
      setExportingId(null);
    }
  }, [t]);

  const columns: ColumnsType<MockCourtSessionSummary> = [
    {
      title: t('history.caseTypeBadge'),
      dataIndex: 'caseType',
      key: 'caseType',
      render: (caseType: string) => <Tag>{t(`caseTypes.${caseType}`)}</Tag>,
    },
    {
      title: t('history.jurisdictionBadge'),
      dataIndex: 'jurisdiction',
      key: 'jurisdiction',
      render: (jurisdiction: string) => <Tag>{t(`jurisdictions.${jurisdiction}`)}</Tag>,
    },
    {
      title: t('history.difficultyBadge'),
      dataIndex: 'difficulty',
      key: 'difficulty',
      render: (difficulty: string) => (
        <Tag color={DIFFICULTY_COLORS[difficulty] ?? 'default'}>
          {t(`difficultyLevels.${difficulty}`)}
        </Tag>
      ),
    },
    {
      title: t('history.statusBadge'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] ?? 'default'}>
          {t(`status.${status}`)}
        </Tag>
      ),
    },
    {
      title: t('history.sessionDate'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (createdAt: string) => new Date(createdAt).toLocaleString(),
      defaultSortOrder: 'descend',
      sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: '',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={() => router.push(`/mock-court/${record.id}`)}
            data-testid={`view-btn-${record.id}`}
          >
            {record.status === 'ACTIVE' ? t('continueSession') : t('viewHistory')}
          </Button>
          {record.status === 'COMPLETED' && (
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              loading={exportingId === record.id}
              onClick={() => handleExportPDF(record.id)}
              data-testid={`export-btn-${record.id}`}
            >
              {t('exportRecord')}
            </Button>
          )}
          <Popconfirm
            title={t('history.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('deleteSession')}
            cancelText={t('backToList')}
          >
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
              data-testid={`delete-btn-${record.id}`}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" data-testid="history-title">
            {t('history.title')}
          </h1>
          <Button onClick={() => router.push('/mock-court')} data-testid="back-btn">
            {t('backToList')}
          </Button>
        </div>

        {!loading && sessions.length === 0 ? (
          <Empty
            description={t('history.empty')}
            data-testid="history-empty"
          />
        ) : (
          <Table
            columns={columns}
            dataSource={sessions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            data-testid="history-table"
          />
        )}
      </div>
    </div>
  );
}
