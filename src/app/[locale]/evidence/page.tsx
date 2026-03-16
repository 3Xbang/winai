'use client';

import { useState } from 'react';
import {
  Card,
  Tag,
  Typography,
  Spin,
  Button,
  Divider,
  Empty,
  message,
} from 'antd';
import {
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type EvidenceType = 'DOCUMENTARY' | 'PHYSICAL' | 'TESTIMONY' | 'ELECTRONIC' | 'EXPERT_OPINION';
type EvidenceStrength = 'STRONG' | 'MEDIUM' | 'WEAK';
type Priority = 'ESSENTIAL' | 'IMPORTANT' | 'SUPPLEMENTARY';

interface EvidenceChecklistItem {
  description: string;
  type: EvidenceType;
  priority: Priority;
  collectionSuggestion: string;
}

interface EvidenceAssessmentItem {
  description: string;
  type: EvidenceType;
  strength: EvidenceStrength;
  strengthReason: string;
  legalityRisk?: string;
  alternativeCollection?: string;
}

interface EvidenceGap {
  issue: string;
  missingEvidence: string;
  importance: string;
  suggestion: string;
}

interface EvidenceResult {
  checklist: EvidenceChecklistItem[];
  assessment: {
    overallStrength: EvidenceStrength;
    items: EvidenceAssessmentItem[];
    summary: string;
  };
  gaps: EvidenceGap[];
}

const PRIORITY_CONFIG: Record<Priority, { color: string; tagColor: string }> = {
  ESSENTIAL: { color: 'text-red-600', tagColor: 'red' },
  IMPORTANT: { color: 'text-orange-500', tagColor: 'orange' },
  SUPPLEMENTARY: { color: 'text-blue-500', tagColor: 'blue' },
};

const STRENGTH_CONFIG: Record<EvidenceStrength, { icon: React.ReactNode; tagColor: string }> = {
  STRONG: { icon: <CheckCircleOutlined />, tagColor: 'green' },
  MEDIUM: { icon: <ExclamationCircleOutlined />, tagColor: 'orange' },
  WEAK: { icon: <WarningOutlined />, tagColor: 'red' },
};

export default function EvidencePage() {
  const t = useTranslations('evidence');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvidenceResult | null>(null);

  const handleLoadEvidence = async () => {
    setLoading(true);
    setResult(null);

    try {
      // In production, this would call tRPC: evidence.generateChecklist / evidence.assess / evidence.identifyGaps
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockResult: EvidenceResult = {
        checklist: [
          {
            description: '双方签订的合作协议原件',
            type: 'DOCUMENTARY',
            priority: 'ESSENTIAL',
            collectionSuggestion: '从合同档案中调取原件，如无原件可提供经公证的复印件',
          },
          {
            description: '银行转账记录和付款凭证',
            type: 'ELECTRONIC',
            priority: 'ESSENTIAL',
            collectionSuggestion: '向银行申请交易流水明细',
          },
          {
            description: '催款函及送达回执',
            type: 'DOCUMENTARY',
            priority: 'IMPORTANT',
            collectionSuggestion: '保留快递单号和签收记录',
          },
          {
            description: '微信/邮件沟通记录',
            type: 'ELECTRONIC',
            priority: 'SUPPLEMENTARY',
            collectionSuggestion: '截图并进行公证保全',
          },
        ],
        assessment: {
          overallStrength: 'MEDIUM',
          items: [
            {
              description: '合作协议原件',
              type: 'DOCUMENTARY',
              strength: 'STRONG',
              strengthReason: '直接证明合同关系和双方权利义务',
            },
            {
              description: '银行转账记录',
              type: 'ELECTRONIC',
              strength: 'STRONG',
              strengthReason: '客观记录付款情况，证明力强',
            },
            {
              description: '微信聊天记录',
              type: 'ELECTRONIC',
              strength: 'MEDIUM',
              strengthReason: '可辅助证明沟通过程，但需公证保全',
              legalityRisk: '未经对方同意的录屏可能存在合法性争议',
              alternativeCollection: '建议通过公证处进行证据保全',
            },
          ],
          summary: '现有证据基本能够证明合同关系和违约事实，但建议补充催款函送达证据以完善证据链。',
        },
        gaps: [
          {
            issue: '被告违约事实',
            missingEvidence: '被告确认收到催款函的证据',
            importance: 'CRITICAL',
            suggestion: '补充快递签收记录或EMS送达回执',
          },
          {
            issue: '损失金额认定',
            missingEvidence: '原告实际损失的计算依据',
            importance: 'IMPORTANT',
            suggestion: '准备财务报表或审计报告证明实际损失',
          },
        ],
      };

      setResult(mockResult);
    } catch {
      message.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link href="/case-analysis">
            <Button type="link" className="!px-0">
              <FileSearchOutlined className="mr-1" />
              {t('backToCaseAnalysis')}
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6" data-testid="evidence-title">
          <SafetyCertificateOutlined className="mr-2" />
          {t('title')}
        </h1>

        <div className="mb-6">
          <Button
            type="primary"
            size="large"
            onClick={handleLoadEvidence}
            loading={loading}
            icon={<SafetyCertificateOutlined />}
            data-testid="load-evidence-btn"
          >
            {loading ? t('loading') : t('generateChecklist')}
          </Button>
        </div>

        {loading && (
          <Card className="text-center py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-500">{t('loading')}</p>
          </Card>
        )}

        {result && (
          <div data-testid="evidence-results">
            {/* Evidence Checklist */}
            <Card title={t('checklist')} className="mb-6" data-testid="checklist-card">
              {result.checklist.map((item, index) => {
                const priorityConfig = PRIORITY_CONFIG[item.priority];
                return (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 mb-3"
                    data-testid={`checklist-item-${index}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Typography.Text strong>{item.description}</Typography.Text>
                      <div className="flex gap-2">
                        <Tag color={priorityConfig.tagColor} data-testid={`priority-tag-${item.priority.toLowerCase()}`}>
                          {t(`priorities.${item.priority}`)}
                        </Tag>
                        <Tag>{t(`evidenceTypes.${item.type}`)}</Tag>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {t('collectionSuggestion')}: {item.collectionSuggestion}
                    </p>
                  </div>
                );
              })}
            </Card>

            {/* Evidence Strength Assessment */}
            <Card title={t('strengthAssessment')} className="mb-6" data-testid="assessment-card">
              <div className="mb-4 flex items-center gap-2">
                <Typography.Text strong>{t('overallStrength')}:</Typography.Text>
                <Tag
                  color={STRENGTH_CONFIG[result.assessment.overallStrength].tagColor}
                  icon={STRENGTH_CONFIG[result.assessment.overallStrength].icon}
                >
                  {t(`strengths.${result.assessment.overallStrength}`)}
                </Tag>
              </div>

              <p className="text-sm mb-4">{result.assessment.summary}</p>

              <Divider />

              {result.assessment.items.map((item, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4 mb-3"
                  data-testid={`assessment-item-${index}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Typography.Text strong>{item.description}</Typography.Text>
                    <div className="flex gap-2">
                      <Tag
                        color={STRENGTH_CONFIG[item.strength].tagColor}
                        icon={STRENGTH_CONFIG[item.strength].icon}
                      >
                        {t(`strengths.${item.strength}`)}
                      </Tag>
                      <Tag>{t(`evidenceTypes.${item.type}`)}</Tag>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-1">{item.strengthReason}</p>
                  {item.legalityRisk && (
                    <div className="mt-2 bg-red-50 p-2 rounded">
                      <Typography.Text type="danger" className="text-sm">
                        <WarningOutlined className="mr-1" />
                        {t('legalityRisk')}: {item.legalityRisk}
                      </Typography.Text>
                      {item.alternativeCollection && (
                        <p className="text-sm text-blue-600 mt-1">
                          {t('alternativeCollection')}: {item.alternativeCollection}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </Card>

            {/* Evidence Gaps */}
            <Card title={t('evidenceGaps')} className="mb-6" data-testid="gaps-card">
              {result.gaps.length === 0 ? (
                <Empty description={t('noGaps')} />
              ) : (
                result.gaps.map((gap, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 mb-3 border-l-4 border-l-orange-400"
                    data-testid={`gap-item-${index}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Typography.Text strong>{gap.missingEvidence}</Typography.Text>
                      <Tag
                        color={
                          gap.importance === 'CRITICAL'
                            ? 'red'
                            : gap.importance === 'IMPORTANT'
                              ? 'orange'
                              : 'blue'
                        }
                      >
                        {t(`gapImportance.${gap.importance}`)}
                      </Tag>
                    </div>
                    <p className="text-sm text-gray-500 mb-1">
                      {t('relatedIssue')}: {gap.issue}
                    </p>
                    <p className="text-sm text-blue-600">
                      {t('suggestion')}: {gap.suggestion}
                    </p>
                  </div>
                ))
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
