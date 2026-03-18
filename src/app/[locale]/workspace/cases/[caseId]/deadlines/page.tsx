'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Form, Input, Select, DatePicker, Card, Tag, Spin, Empty, message, Popconfirm } from 'antd';
import { PlusOutlined, CheckOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import dayjs from 'dayjs';

interface DeadlineItem {
  id: string;
  title: string;
  deadlineType: string;
  dueDate: string;
  isHandled: boolean;
  handledAt: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  STATUTE_OF_LIMITATIONS: '诉讼时效',
  COURT_DATE: '开庭日期',
  APPEAL_DEADLINE: '上诉截止',
  OTHER: '其他',
};

function getDaysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function DeadlinesPage() {
  const params = useParams();
  const caseId = params?.caseId as string;
  const router = useRouter();
  const [form] = Form.useForm();

  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadDeadlines = useCallback(async () => {
    setLoading(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceDeadline.list?input=${input}`);
      const data = await res.json();
      setDeadlines(data?.result?.data ?? []);
    } catch {
      setDeadlines([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadDeadlines();
  }, [loadDeadlines]);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/trpc/workspaceDeadline.create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          deadlineType: values.deadlineType,
          title: values.title,
          dueDate: values.dueDate?.toISOString(),
        }),
      });
      if (res.ok) {
        message.success('期限已添加');
        form.resetFields();
        setShowForm(false);
        loadDeadlines();
      } else {
        message.error('添加失败');
      }
    } catch {
      message.error('添加失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkHandled = async (deadlineId: string) => {
    try {
      const res = await fetch('/api/trpc/workspaceDeadline.markHandled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadlineId }),
      });
      if (res.ok) {
        message.success('已标记为处理完成');
        loadDeadlines();
      }
    } catch {
      message.error('操作失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Button type="link" onClick={() => router.push(`/workspace/cases/${caseId}` as any)} className="px-0">
              ← 返回案件详情
            </Button>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">期限管理</h1>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl"
            style={{ background: '#f97316', borderColor: '#f97316' }}
          >
            添加期限
          </Button>
        </div>

        {showForm && (
          <Card className="rounded-2xl shadow-sm">
            <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
              <Form.Item label={<span className="font-semibold">期限类型</span>} name="deadlineType" rules={[{ required: true }]}>
                <Select
                  options={Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                  className="rounded-xl"
                />
              </Form.Item>
              <Form.Item label={<span className="font-semibold">期限名称</span>} name="title" rules={[{ required: true }]}>
                <Input placeholder="例：提交答辩状" className="rounded-xl" />
              </Form.Item>
              <Form.Item label={<span className="font-semibold">截止日期</span>} name="dueDate" rules={[{ required: true }]}>
                <DatePicker className="w-full rounded-xl" />
              </Form.Item>
              <div className="flex gap-3">
                <Button onClick={() => setShowForm(false)} className="flex-1 rounded-xl">取消</Button>
                <Button type="primary" htmlType="submit" loading={submitting} className="flex-1 rounded-xl" style={{ background: '#f97316', borderColor: '#f97316' }}>
                  保存
                </Button>
              </div>
            </Form>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Spin /></div>
        ) : deadlines.length === 0 ? (
          <Empty description="暂无期限记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="space-y-3">
            {deadlines.map((d) => {
              const days = getDaysUntil(d.dueDate);
              const isOverdue = days < 0 && !d.isHandled;
              return (
                <div
                  key={d.id}
                  className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${
                    d.isHandled ? 'border-green-400 opacity-60' : isOverdue ? 'border-red-400' : days <= 7 ? 'border-orange-400' : 'border-blue-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{d.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Tag>{TYPE_LABELS[d.deadlineType] ?? d.deadlineType}</Tag>
                        <span className="text-sm text-gray-500">
                          {new Date(d.dueDate).toLocaleDateString('zh-CN')}
                        </span>
                        {!d.isHandled && (
                          <span className={`text-sm font-bold ${isOverdue ? 'text-red-500' : days <= 7 ? 'text-orange-500' : 'text-blue-500'}`}>
                            {isOverdue ? `逾期 ${Math.abs(days)} 天` : `还有 ${days} 天`}
                          </span>
                        )}
                      </div>
                    </div>
                    {!d.isHandled && (
                      <Popconfirm title="确认标记为已处理？" onConfirm={() => handleMarkHandled(d.id)}>
                        <Button icon={<CheckOutlined />} size="small" className="rounded-xl">
                          已处理
                        </Button>
                      </Popconfirm>
                    )}
                    {d.isHandled && <Tag color="green">已处理</Tag>}
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
