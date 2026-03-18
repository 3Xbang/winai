'use client';

import { useState } from 'react';
import { Form, Input, Select, DatePicker, Button, Alert, Card, message } from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useRouter } from '@/i18n/navigation';
import dayjs from 'dayjs';

interface ConflictResult {
  hasConflict: boolean;
  conflictingCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
    opposingParty: string | null;
  }>;
}

export default function NewCasePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);

  const checkConflict = async (opposingParty: string) => {
    if (!opposingParty.trim()) {
      setConflict(null);
      return;
    }
    setCheckingConflict(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ opposingParty }));
      const res = await fetch(`/api/trpc/workspaceCase.checkConflict?input=${input}`);
      const data = await res.json();
      setConflict(data?.result?.data ?? null);
    } catch {
      setConflict(null);
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/trpc/workspaceCase.createCase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...values,
          filedAt: values.filedAt?.toISOString() ?? new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        message.error(data?.error?.message ?? '创建失败，请重试');
        return;
      }
      const caseId = data?.result?.data?.case?.id;
      message.success('案件创建成功');
      router.push(`/workspace/cases/${caseId}` as any);
    } catch {
      message.error('创建失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button type="link" onClick={() => router.push('/workspace/cases')} className="px-0">
            ← 返回案件列表
          </Button>
          <h1 className="text-3xl font-bold text-gray-800 mt-2">新建案件</h1>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            requiredMark={false}
            size="large"
          >
            <Form.Item
              label={<span className="font-semibold">案件编号</span>}
              name="caseNumber"
              rules={[{ required: true, message: '请输入案件编号' }]}
            >
              <Input placeholder="例：2024-民-001" className="rounded-xl" />
            </Form.Item>

            <Form.Item
              label={<span className="font-semibold">案件名称</span>}
              name="title"
              rules={[{ required: true, message: '请输入案件名称' }]}
            >
              <Input placeholder="例：张三与李四合同纠纷案" className="rounded-xl" />
            </Form.Item>

            <Form.Item
              label={<span className="font-semibold">案由</span>}
              name="caseType"
              rules={[{ required: true, message: '请选择案由' }]}
            >
              <Select
                placeholder="选择案由"
                className="rounded-xl"
                options={[
                  { value: '合同纠纷', label: '合同纠纷' },
                  { value: '侵权纠纷', label: '侵权纠纷' },
                  { value: '劳动争议', label: '劳动争议' },
                  { value: '知识产权', label: '知识产权' },
                  { value: '婚姻家庭', label: '婚姻家庭' },
                  { value: '刑事辩护', label: '刑事辩护' },
                  { value: '行政诉讼', label: '行政诉讼' },
                  { value: '其他', label: '其他' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label={<span className="font-semibold">当事人姓名</span>}
              name="clientName"
              rules={[{ required: true, message: '请输入当事人姓名' }]}
            >
              <Input placeholder="委托人姓名或公司名称" className="rounded-xl" />
            </Form.Item>

            <Form.Item
              label={<span className="font-semibold">对立方信息</span>}
              name="opposingParty"
              extra="填写后将自动检查利益冲突"
            >
              <Input
                placeholder="对方当事人姓名或公司名称（选填）"
                className="rounded-xl"
                onBlur={(e) => checkConflict(e.target.value)}
              />
            </Form.Item>

            {/* 冲突检查结果 */}
            {checkingConflict && (
              <Alert message="正在检查利益冲突..." type="info" showIcon className="mb-4 rounded-xl" />
            )}
            {conflict && !checkingConflict && (
              <Alert
                className="mb-4 rounded-xl"
                type={conflict.hasConflict ? 'warning' : 'success'}
                icon={conflict.hasConflict ? <WarningOutlined /> : <CheckCircleOutlined />}
                showIcon
                message={conflict.hasConflict ? '发现潜在利益冲突' : '未发现利益冲突'}
                description={
                  conflict.hasConflict ? (
                    <ul className="mt-2 space-y-1">
                      {conflict.conflictingCases.map((c) => (
                        <li key={c.id} className="text-sm">
                          {c.caseNumber} · {c.title}（当事人：{c.clientName}）
                        </li>
                      ))}
                    </ul>
                  ) : undefined
                }
              />
            )}

            <Form.Item
              label={<span className="font-semibold">立案日期</span>}
              name="filedAt"
              rules={[{ required: true, message: '请选择立案日期' }]}
              initialValue={dayjs()}
            >
              <DatePicker className="w-full rounded-xl" />
            </Form.Item>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => router.push('/workspace/cases')}
                size="large"
                className="flex-1 rounded-xl"
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={submitting}
                className="flex-1 rounded-xl"
                style={{ background: '#f97316', borderColor: '#f97316' }}
              >
                创建案件
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}
