'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Select, DatePicker, Button, Alert, Card, message, Tag } from 'antd';
import { WarningOutlined, CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
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

// 大类 → 编号前缀（固定，不需要翻译）
const TYPE_PREFIX: Record<string, string> = {
  civil: 'C',
  criminal: 'CR',
  family: 'F',
  administrative: 'A',
  crossborder: 'X',
};

// 子类 key 列表（对应 messages 中的 key）
const CASE_TYPE_KEYS: Record<string, string[]> = {
  civil: ['contract', 'tort', 'labor', 'ip', 'property', 'debt', 'equity', 'other'],
  criminal: ['defense', 'civilAttachment', 'bail', 'appeal', 'other'],
  family: ['divorce', 'property', 'custody', 'inheritance', 'adoption', 'other'],
  administrative: ['litigation', 'reconsideration', 'compensation', 'other'],
  crossborder: ['cnThaiContract', 'foreignLabor', 'visaImmigration', 'crossBorderInvestment', 'internationalTrade', 'other'],
};

const CATEGORY_KEYS = ['civil', 'criminal', 'family', 'administrative', 'crossborder'];

function generateCaseNumber(category: string): string {
  const year = new Date().getFullYear();
  const prefix = TYPE_PREFIX[category] ?? 'X';
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `${year}-${prefix}-${seq}`;
}

export default function NewCasePage() {
  const router = useRouter();
  const t = useTranslations('workspace');
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<ConflictResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [aiSuggesting, setAiSuggesting] = useState(false);

  useEffect(() => {
    form.setFieldValue('caseNumber', generateCaseNumber('civil'));
  }, [form]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    form.setFieldValue('caseType', undefined);
    const current = form.getFieldValue('caseNumber') as string;
    const year = new Date().getFullYear();
    const seq = current?.split('-')[2] ?? String(Math.floor(Math.random() * 900) + 100);
    form.setFieldValue('caseNumber', `${year}-${TYPE_PREFIX[category] ?? 'X'}-${seq}`);
  };

  const handleAiSuggest = async () => {
    const description = form.getFieldValue('description') as string;
    if (!description?.trim()) {
      message.warning(t('aiSuggestWarning'));
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
        const catLabel = t(`caseCategories.${suggestion.category}`);
        const typeLabel = t(`caseTypes.${suggestion.category}.${suggestion.caseType}` as any);
        message.success(`AI: ${catLabel} · ${typeLabel}`);
      }
    } catch {
      // silent fail
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
        message.error(data?.error?.message ?? t('createFailed'));
        return;
      }
      const caseId = data?.result?.data?.case?.id;
      message.success(t('createSuccess'));
      router.push(`/workspace/cases/${caseId}` as any);
    } catch {
      message.error(t('createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const subTypeOptions = selectedCategory
    ? (CASE_TYPE_KEYS[selectedCategory] ?? []).map((key) => ({
        value: key,
        label: t(`caseTypes.${selectedCategory}.${key}` as any),
      }))
    : [];

  const categoryOptions = CATEGORY_KEYS.map((key) => ({
    value: key,
    label: t(`caseCategories.${key}` as any),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Button type="link" onClick={() => router.push('/workspace/cases')} className="px-0">
            ← {t('backToCases')}
          </Button>
          <h1 className="text-3xl font-bold text-gray-800 mt-2">{t('newCase')}</h1>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false} size="large">

            {/* 案件描述 + AI 推荐 */}
            <Form.Item
              label={
                <span className="font-semibold flex items-center gap-2">
                  {t('caseDescription')}
                  <Tag color="blue" className="text-xs font-normal">{t('caseDescriptionHint')}</Tag>
                </span>
              }
              name="description"
            >
              <Input.TextArea rows={3} className="rounded-xl" />
            </Form.Item>
            <div className="mb-4 -mt-2">
              <Button
                icon={<ThunderboltOutlined />}
                onClick={handleAiSuggest}
                loading={aiSuggesting}
                className="rounded-xl"
                style={{ borderColor: '#f97316', color: '#f97316' }}
              >
                {t('aiSuggest')}
              </Button>
            </div>

            {/* 案件大类 */}
            <Form.Item
              label={<span className="font-semibold">{t('caseCategory')}</span>}
              name="caseCategory"
              rules={[{ required: true, message: t('caseCategory') }]}
            >
              <Select
                placeholder={t('caseCategoryPlaceholder')}
                className="rounded-xl"
                onChange={handleCategoryChange}
                options={categoryOptions}
              />
            </Form.Item>

            {/* 具体案由 */}
            <Form.Item
              label={<span className="font-semibold">{t('caseType')}</span>}
              name="caseType"
              rules={[{ required: true, message: t('caseType') }]}
            >
              <Select
                placeholder={selectedCategory ? t('caseTypePlaceholder') : t('caseTypePlaceholderDisabled')}
                className="rounded-xl"
                disabled={!selectedCategory}
                options={subTypeOptions}
              />
            </Form.Item>

            {/* 案件编号 */}
            <Form.Item
              label={
                <span className="font-semibold flex items-center gap-2">
                  {t('caseNumber')}
                  <Tag color="green" className="text-xs font-normal">{t('caseNumberHint')}</Tag>
                </span>
              }
              name="caseNumber"
              rules={[{ required: true, message: t('caseNumber') }]}
            >
              <Input className="rounded-xl font-mono" />
            </Form.Item>

            {/* 案件名称 */}
            <Form.Item
              label={<span className="font-semibold">{t('caseTitle')}</span>}
              name="title"
              rules={[{ required: true, message: t('caseTitle') }]}
            >
              <Input placeholder={t('caseTitlePlaceholder')} className="rounded-xl" />
            </Form.Item>

            {/* 当事人 */}
            <Form.Item
              label={<span className="font-semibold">{t('clientName')}</span>}
              name="clientName"
              rules={[{ required: true, message: t('clientName') }]}
            >
              <Input placeholder={t('clientNamePlaceholder')} className="rounded-xl" />
            </Form.Item>

            {/* 对立方 */}
            <Form.Item
              label={<span className="font-semibold">{t('opposingParty')}</span>}
              name="opposingParty"
              extra={t('opposingPartyHint')}
            >
              <Input
                placeholder={t('opposingPartyPlaceholder')}
                className="rounded-xl"
                onBlur={(e) => checkConflict(e.target.value)}
              />
            </Form.Item>

            {checkingConflict && (
              <Alert message={t('checkingConflict')} type="info" showIcon className="mb-4 rounded-xl" />
            )}
            {conflict && !checkingConflict && (
              <Alert
                className="mb-4 rounded-xl"
                type={conflict.hasConflict ? 'warning' : 'success'}
                icon={conflict.hasConflict ? <WarningOutlined /> : <CheckCircleOutlined />}
                showIcon
                message={conflict.hasConflict ? t('conflictFound') : t('noConflict')}
                description={
                  conflict.hasConflict ? (
                    <ul className="mt-2 space-y-1">
                      {conflict.conflictingCases.map((c) => (
                        <li key={c.id} className="text-sm">
                          {c.caseNumber} · {c.title}（{c.clientName}）
                        </li>
                      ))}
                    </ul>
                  ) : undefined
                }
              />
            )}

            {/* 立案日期 */}
            <Form.Item
              label={<span className="font-semibold">{t('filedAt')}</span>}
              name="filedAt"
              rules={[{ required: true, message: t('filedAt') }]}
              initialValue={dayjs()}
            >
              <DatePicker className="w-full rounded-xl" />
            </Form.Item>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => router.push('/workspace/cases')} size="large" className="flex-1 rounded-xl">
                {t('cancel')}
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={submitting}
                className="flex-1 rounded-xl"
                style={{ background: '#f97316', borderColor: '#f97316' }}
              >
                {t('createCase')}
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}
