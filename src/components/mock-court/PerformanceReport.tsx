'use client';

import { Card, Progress, Tag, Typography, Collapse, Space } from 'antd';
import {
  TrophyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  BulbOutlined,
  BookOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { PerformanceReportData, ScoreDimension } from '@/types/mock-court';

const { Title, Text, Paragraph } = Typography;

interface PerformanceReportProps {
  report: PerformanceReportData;
}

const DIMENSION_COLORS: Record<ScoreDimension, string> = {
  LEGAL_ARGUMENT: '#1677ff',
  EVIDENCE_USE: '#52c41a',
  PROCEDURE: '#faad14',
  ADAPTABILITY: '#722ed1',
  EXPRESSION: '#eb2f96',
};

function getScoreStatus(score: number): 'success' | 'normal' | 'exception' {
  if (score >= 7) return 'success';
  if (score >= 4) return 'normal';
  return 'exception';
}

export default function PerformanceReport({ report }: PerformanceReportProps) {
  const t = useTranslations('mockCourt');

  return (
    <div className="space-y-6 p-4" data-testid="performance-report">
      {/* Title */}
      <Title level={3} className="text-center">
        <TrophyOutlined className="mr-2" />
        {t('report.title')}
      </Title>

      {/* Overall Score */}
      <Card data-testid="overall-score-card">
        <div className="text-center">
          <Text type="secondary">{t('report.overallScore')}</Text>
          <div className="my-4">
            <Progress
              type="circle"
              percent={report.overallScore * 10}
              format={() => `${report.overallScore.toFixed(1)}`}
              size={120}
              status={getScoreStatus(report.overallScore)}
            />
          </div>
          <Paragraph className="text-gray-600 max-w-xl mx-auto">
            {report.overallComment}
          </Paragraph>
        </div>
      </Card>

      {/* Dimension Scores - Bar Chart Style */}
      <Card title={t('report.dimensionScores')} data-testid="dimension-scores-card">
        <div className="space-y-4">
          {report.dimensions.map((dim) => (
            <div key={dim.dimension} data-testid={`dimension-${dim.dimension}`}>
              <div className="flex justify-between mb-1">
                <Text strong>{t(`scoreDimensions.${dim.dimension}`)}</Text>
                <Text>{dim.score}/10</Text>
              </div>
              <Progress
                percent={dim.score * 10}
                strokeColor={DIMENSION_COLORS[dim.dimension]}
                status={getScoreStatus(dim.score)}
                showInfo={false}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Detailed Feedback per Dimension */}
      <Card title={t('report.detailedFeedback')} data-testid="detailed-feedback-card">
        <Collapse
          items={report.dimensions.map((dim) => ({
            key: dim.dimension,
            label: (
              <Space>
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{ backgroundColor: DIMENSION_COLORS[dim.dimension] }}
                />
                <span>{t(`scoreDimensions.${dim.dimension}`)}</span>
                <Tag color={dim.score >= 7 ? 'green' : dim.score >= 4 ? 'orange' : 'red'}>
                  {dim.score}/10
                </Tag>
              </Space>
            ),
            children: (
              <div className="space-y-3">
                <Paragraph>{dim.comment}</Paragraph>

                {dim.strengths.length > 0 && (
                  <div>
                    <Text strong className="text-green-600">
                      <CheckCircleOutlined className="mr-1" />
                      {t('report.strengths')}
                    </Text>
                    <ul className="list-disc pl-6 mt-1">
                      {dim.strengths.map((s, i) => (
                        <li key={i}><Text>{s}</Text></li>
                      ))}
                    </ul>
                  </div>
                )}

                {dim.weaknesses.length > 0 && (
                  <div>
                    <Text strong className="text-red-500">
                      <CloseCircleOutlined className="mr-1" />
                      {t('report.weaknesses')}
                    </Text>
                    <ul className="list-disc pl-6 mt-1">
                      {dim.weaknesses.map((w, i) => (
                        <li key={i}><Text>{w}</Text></li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
          }))}
        />
      </Card>

      {/* Improvement Suggestions */}
      {report.improvements.length > 0 && (
        <Card
          title={<><BulbOutlined className="mr-2" />{t('report.improvements')}</>}
          data-testid="improvements-card"
        >
          <div className="space-y-4">
            {report.improvements.map((item, index) => (
              <div key={index} className="border-l-4 border-blue-400 pl-4">
                <Paragraph strong>{item.suggestion}</Paragraph>
                <Paragraph type="secondary" className="italic bg-gray-50 p-2 rounded">
                  &ldquo;{item.exampleQuote}&rdquo;
                </Paragraph>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Legal Citations */}
      {report.legalCitations.length > 0 && (
        <Card
          title={<><BookOutlined className="mr-2" />{t('report.legalCitations')}</>}
          data-testid="legal-citations-card"
        >
          <div className="space-y-3">
            {report.legalCitations.map((cite, index) => (
              <div key={index} className="flex items-start gap-2">
                <Tag color={cite.isAccurate ? 'green' : 'red'} className="mt-0.5 shrink-0">
                  {cite.isAccurate ? t('report.citationAccurate') : t('report.citationInaccurate')}
                </Tag>
                <div>
                  <Text>{cite.citation}</Text>
                  {!cite.isAccurate && cite.correction && (
                    <Paragraph type="warning" className="mt-1 text-sm">
                      {cite.correction}
                    </Paragraph>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Verdict Summary */}
      <Card
        title={<><FileTextOutlined className="mr-2" />{t('report.verdictSummary')}</>}
        data-testid="verdict-summary-card"
      >
        <Paragraph>{report.verdictSummary}</Paragraph>
      </Card>
    </div>
  );
}
