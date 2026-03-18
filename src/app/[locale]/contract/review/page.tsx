'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  Input,
  Select,
  Tabs,
  Tag,
  Typography,
  Spin,
  Divider,
  message,
} from 'antd';
import {
  AuditOutlined,
  ArrowLeftOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import FileUpload from '@/components/chat/FileUpload';

const { TextArea } = Input;

type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

interface RiskItem {
  clauseIndex: number;
  clauseText: string;
  riskLevel: RiskLevel;
  riskDescription: string;
  legalBasis: { lawName: string; articleNumber?: string; description: string }[];
  suggestedRevision: string;
}

interface ReviewResult {
  risks: RiskItem[];
  overallRiskLevel: RiskLevel;
  reviewReport: string;
}

const RISK_CONFIG: Record<RiskLevel, { color: string; tagColor: string; icon: React.ReactNode }> = {
  HIGH: { color: 'text-red-600', tagColor: 'red', icon: <WarningOutlined /> },
  MEDIUM: { color: 'text-orange-500', tagColor: 'orange', icon: <ExclamationCircleOutlined /> },
  LOW: { color: 'text-green-600', tagColor: 'green', icon: <CheckCircleOutlined /> },
};

function RiskLevelTag({ level, t }: { level: RiskLevel; t: (key: string) => string }) {
  const config = RISK_CONFIG[level];
  const labelKey = level === 'HIGH' ? 'riskHigh' : level === 'MEDIUM' ? 'riskMedium' : 'riskLow';
  return (
    <Tag color={config.tagColor} icon={config.icon} data-testid={`risk-tag-${level.toLowerCase()}`}>
      {t(labelKey)}
    </Tag>
  );
}

function RiskItemCard({ item, t }: { item: RiskItem; t: (key: string) => string }) {
  const config = RISK_CONFIG[item.riskLevel];
  const borderColor =
    item.riskLevel === 'HIGH'
      ? 'border-l-red-500'
      : item.riskLevel === 'MEDIUM'
        ? 'border-l-orange-400'
        : 'border-l-green-500';

  return (
    <div
      className={`border border-gray-200 rounded-lg p-4 mb-4 border-l-4 ${borderColor}`}
      data-testid={`risk-item-${item.clauseIndex}`}
    >
      <div className="flex items-center justify-between mb-2">
        <Typography.Text strong>
          {t('clause')} #{item.clauseIndex}
        </Typography.Text>
        <RiskLevelTag level={item.riskLevel} t={t} />
      </div>

      {item.clauseText && (
        <div className="bg-gray-50 p-2 rounded mb-3 text-sm text-gray-600">
          &ldquo;{item.clauseText}&rdquo;
        </div>
      )}

      <div className="mb-2">
        <Typography.Text strong className={config.color}>
          {t('description')}:
        </Typography.Text>
        <p className="text-sm mt-1">{item.riskDescription}</p>
      </div>

      {item.legalBasis.length > 0 && (
        <div className="mb-2">
          <Typography.Text strong>{t('legalBasis')}:</Typography.Text>
          <ul className="list-disc list-inside text-sm mt-1">
            {item.legalBasis.map((basis, i) => (
              <li key={i}>
                {basis.lawName}
                {basis.articleNumber ? ` ${basis.articleNumber}` : ''}
                {basis.description ? ` — ${basis.description}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Typography.Text strong className="text-blue-600">
          {t('suggestion')}:
        </Typography.Text>
        <p className="text-sm mt-1">{item.suggestedRevision}</p>
      </div>
    </div>
  );
}

export default function ContractReviewPage() {
  const t = useTranslations('contract.review');
  const tCommon = useTranslations('common');
  const [contractText, setContractText] = useState('');
  const [clientRole, setClientRole] = useState<'PARTY_A' | 'PARTY_B' | 'OTHER'>('PARTY_A');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [inputTab, setInputTab] = useState('paste');

  const handleReview = async () => {
    if (!contractText.trim()) return;

    setLoading(true);
    setReviewResult(null);

    try {
      const res = await fetch('/api/contract/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractText, clientRole, clientName }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '审查失败');
      }

      const data = await res.json();
      setReviewResult(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  const riskCounts = reviewResult
    ? {
        high: reviewResult.risks.filter((r) => r.riskLevel === 'HIGH').length,
        medium: reviewResult.risks.filter((r) => r.riskLevel === 'MEDIUM').length,
        low: reviewResult.risks.filter((r) => r.riskLevel === 'LOW').length,
      }
    : null;

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

        <h1 className="text-2xl font-bold mb-6" data-testid="review-title">
          <AuditOutlined className="mr-2" />
          {t('title')}
        </h1>

        {/* Input Section */}
        <Card className="mb-6">
          {/* 委托人信息 */}
          <div className="mb-4 pb-4 border-b border-gray-100">
            <div className="text-sm font-medium text-gray-700 mb-3">委托人信息（AI 将站在委托人角度审查合同）</div>
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 shrink-0">委托人是：</span>
                <Select
                  value={clientRole}
                  onChange={(v) => setClientRole(v)}
                  style={{ width: 120 }}
                  options={[
                    { value: 'PARTY_A', label: '甲方' },
                    { value: 'PARTY_B', label: '乙方' },
                    { value: 'OTHER', label: '其他方' },
                  ]}
                  data-testid="client-role-select"
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <span className="text-sm text-gray-500 shrink-0">委托人名称：</span>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="选填，如：张三 / ABC公司"
                  style={{ flex: 1 }}
                  data-testid="client-name-input"
                />
              </div>
            </div>
          </div>
          <Tabs
            activeKey={inputTab}
            onChange={setInputTab}
            items={[
              {
                key: 'paste',
                label: t('pasteText'),
                children: (
                  <TextArea
                    rows={10}
                    value={contractText}
                    onChange={(e) => setContractText(e.target.value)}
                    placeholder={t('contractTextPlaceholder')}
                    data-testid="contract-text-input"
                  />
                ),
              },
              {
                key: 'upload',
                label: t('uploadFile'),
                children: (
                  <FileUpload
                    onFileUploaded={async (file) => {
                      // file.content is base64, decode to text for docx/pdf
                      try {
                        const res = await fetch('/api/upload/extract', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: file.name, content: (file as any).content }),
                        });
                        if (res.ok) {
                          const { text } = await res.json();
                          setContractText(text);
                        } else {
                          setContractText(`[已上传文件: ${file.name}，请切换到"粘贴文本"手动粘贴内容]`);
                        }
                      } catch {
                        setContractText(`[已上传文件: ${file.name}]`);
                      }
                    }}
                  />
                ),
              },
            ]}
            data-testid="input-tabs"
          />

          <div className="mt-4">
            <Button
              type="primary"
              size="large"
              onClick={handleReview}
              loading={loading}
              disabled={!contractText.trim()}
              icon={<AuditOutlined />}
              data-testid="review-btn"
            >
              {loading ? t('reviewing') : t('startReview')}
            </Button>
          </div>
        </Card>

        {/* Loading */}
        {loading && (
          <Card className="text-center py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-500">{t('reviewing')}</p>
          </Card>
        )}

        {/* Results */}
        {reviewResult && (
          <div data-testid="review-results">
            {/* Overall Risk Summary */}
            <Card className="mb-6" data-testid="overall-risk">
              <div className="flex items-center justify-between">
                <Typography.Title level={4} className="!mb-0">
                  {t('overallRisk')}
                </Typography.Title>
                <RiskLevelTag level={reviewResult.overallRiskLevel} t={t} />
              </div>

              {riskCounts && (
                <div className="flex gap-4 mt-4">
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm">{t('riskHigh')}: {riskCounts.high}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-orange-400" />
                    <span className="text-sm">{t('riskMedium')}: {riskCounts.medium}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm">{t('riskLow')}: {riskCounts.low}</span>
                  </div>
                </div>
              )}

              <Divider />

              <div>
                <Typography.Text strong>{t('reviewReport')}:</Typography.Text>
                <p className="mt-2 text-sm">{reviewResult.reviewReport}</p>
              </div>
            </Card>

            {/* Risk Items */}
            <Card title={t('riskItems')} data-testid="risk-items-card">
              {reviewResult.risks.map((item) => (
                <RiskItemCard key={item.clauseIndex} item={item} t={t} />
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
