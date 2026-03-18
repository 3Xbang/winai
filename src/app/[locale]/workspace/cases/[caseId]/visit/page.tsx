'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Form, Input, DatePicker, Card, Spin, Empty, message, Alert } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import dayjs from 'dayjs';

interface VisitRecord {
  id: string;
  visitedAt: string;
  outcome: string;
  nextSteps: string;
  summary: string | null;
}

export default function VisitPage() {
  const params = useParams();
  const caseId = params?.caseId as string;
  const router = useRouter();
  const [form] = Form.useForm();

  const [records, setRecords] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceVisit.listRecords?input=${input}`);
      const data = await res.json();
      setRecords(data?.result?.data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleGenerateSummary = async () => {
    setGeneratingSummary(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceVisit.generateSummary?input=${input}`);
      const data = await res.json();
      setAiSummary(data?.result?.data?.summary ?? null);
    } catch {
      message.error('生成失败，请重试');
    } finally {
      setGeneratingSummary(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/trpc/workspaceVisit.saveRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          visitedAt: values.visitedAt?.toISOString() ?? new Date().toISOString(),
          summary: aiSummary ?? undefined,
          outcome: values.outcome,
          nextSteps: values.nextSteps,
        }),
      });
      if (res.ok) {
        message.success('会见记录已保存');
        form.resetFields();
        setAiSummary(null);
        loadRecords();
      } else {
        message.error('保存失败，请重试');
      }
    } catch {
      message.error('保存失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <Button type="link" onClick={() => router.push(`/workspace/cases/${caseId}` as any)} className="px-0">
            ← 返回案件详情
          </Button>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">会见记录</h1>
        </div>

        {/* AI 摘要生成 */}
        <Card className="rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <RobotOutlined className="text-teal-500" />
              会见前摘要（AI 辅助）
            </h2>
            <Button
              onClick={handleGenerateSummary}
              loading={generatingSummary}
              className="rounded-xl"
              style={{ borderColor: '#14b8a6', color: '#14b8a6' }}
            >
              生成摘要
            </Button>
          </div>
          {aiSummary ? (
            <Alert
              type="info"
              message="AI 生成的会见前摘要"
              description={<p className="whitespace-pre-wrap text-sm mt-2">{aiSummary}</p>}
              className="rounded-xl"
            />
          ) : (
            <p className="text-gray-400 text-sm">点击"生成摘要"，AI 将基于案件时间线和历史会见记录生成摘要</p>
          )}
        </Card>

        {/* 新建会见记录 */}
        <Card title={<span className="font-bold">记录本次会见</span>} className="rounded-2xl shadow-sm">
          <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
            <Form.Item
              label={<span className="font-semibold">会见日期</span>}
              name="visitedAt"
              initialValue={dayjs()}
              rules={[{ required: true }]}
            >
              <DatePicker className="w-full rounded-xl" />
            </Form.Item>
            <Form.Item
              label={<span className="font-semibold">处理结果</span>}
              name="outcome"
              rules={[{ required: true, message: '请填写处理结果' }]}
            >
              <Input.TextArea rows={3} placeholder="本次会见的主要结论和处理结果" className="rounded-xl" />
            </Form.Item>
            <Form.Item
              label={<span className="font-semibold">下一步策略</span>}
              name="nextSteps"
              rules={[{ required: true, message: '请填写下一步策略' }]}
            >
              <Input.TextArea rows={3} placeholder="下一步的行动计划和策略" className="rounded-xl" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              className="w-full rounded-xl"
              style={{ background: '#f97316', borderColor: '#f97316' }}
            >
              保存会见记录
            </Button>
          </Form>
        </Card>

        {/* 历史记录 */}
        <div>
          <h2 className="text-lg font-bold text-gray-800 mb-3">历史会见记录</h2>
          {loading ? (
            <div className="flex justify-center py-10"><Spin /></div>
          ) : records.length === 0 ? (
            <Empty description="暂无会见记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="space-y-3">
              {records.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm">
                  <p className="text-sm text-gray-400 mb-2">
                    {new Date(r.visitedAt).toLocaleDateString('zh-CN')}
                  </p>
                  <p className="font-semibold text-gray-800 mb-1">{r.outcome}</p>
                  <p className="text-sm text-teal-600">→ {r.nextSteps}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
