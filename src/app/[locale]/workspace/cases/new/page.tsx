'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, DatePicker, Button, Alert, Card, message, Tag } from 'antd';
import { WarningOutlined, CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
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

// 案件大类 → 子类映射
const CASE_TYPE_MAP: Record<string, { label: string; children: string[] }> = {
  civil: {
    label: '民事',
    children: ['合同纠纷', '侵权纠纷', '劳动争议', '知识产权', '房产纠纷', '债权债务', '公司股权', '其他民事'],
  },
  criminal: {
    label: '刑事',
    children: ['刑事辩护', '刑事附带民事', '取保候审', '申诉再审', '其他刑事'],
  },
  family: {
    label: '家事',
    children: ['离婚纠纷', '财产分割', '子女抚养', '继承纠纷', '收养纠纷', '其他家事'],
  },
  administrative: {
    label: '行政',
    children: ['行政诉讼', '行政复议', '行政赔偿', '其他行政'],
  },
  crossborder: {
    label: '涉外/跨境',
    children: ['中泰跨境合同', '外籍人员劳动', '签证移民', '跨境投资', '国际贸易', '其他涉外'],
  },
};

// 大类 → 编号前缀
const TYPE_PREFIX: Record<string, string> = {
  civil: '民',
  criminal: '刑',
  family: '家',
  administrative: '行',
  crossborder: '涉',
};

function generateCaseNumber(category: string): string {
  const year = new Date().getFullYear();
  const prefix = TYPE_PREFIX[category] ?? '案';
  const seq = String(Math.floor(Math.random() * 900) + 100); // 100-999
  return `${year}-${prefix}-${seq}`;
}

export default function NewCasePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [aiSuggesting, setAiSuggesting] = useState(false);

  // 初始化时自动生成编号
  useEffect(() => {
    form.setFieldValue('caseNumber', generateCaseNumber('civil'));
  }, [form]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    form.setFieldValue('caseType', undefined);
    // 更新编号前缀
    const current = form.getFieldValue('caseNumber') as string;
    const year = new Date().getFullYear();
    const seq = current?.split('-')[2] ?? String(Math.floor(Math.random() * 900) + 100);
    form.setFieldValue('caseNumber', `${year}-${TYPE_PREFIX[category] ?? '案'}-${seq}`);
  };

  // AI 根据案件描述推荐案由
  const handleAiSuggest = async () => {
    const description = form.getFieldValue('description') as string;
    if (!description?.trim()) {
      message.warning('请先填写案件描述');
      return;
    }
    setAiSuggesting(true);
    try {
      const res = await fetch('/api/trpc/workspaceCase.suggestCaseType', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      const suggestion = data?.result?.data;
      if (suggestion?.category && suggestion?.caseType) {
        setSelectedCategory(suggestion.category);
        form.setFieldsValue({
          caseType: suggestion.caseType,
          caseNumber: generateCaseNumber(suggestion.category),
        });
        message.success(`AI 推荐：${CASE_TYPE_MAP[suggestion.category]?.label} · ${suggestion.caseType}`);
      }
    } catch {
      // 静默失败
    } finally {
      setAiSuggesting(false);
    }
  };

  const checkConflict = async (opposingParty: string) => {
    if (!opposingParty.trim()) { setConflict(null); return; }
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

  const subTypeOptions = selectedCategory
    ? CASE_TYPE_MAP[selectedCategory]?.children.map((v) => ({ value: v, label: v }))
    : [];

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
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">

            {/* 案件描述 + AI 推荐 */}
            <Form.Item
              label={
                <span className="font-semibold flex items-center gap-2">
                  案件描述
                  <Tag color="blue" className="text-xs font-normal">AI 可根据描述自动推荐案由</Tag>
                </span>
              }
              name="description"
            >
              <Input.TextArea
                placeholder="简要描述案件情况，例如：当事人与前妻因房产分割产生纠纷，涉及两套房产和一个孩子的抚养权..."
                rows={3}
                className="rounded-xl"
              />
            </Form.Item>
            <div className="mb-4 -mt-2">
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleAiSuggest}
                loading={aiSuggesting}
                className="rounded-xl"
                style={{ borderColor: '#f97316', color: '#f97316' }}
              >
                AI 智能推荐案由
              </Button>
            </div>

            {/* 案件大类 */}
            <Form.Item
              label={<span className="font-semibold">案件类别</span>}
              name="caseCategory"
              rules={[{ required: true, message: '请选择案件类别' }]}
            >
              <Select
                placeholder="选择案件类别（民事 / 刑事 / 家事 / 行政 / 涉外）"
                className="rounded-xl"
                onChange={handleCategoryChange}
                options={Object.entries(CASE_TYPE_MAP).map(([k, v]) => ({
                  value: k,
                  label: v.label,
                }))}
              />
            </Form.Item>

            {/* 具体案由 */}
            <Form.Item
              label={<span className="font-semibold">具体案由</span>}
              name="caseType"
              rules={[{ required: true, message: '请选择具体案由' }]}
            >
              <Select
                placeholder={selectedCategory ? '选择具体案由' : '请先选择案件类别'}
                className="rounded-xl"
                disabled={!selectedCategory}
                options={subTypeOptions}
              />
            </Form.Item>

            {/* 案件编号（自动生成，可修改） */}
            <Form.Item
              label={
                <span className="font-semibold flex items-center gap-2">
                  案件编号
                  <Tag color="green" className="text-xs font-normal">已自动生成，可修改</Tag>
                </span>
              }
              name="caseNumber"
              rules={[{ required: true, message: '请输入案件编号' }]}
            >
              <Input className="rounded-xl font-mono" />
            </Form.Item>

            {/* 案件名称 */}
            <Form.Item
              label={<span className="font-semibold">案件名称</span>}
              name="title"
              rules={[{ required: true, message: '请输入案件名称' }]}
            >
              <Input placeholder="例：张三与李四合同纠纷案" className="rounded-xl" />
            </Form.Item>

            {/* 当事人 */}
            <Form.Item
              label={<span className="font-semibold">当事人姓名</span>}
              name="clientName"
              rules={[{ required: true, message: '请输入当事人姓名' }]}
            >
              <Input placeholder="委托人姓名或公司名称" className="rounded-xl" />
            </Form.Item>

            {/* 对立方 */}
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

            {/* 立案日期 */}
            <Form.Item
              label={<span className="font-semibold">立案日期</span>}
              name="filedAt"
              rules={[{ required: true, message: '请选择立案日期' }]}
              initialValue={dayjs()}
            >
              <DatePicker className="w-full rounded-xl" />
            </Form.Item>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => router.push('/workspace/cases')} size="large" className="flex-1 rounded-xl">
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
