'use client';

import { useState } from 'react';
import {
  Card,
  Form,
  Select,
  Input,
  Button,
  Typography,
  Timeline,
  Tag,
  Tabs,
  Spin,
  Divider,
  message,
} from 'antd';
import {
  FileSearchOutlined,
  ClockCircleOutlined,
  AimOutlined,
  TeamOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { TextArea } = Input;
const { Option } = Select;

const CASE_TYPES = ['CIVIL', 'CRIMINAL', 'ADMINISTRATIVE', 'OTHER'] as const;
const JURISDICTIONS = ['CHINA', 'THAILAND', 'DUAL'] as const;
const PARTY_ROLES = ['PLAINTIFF', 'DEFENDANT', 'THIRD_PARTY', 'OTHER'] as const;

interface TimelineEvent {
  date: string;
  event: string;
  legalSignificance: string;
}

interface LawReference {
  lawName: string;
  articleNumber?: string;
  description: string;
}

interface LegalIssue {
  issue: string;
  legalBasis: LawReference[];
  analysis: string;
}

interface StrategyAnalysis {
  perspective: 'PLAINTIFF' | 'DEFENDANT' | 'JUDGE';
  keyArguments: string[];
  legalBasis: LawReference[];
  riskAssessment: string;
}

interface JudgePerspective extends StrategyAnalysis {
  perspective: 'JUDGE';
  likelyRuling: string;
  keyConsiderations: string[];
}

interface OverallStrategy {
  recommendation: string;
  riskLevel: string;
  nextSteps: string[];
}

interface CaseAnalysisResult {
  timeline: TimelineEvent[];
  issues: LegalIssue[];
  strategies: {
    plaintiff: StrategyAnalysis;
    defendant: StrategyAnalysis;
    judge: JudgePerspective;
    overall: OverallStrategy;
  };
  strengthScore?: {
    overall: number;
    evidenceSufficiency: number;
    legalBasisStrength: number;
    similarCaseTrends: number;
    proceduralCompliance: number;
  };
}

interface CaseFormValues {
  caseType: string;
  jurisdiction: string;
  description: string;
  partyName1: string;
  partyRole1: string;
  partyName2: string;
  partyRole2: string;
  keyFacts: string;
  keyDates: string;
  context?: string;
}

const PERSPECTIVE_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  PLAINTIFF: { color: 'blue', icon: <AimOutlined /> },
  DEFENDANT: { color: 'orange', icon: <TeamOutlined /> },
  JUDGE: { color: 'purple', icon: <BulbOutlined /> },
};

function StrategyCard({
  strategy,
  perspectiveLabel,
  t,
}: {
  strategy: StrategyAnalysis;
  perspectiveLabel: string;
  t: (key: string) => string;
}) {
  const config = PERSPECTIVE_CONFIG[strategy.perspective] ?? { color: 'blue', icon: <AimOutlined /> };
  return (
    <Card
      className="mb-4"
      title={
        <span>
          {config.icon} <span className="ml-2">{perspectiveLabel}</span>
        </span>
      }
      data-testid={`strategy-${strategy.perspective.toLowerCase()}`}
    >
      <div className="mb-3">
        <Typography.Text strong>{t('keyArguments')}:</Typography.Text>
        <ul className="list-disc list-inside mt-1">
          {strategy.keyArguments.map((arg, i) => (
            <li key={i} className="text-sm mb-1">{arg}</li>
          ))}
        </ul>
      </div>

      {strategy.legalBasis.length > 0 && (
        <div className="mb-3">
          <Typography.Text strong>{t('legalBasis')}:</Typography.Text>
          <ul className="list-disc list-inside mt-1 text-sm">
            {strategy.legalBasis.map((basis, i) => (
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
        <Typography.Text strong>{t('riskAssessment')}:</Typography.Text>
        <p className="text-sm mt-1">{strategy.riskAssessment}</p>
      </div>
    </Card>
  );
}

export default function CaseAnalysisPage() {
  const t = useTranslations('caseAnalysis');
  const tCommon = useTranslations('common');
  const [form] = Form.useForm<CaseFormValues>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CaseAnalysisResult | null>(null);

  const handleAnalyze = async (values: CaseFormValues) => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/case-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '分析失败');
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      message.error(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" data-testid="case-analysis-title">
          <FileSearchOutlined className="mr-2" />
          {t('title')}
        </h1>

        {/* Case Submission Form */}
        <Card className="mb-6">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAnalyze}
            data-testid="case-form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="caseType"
                label={t('caseType')}
                rules={[{ required: true, message: t('selectCaseType') }]}
              >
                <Select placeholder={t('selectCaseType')} data-testid="case-type-select">
                  {CASE_TYPES.map((type) => (
                    <Option key={type} value={type}>
                      {t(`caseTypes.${type}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="jurisdiction"
                label={t('jurisdiction')}
                rules={[{ required: true, message: t('selectJurisdiction') }]}
              >
                <Select placeholder={t('selectJurisdiction')} data-testid="jurisdiction-select">
                  {JURISDICTIONS.map((j) => (
                    <Option key={j} value={j}>
                      {t(`jurisdictions.${j}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Divider>{t('partyInfo')}</Divider>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="partyName1"
                label={t('partyName')}
                rules={[{ required: true }]}
              >
                <Input data-testid="party-name-1" />
              </Form.Item>
              <Form.Item
                name="partyRole1"
                label={t('partyRole')}
                rules={[{ required: true }]}
              >
                <Select data-testid="party-role-1">
                  {PARTY_ROLES.map((role) => (
                    <Option key={role} value={role}>
                      {t(`partyRoles.${role}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="partyName2" label={t('partyName')}>
                <Input data-testid="party-name-2" />
              </Form.Item>
              <Form.Item name="partyRole2" label={t('partyRole')}>
                <Select data-testid="party-role-2">
                  {PARTY_ROLES.map((role) => (
                    <Option key={role} value={role}>
                      {t(`partyRoles.${role}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Form.Item
              name="description"
              label={t('caseDescription')}
              rules={[{ required: true, message: t('enterDescription') }]}
            >
              <TextArea rows={5} placeholder={t('descriptionPlaceholder')} data-testid="case-description" />
            </Form.Item>

            <Form.Item name="keyFacts" label={t('keyFacts')}>
              <TextArea rows={3} placeholder={t('keyFactsPlaceholder')} data-testid="key-facts" />
            </Form.Item>

            <Form.Item name="keyDates" label={t('keyDates')}>
              <Input placeholder={t('keyDatesPlaceholder')} data-testid="key-dates" />
            </Form.Item>

            <Form.Item name="context" label={t('additionalContext')}>
              <TextArea rows={2} data-testid="additional-context" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<FileSearchOutlined />}
                data-testid="analyze-btn"
              >
                {loading ? t('analyzing') : t('startAnalysis')}
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

        {/* Analysis Results */}
        {result && (
          <div data-testid="analysis-results">
            <Tabs
              defaultActiveKey="timeline"
              items={[
                {
                  key: 'timeline',
                  label: (
                    <span>
                      <ClockCircleOutlined className="mr-1" />
                      {t('timeline')}
                    </span>
                  ),
                  children: (
                    <Card data-testid="timeline-card">
                      <Timeline
                        items={result.timeline.map((event) => ({
                          color: 'blue',
                          children: (
                            <div data-testid="timeline-event">
                              <Typography.Text strong className="text-blue-600">
                                {event.date}
                              </Typography.Text>
                              <p className="text-sm mt-1">{event.event}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {t('legalSignificance')}: {event.legalSignificance}
                              </p>
                            </div>
                          ),
                        }))}
                        data-testid="timeline-component"
                      />
                    </Card>
                  ),
                },
                {
                  key: 'issues',
                  label: (
                    <span>
                      <AimOutlined className="mr-1" />
                      {t('disputeFocus')}
                    </span>
                  ),
                  children: (
                    <Card data-testid="issues-card">
                      {result.issues.map((issue, index) => (
                        <div
                          key={index}
                          className="border border-gray-200 rounded-lg p-4 mb-4"
                          data-testid={`issue-item-${index}`}
                        >
                          <Typography.Title level={5}>
                            {t('issue')} #{index + 1}: {issue.issue}
                          </Typography.Title>

                          <div className="mb-2">
                            <Typography.Text strong>{t('legalBasis')}:</Typography.Text>
                            <ul className="list-disc list-inside mt-1 text-sm">
                              {issue.legalBasis.map((basis, i) => (
                                <li key={i}>
                                  <Tag color="blue">{basis.lawName}</Tag>
                                  {basis.articleNumber && (
                                    <Tag color="geekblue">{basis.articleNumber}</Tag>
                                  )}
                                  {basis.description && (
                                    <span className="text-gray-600"> — {basis.description}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <Typography.Text strong>{t('analysis')}:</Typography.Text>
                            <p className="text-sm mt-1">{issue.analysis}</p>
                          </div>
                        </div>
                      ))}
                    </Card>
                  ),
                },
                {
                  key: 'strategies',
                  label: (
                    <span>
                      <TeamOutlined className="mr-1" />
                      {t('strategies')}
                    </span>
                  ),
                  children: (
                    <div data-testid="strategies-card">
                      <StrategyCard
                        strategy={result.strategies.plaintiff}
                        perspectiveLabel={t('plaintiffPerspective')}
                        t={t}
                      />
                      <StrategyCard
                        strategy={result.strategies.defendant}
                        perspectiveLabel={t('defendantPerspective')}
                        t={t}
                      />
                      <StrategyCard
                        strategy={result.strategies.judge}
                        perspectiveLabel={t('judgePerspective')}
                        t={t}
                      />

                      {/* Overall Strategy */}
                      <Card
                        className="mb-4 border-2 border-blue-200"
                        title={
                          <span>
                            <BulbOutlined className="mr-2" />
                            {t('overallStrategy')}
                          </span>
                        }
                        data-testid="overall-strategy"
                      >
                        <div className="mb-3">
                          <Typography.Text strong>{t('recommendation')}:</Typography.Text>
                          <p className="text-sm mt-1">{result.strategies.overall.recommendation}</p>
                        </div>

                        <div className="mb-3">
                          <Typography.Text strong>{t('riskLevel')}:</Typography.Text>
                          <Tag
                            color={
                              result.strategies.overall.riskLevel === 'HIGH'
                                ? 'red'
                                : result.strategies.overall.riskLevel === 'LOW'
                                  ? 'green'
                                  : 'orange'
                            }
                            className="ml-2"
                          >
                            {t(`riskLevels.${result.strategies.overall.riskLevel}`)}
                          </Tag>
                        </div>

                        <div>
                          <Typography.Text strong>{t('nextSteps')}:</Typography.Text>
                          <ol className="list-decimal list-inside mt-1 text-sm">
                            {result.strategies.overall.nextSteps.map((step, i) => (
                              <li key={i} className="mb-1">{step}</li>
                            ))}
                          </ol>
                        </div>
                      </Card>
                    </div>
                  ),
                },
                ...(result.strengthScore ? [{
                  key: 'strength',
                  label: (
                    <span>
                      <AimOutlined className="mr-1" />
                      案件强度评分
                    </span>
                  ),
                  children: (
                    <Card data-testid="strength-card">
                      <div className="text-center mb-6">
                        <div className="text-5xl font-bold text-blue-600">{result.strengthScore.overall}</div>
                        <div className="text-gray-500 mt-1">综合评分</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          { label: '证据充分性', score: result.strengthScore.evidenceSufficiency },
                          { label: '法律依据强度', score: result.strengthScore.legalBasisStrength },
                          { label: '类似案例趋势', score: result.strengthScore.similarCaseTrends },
                          { label: '程序合规性', score: result.strengthScore.proceduralCompliance },
                        ].map(({ label, score }) => (
                          <div key={label} className="border rounded-lg p-4">
                            <div className="text-sm text-gray-500">{label}</div>
                            <div className="text-2xl font-semibold mt-1">{score}</div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                              <div
                                className={`h-2 rounded-full ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ),
                }] : []),
              ]}
              data-testid="result-tabs"
            />
          </div>
        )}
      </div>
    </div>
  );
}
