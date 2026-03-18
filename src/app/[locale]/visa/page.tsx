'use client';

import { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Input,
  Button,
  Typography,
  Tag,
  Collapse,
  Steps,
  Spin,
  Progress,
  Empty,
  message,
} from 'antd';
import {
  GlobalOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DollarOutlined,
  FileTextOutlined,
  SolutionOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Option } = Select;

const PURPOSES = ['TOURISM', 'BUSINESS', 'WORK', 'RETIREMENT', 'EDUCATION', 'FAMILY', 'INVESTMENT', 'DIGITAL_NOMAD'] as const;
const DURATIONS = ['SHORT', 'MEDIUM', 'LONG', 'EXTENDED'] as const;
const BUDGETS = ['LOW', 'MEDIUM', 'HIGH', 'PREMIUM'] as const;
const CURRENT_VISA_TYPES = ['NONE', 'TOURIST', 'NON_B', 'NON_O', 'EDUCATION', 'RETIREMENT', 'ELITE', 'OTHER'] as const;
interface ProcessStep {
  step: number;
  description: string;
  estimatedDuration?: string;
}

interface CostEstimate {
  amount: string;
  currency: string;
  breakdown?: Record<string, string>;
}

interface VisaRecommendation {
  visaType: string;
  matchScore: number;
  requirements: string[];
  documents: string[];
  process: ProcessStep[];
  estimatedCost: CostEstimate;
  commonRejectionReasons: string[];
  avoidanceAdvice: string[];
  processingTime?: string;
}

interface VisaFormValues {
  nationality: string;
  currentVisaType: string;
  purpose: string;
  duration: string;
  occupation: string;
  budget: string;
}

function getMatchScoreColor(score: number): string {
  if (score >= 80) return '#52c41a';
  if (score >= 60) return '#faad14';
  return '#ff4d4f';
}

function VisaResultCard({
  recommendation,
  index,
  t,
}: {
  recommendation: VisaRecommendation;
  index: number;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  return (
    <Card
      className="mb-4"
      data-testid={`visa-result-${index}`}
      title={
        <div className="flex items-center justify-between">
          <span>
            <GlobalOutlined className="mr-2" />
            {recommendation.visaType}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('results.matchScore')}:</span>
            <Progress
              type="circle"
              percent={recommendation.matchScore}
              size={40}
              strokeColor={getMatchScoreColor(recommendation.matchScore)}
              data-testid={`match-score-${index}`}
            />
          </div>
        </div>
      }
    >
      <Collapse
        defaultActiveKey={index === 0 ? ['requirements', 'process'] : []}
        items={[
          {
            key: 'requirements',
            label: (
              <span>
                <CheckCircleOutlined className="mr-1" />
                {t('results.requirements')}
              </span>
            ),
            children: (
              <ul className="list-disc list-inside" data-testid={`requirements-${index}`}>
                {recommendation.requirements.map((req, i) => (
                  <li key={i} className="text-sm mb-1">{req}</li>
                ))}
              </ul>
            ),
          },
          {
            key: 'documents',
            label: (
              <span>
                <FileTextOutlined className="mr-1" />
                {t('results.documents')}
              </span>
            ),
            children: (
              <ul className="list-disc list-inside" data-testid={`documents-${index}`}>
                {recommendation.documents.map((doc, i) => (
                  <li key={i} className="text-sm mb-1">{doc}</li>
                ))}
              </ul>
            ),
          },
          {
            key: 'process',
            label: (
              <span>
                <SolutionOutlined className="mr-1" />
                {t('results.process')}
              </span>
            ),
            children: (
              <Steps
                direction="vertical"
                size="small"
                current={-1}
                items={recommendation.process.map((step) => ({
                  title: t('results.step', { num: step.step }),
                  description: (
                    <div data-testid={`process-step-${index}-${step.step}`}>
                      <p className="text-sm">{step.description}</p>
                      {step.estimatedDuration && (
                        <Tag className="mt-1">{t('results.estimatedDuration')}: {step.estimatedDuration}</Tag>
                      )}
                    </div>
                  ),
                }))}
                data-testid={`process-steps-${index}`}
              />
            ),
          },
          {
            key: 'cost',
            label: (
              <span>
                <DollarOutlined className="mr-1" />
                {t('results.estimatedCost')}
              </span>
            ),
            children: (
              <div data-testid={`cost-${index}`}>
                <Typography.Text strong>
                  {recommendation.estimatedCost.amount} {recommendation.estimatedCost.currency}
                </Typography.Text>
                {recommendation.estimatedCost.breakdown && (
                  <div className="mt-2">
                    <Typography.Text type="secondary" className="text-sm">
                      {t('results.costBreakdown')}:
                    </Typography.Text>
                    <ul className="list-disc list-inside mt-1 text-sm">
                      {Object.entries(recommendation.estimatedCost.breakdown).map(([key, value]) => (
                        <li key={key}>{key}: {value}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: 'risks',
            label: (
              <span>
                <WarningOutlined className="mr-1" />
                {t('results.rejectionRisks')}
              </span>
            ),
            children: (
              <div data-testid={`risks-${index}`}>
                <div className="mb-3">
                  <Typography.Text strong type="danger">{t('results.rejectionRisks')}:</Typography.Text>
                  <ul className="list-disc list-inside mt-1">
                    {recommendation.commonRejectionReasons.map((reason, i) => (
                      <li key={i} className="text-sm text-red-600 mb-1">{reason}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Typography.Text strong className="text-green-600">{t('results.avoidanceAdvice')}:</Typography.Text>
                  <ul className="list-disc list-inside mt-1">
                    {recommendation.avoidanceAdvice.map((advice, i) => (
                      <li key={i} className="text-sm text-green-700 mb-1">{advice}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ),
          },
        ]}
        data-testid={`visa-collapse-${index}`}
      />
      {recommendation.processingTime && (
        <div className="mt-3 text-sm text-gray-500" data-testid={`processing-time-${index}`}>
          {t('results.processingTime')}: {recommendation.processingTime}
        </div>
      )}
    </Card>
  );
}

export default function VisaPage() {
  const t = useTranslations('visa');
  const tCommon = useTranslations('common');
  const [form] = Form.useForm<VisaFormValues>();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<VisaRecommendation[] | null>(null);

  const handleAnalyze = async (values: VisaFormValues) => {
    setLoading(true);
    setResults(null);

    try {
      const res = await fetch('/api/visa/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '推荐失败');
      }

      const data = await res.json();
      setResults(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" data-testid="visa-title">
          <GlobalOutlined className="mr-2" />
          {t('title')}
        </h1>
        <p className="text-gray-500 mb-6" data-testid="visa-subtitle">{t('subtitle')}</p>

        {/* Visa Consultation Form */}
        <Card className="mb-6">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAnalyze}
            data-testid="visa-form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="nationality"
                label={t('form.nationality')}
                rules={[{ required: true, message: t('form.nationalityPlaceholder') }]}
              >
                <Input placeholder={t('form.nationalityPlaceholder')} data-testid="nationality-input" />
              </Form.Item>

              <Form.Item
                name="currentVisaType"
                label={t('form.currentVisaType')}
              >
                <Select placeholder={t('form.currentVisaTypePlaceholder')} data-testid="current-visa-select">
                  {CURRENT_VISA_TYPES.map((type) => (
                    <Option key={type} value={type}>
                      {t(`currentVisaTypes.${type}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="purpose"
                label={t('form.purpose')}
                rules={[{ required: true, message: t('form.purposePlaceholder') }]}
              >
                <Select placeholder={t('form.purposePlaceholder')} data-testid="purpose-select">
                  {PURPOSES.map((purpose) => (
                    <Option key={purpose} value={purpose}>
                      {t(`purposes.${purpose}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="duration"
                label={t('form.duration')}
                rules={[{ required: true, message: t('form.durationPlaceholder') }]}
              >
                <Select placeholder={t('form.durationPlaceholder')} data-testid="duration-select">
                  {DURATIONS.map((duration) => (
                    <Option key={duration} value={duration}>
                      {t(`durations.${duration}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="occupation"
                label={t('form.occupation')}
              >
                <Input placeholder={t('form.occupationPlaceholder')} data-testid="occupation-input" />
              </Form.Item>

              <Form.Item
                name="budget"
                label={t('form.budget')}
              >
                <Select placeholder={t('form.budgetPlaceholder')} data-testid="budget-select">
                  {BUDGETS.map((budget) => (
                    <Option key={budget} value={budget}>
                      {t(`budgets.${budget}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<GlobalOutlined />}
                data-testid="analyze-btn"
              >
                {loading ? t('analyzing') : t('analyze')}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Loading */}
        {loading && (
          <Card className="text-center py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-500">{t('analyzing')}</p>
          </Card>
        )}

        {/* Results */}
        {results && (
          <div data-testid="visa-results">
            <h2 className="text-xl font-semibold mb-4">{t('results.title')}</h2>
            {results.length === 0 ? (
              <Empty description={t('results.noResults')} data-testid="no-results" />
            ) : (
              results.map((rec, index) => (
                <VisaResultCard
                  key={index}
                  recommendation={rec}
                  index={index}
                  t={t}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
