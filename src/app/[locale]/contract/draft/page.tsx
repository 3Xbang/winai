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
      // In production, this would call tRPC: contract.draft.mutate(...)
      // Mock: simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockResult = `【${values.contractType === 'EMPLOYMENT' ? '劳动合同' : '合同'}】

甲方：${values.partyAName}
乙方：${values.partyBName}

第一条 合同目的
本合同由甲乙双方本着平等自愿、协商一致的原则签订。

第二条 权利义务
（根据合同类型自动生成具体条款）

第三条 适用法律
本合同适用${values.governingLaw}。

第四条 争议解决
${values.disputeResolution}

${values.specialClauses ? `第五条 特殊条款\n${values.specialClauses}` : ''}

免责声明：本合同由AI系统生成，仅供参考，不构成正式法律意见。建议在签署前咨询专业律师。`;

      setResult(mockResult);
    } catch {
      message.error(tCommon('error'));
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
