'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  Input,
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
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [inputTab, setInputTab] = useState('paste');

  const handleReview = async () => {
    if (!contractText.trim()) return;

    setLoading(true);
    setReviewResult(null);

    try {
      // In production, this would call tRPC: contract.review.mutate(...)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const mockResult: ReviewResult = {
        overallRiskLevel: 'HIGH',
        reviewReport:
          '本合同整体风险等级为高。主要风险集中在违约责任条款缺失和争议解决条款不明确。建议在签署前进行修改并咨询专业律师。',
        risks: [
          {
            clauseIndex: 1,
            clauseText: '甲方有权随时终止本合同，无需提前通知乙方。',
            riskLevel: 'HIGH',
            riskDescription: '单方面无条件终止权严重损害乙方权益，可能被认定为不公平条款。',
            legalBasis: [
              {
                lawName: '《中华人民共和国民法典》',
                articleNumber: '第563条',
                description: '合同解除需符合法定条件或约定条件',
              },
            ],
            suggestedRevision: '甲方终止本合同应提前30日书面通知乙方，并支付相应违约金。',
          },
          {
            clauseIndex: 3,
            clauseText: '本合同未约定争议解决方式。',
            riskLevel: 'MEDIUM',
            riskDescription: '缺少争议解决条款可能导致纠纷时管辖权不明确。',
            legalBasis: [
              {
                lawName: '《中华人民共和国民事诉讼法》',
                articleNumber: '第35条',
                description: '合同纠纷管辖权规定',
              },
            ],
            suggestedRevision:
              '因本合同引起的争议，双方应友好协商解决；协商不成的，提交北京仲裁委员会仲裁。',
          },
          {
            clauseIndex: 5,
            clauseText: '保密期限为合同终止后1年。',
            riskLevel: 'LOW',
            riskDescription: '保密期限较短，建议根据行业惯例适当延长。',
            legalBasis: [],
            suggestedRevision: '保密期限为合同终止后3年，涉及商业秘密的条款永久有效。',
          },
        ],
      };

      setReviewResult(mockResult);
    } catch {
      message.error(tCommon('error'));
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
                    onFileUploaded={(file) => {
                      // In production, would extract text from uploaded file
                      setContractText(`[已上传文件: ${file.name}]`);
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
