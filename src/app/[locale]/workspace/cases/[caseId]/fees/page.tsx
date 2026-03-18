'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Form, Input, InputNumber, Select, DatePicker, Card, Tag, Spin, Empty, message, Statistic } from 'antd';
import { PlusOutlined, DollarOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import dayjs from 'dayjs';

interface FeeRecord {
  id: string;
  description: string;
  hours: string;
  amount: string;
  currency: string;
  workDate: string;
  visibility: string;
}

interface FeeSummary {
  totalAmount: number;
  totalHours: number;
  count: number;
}

export default function FeesPage() {
  const params = useParams();
  const caseId = params?.caseId as string;
  const router = useRouter();
  const [form] = Form.useForm();

  const [fees, setFees] = useState<FeeRecord[]>([]);
  const [summary, setSummary] = useState<FeeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const loadFees = useCallback(async () => {
    setLoading(true);
    try {
      const [feesRes, summaryRes] = await Promise.all([
        fetch(`/api/trpc/workspaceFee.list?input=${encodeURIComponent(JSON.stringify({ caseId }))}`),
        fetch(`/api/trpc/workspaceFee.getSummary?input=${encodeURIComponent(JSON.stringify({ caseId }))}`),
      ]);
      const [feesData, summaryData] = await Promise.all([feesRes.json(), summaryRes.json()]);
      setFees(feesData?.result?.data ?? []);
      setSummary(summaryData?.result?.data ?? null);
    } catch {
      setFees([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadFees();
  }, [loadFees]);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/trpc/workspaceFee.create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          description: values.description,
          hours: values.hours,
          amount: values.amount,
          currency: values.currency ?? 'CNY',
          workDate: values.workDate?.toISOString() ?? new Date().toISOString(),
          visibility: values.visibility ?? 'INTERNAL_ONLY',
        }),
      });
      if (res.ok) {
        message.success('费用记录已添加');
        form.resetFields();
        setShowForm(false);
        loadFees();
      } else {
        message.error('添加失败');
      }
    } catch {
      message.error('添加失败');
    } finally {
      setSubmitting(false);
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
            <h1 className="text-2xl font-bold text-gray-800 mt-1">费用记录</h1>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl"
            style={{ background: '#f97316', borderColor: '#f97316' }}
          >
            添加费用
          </Button>
        </div>

        {/* 汇总 */}
        {summary && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { title: '总金额', value: summary.totalAmount.toFixed(2), suffix: '元' },
              { title: '总工时', value: summary.totalHours.toFixed(1), suffix: '小时' },
              { title: '记录数', value: summary.count, suffix: '条' },
            ].map((s) => (
              <Card key={s.title} className="rounded-2xl shadow-sm text-center">
                <Statistic title={s.title} value={s.value} suffix={s.suffix} valueStyle={{ fontSize: 20, fontWeight: 700, color: '#f97316' }} />
              </Card>
            ))}
          </div>
        )}

        {showForm && (
          <Card className="rounded-2xl shadow-sm">
            <Form form={form} layout="vertical" onFinish={handleSubmit} size="large">
              <Form.Item label={<span className="font-semibold">工作描述</span>} name="description" rules={[{ required: true }]}>
                <Input.TextArea rows={2} placeholder="本次工作内容" className="rounded-xl" />
              </Form.Item>
              <div className="grid grid-cols-2 gap-4">
                <Form.Item label={<span className="font-semibold">工时（小时）</span>} name="hours" rules={[{ required: true }]}>
                  <InputNumber min={0} step={0.5} className="w-full rounded-xl" />
                </Form.Item>
                <Form.Item label={<span className="font-semibold">金额（元）</span>} name="amount" rules={[{ required: true }]}>
                  <InputNumber min={0} className="w-full rounded-xl" />
                </Form.Item>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Form.Item label={<span className="font-semibold">工作日期</span>} name="workDate" initialValue={dayjs()} rules={[{ required: true }]}>
                  <DatePicker className="w-full rounded-xl" />
                </Form.Item>
                <Form.Item label={<span className="font-semibold">可见性</span>} name="visibility" initialValue="INTERNAL_ONLY">
                  <Select options={[{ value: 'INTERNAL_ONLY', label: '仅内部' }, { value: 'CLIENT_VISIBLE', label: '客户可见' }]} className="rounded-xl" />
                </Form.Item>
              </div>
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
        ) : fees.length === 0 ? (
          <Empty description="暂无费用记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="space-y-3">
            {fees.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{f.description}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(f.workDate).toLocaleDateString('zh-CN')} · {f.hours} 小时
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-orange-500">{Number(f.amount).toFixed(2)} 元</p>
                    <Tag className="mt-1" color={f.visibility === 'CLIENT_VISIBLE' ? 'green' : 'default'}>
                      {f.visibility === 'CLIENT_VISIBLE' ? '客户可见' : '仅内部'}
                    </Tag>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
