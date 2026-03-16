'use client';

import { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Input,
  Button,
  Typography,
  Divider,
  Checkbox,
  Spin,
  message,
} from 'antd';
import { FileTextOutlined, CopyOutlined, CheckOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const { TextArea } = Input;
const { Option } = Select;

const CONTRACT_TYPES = ['EMPLOYMENT', 'SALE', 'SERVICE', 'LEASE', 'PARTNERSHIP', 'OTHER'] as const;
const LANGUAGES = ['zh', 'en', 'th'] as const;

interface DraftFormValues {
  contractType: string;
  partyAName: string;
  partyARole: string;
  partyANationality?: string;
  partyAAddress?: string;
  partyBName: string;
  partyBRole: string;
  partyBNationality?: string;
  partyBAddress?: string;
  governingLaw: string;
  disputeResolution: string;
  languages: string[];
  specialClauses?: string;
}

export default function ContractDraftPage() {
  const t = useTranslations('contract.draft');
  const tCommon = useTranslations('common');
  const [form] = Form.useForm<DraftFormValues>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (values: DraftFormValues) => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/contract/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '合同生成失败');
      }

      setResult(data.content);
    } catch (err) {
      message.error(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result) {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link href="/contract">
            <Button type="link" icon={<ArrowLeftOutlined />} className="!px-0">
              {tCommon('back')}
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6" data-testid="draft-title">
          <FileTextOutlined className="mr-2" />
          {t('title')}
        </h1>

        <Card className="mb-6">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleGenerate}
            initialValues={{
              partyARole: '甲方',
              partyBRole: '乙方',
              languages: ['zh'],
            }}
            data-testid="draft-form"
          >
            {/* Contract Type */}
            <Form.Item
              name="contractType"
              label={t('contractType')}
              rules={[{ required: true, message: t('selectType') }]}
            >
              <Select
                placeholder={t('selectType')}
                size="large"
                data-testid="contract-type-select"
              >
                {CONTRACT_TYPES.map((type) => (
                  <Option key={type} value={type}>
                    {t(`types.${type}`)}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Divider>{t('partyInfo')}</Divider>

            {/* Party A */}
            <Typography.Text strong className="block mb-3">
              {t('partyA')}
            </Typography.Text>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Form.Item
                name="partyAName"
                label={t('partyName')}
                rules={[{ required: true }]}
              >
                <Input data-testid="party-a-name" />
              </Form.Item>
              <Form.Item name="partyARole" label={t('partyRole')}>
                <Input />
              </Form.Item>
              <Form.Item name="partyANationality" label={t('partyNationality')}>
                <Input />
              </Form.Item>
              <Form.Item name="partyAAddress" label={t('partyAddress')}>
                <Input />
              </Form.Item>
            </div>

            {/* Party B */}
            <Typography.Text strong className="block mb-3">
              {t('partyB')}
            </Typography.Text>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Form.Item
                name="partyBName"
                label={t('partyName')}
                rules={[{ required: true }]}
              >
                <Input data-testid="party-b-name" />
              </Form.Item>
              <Form.Item name="partyBRole" label={t('partyRole')}>
                <Input />
              </Form.Item>
              <Form.Item name="partyBNationality" label={t('partyNationality')}>
                <Input />
              </Form.Item>
              <Form.Item name="partyBAddress" label={t('partyAddress')}>
                <Input />
              </Form.Item>
            </div>

            <Divider>{t('keyTerms')}</Divider>

            {/* Key Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="governingLaw"
                label={t('governingLaw')}
                rules={[{ required: true }]}
              >
                <Input data-testid="governing-law" />
              </Form.Item>
              <Form.Item
                name="disputeResolution"
                label={t('disputeResolution')}
                rules={[{ required: true }]}
              >
                <Input data-testid="dispute-resolution" />
              </Form.Item>
            </div>

            <Form.Item name="languages" label={t('language')}>
              <Checkbox.Group data-testid="language-checkboxes">
                {LANGUAGES.map((lang) => (
                  <Checkbox key={lang} value={lang}>
                    {lang === 'zh' ? '中文' : lang === 'en' ? 'English' : 'ภาษาไทย'}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>

            <Form.Item name="specialClauses" label={t('specialClauses')}>
              <TextArea rows={3} data-testid="special-clauses" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<FileTextOutlined />}
                data-testid="generate-btn"
              >
                {loading ? t('generating') : t('generate')}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Result */}
        {loading && (
          <Card className="text-center py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-500">{t('generating')}</p>
          </Card>
        )}

        {result && (
          <Card
            title={t('result')}
            extra={
              <Button
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
                data-testid="copy-btn"
              >
                {copied ? t('copied') : t('copyText')}
              </Button>
            }
            data-testid="draft-result"
          >
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
              {result}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}
