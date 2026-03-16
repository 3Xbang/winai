'use client';

import { Card, Button, Input, Statistic, Row, Col, Typography, message, Table, Tag } from 'antd';
import {
  CopyOutlined,
  ShareAltOutlined,
  GiftOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const { Title, Paragraph, Text } = Typography;

interface ReferralData {
  code: string;
  shareUrl: string;
  totalReferrals: number;
  rewardsGranted: number;
  creditsEarned: number;
}

interface ReferralRecord {
  id: string;
  referredUser: string;
  date: string;
  status: 'completed' | 'pending';
  creditsAwarded: number;
}

// Mock data for display
const MOCK_REFERRAL: ReferralData = {
  code: 'ABC12345',
  shareUrl: 'https://legal-expert.example.com/register?ref=ABC12345',
  totalReferrals: 3,
  rewardsGranted: 2,
  creditsEarned: 10,
};

const MOCK_RECORDS: ReferralRecord[] = [
  { id: '1', referredUser: '张***', date: '2024-01-15', status: 'completed', creditsAwarded: 5 },
  { id: '2', referredUser: 'S***i', date: '2024-01-12', status: 'completed', creditsAwarded: 5 },
  { id: '3', referredUser: '王***', date: '2024-01-18', status: 'pending', creditsAwarded: 0 },
];

export default function ReferralPage() {
  const t = useTranslations('referral');
  const [messageApi, contextHolder] = message.useMessage();
  const [referralData] = useState<ReferralData>(MOCK_REFERRAL);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(referralData.code);
    messageApi.success(t('codeCopied'));
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(referralData.shareUrl);
    messageApi.success(t('linkCopied'));
  };

  const columns = [
    {
      title: t('table.user'),
      dataIndex: 'referredUser',
      key: 'referredUser',
    },
    {
      title: t('table.date'),
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: t('table.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'green' : 'orange'} data-testid={`referral-status-${status}`}>
          {t(`table.${status}`)}
        </Tag>
      ),
    },
    {
      title: t('table.credits'),
      dataIndex: 'creditsAwarded',
      key: 'creditsAwarded',
      render: (credits: number) => (
        <Text strong>{credits > 0 ? `+${credits}` : '-'}</Text>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="referral-page">
      {contextHolder}

      <div className="text-center mb-8" data-testid="referral-header">
        <Title level={2} data-testid="referral-title">
          <GiftOutlined className="mr-2" />
          {t('title')}
        </Title>
        <Paragraph className="text-gray-500 text-lg" data-testid="referral-subtitle">
          {t('subtitle')}
        </Paragraph>
      </div>

      {/* Referral Code Section */}
      <Card className="mb-6" data-testid="referral-code-card">
        <Title level={4}>{t('yourCode')}</Title>
        <div className="flex gap-3 mb-4">
          <Input
            value={referralData.code}
            readOnly
            size="large"
            className="font-mono text-lg"
            data-testid="referral-code-input"
          />
          <Button
            type="primary"
            icon={<CopyOutlined />}
            size="large"
            onClick={handleCopyCode}
            data-testid="copy-code-btn"
          >
            {t('copyCode')}
          </Button>
        </div>

        <Title level={4}>{t('shareLink')}</Title>
        <div className="flex gap-3">
          <Input
            value={referralData.shareUrl}
            readOnly
            size="large"
            data-testid="referral-link-input"
          />
          <Button
            icon={<ShareAltOutlined />}
            size="large"
            onClick={handleCopyLink}
            data-testid="copy-link-btn"
          >
            {t('copyLink')}
          </Button>
        </div>
      </Card>

      {/* Stats Section */}
      <Row gutter={[16, 16]} className="mb-6" data-testid="referral-stats">
        <Col xs={24} sm={8}>
          <Card data-testid="stat-total-referrals">
            <Statistic
              title={t('stats.totalReferrals')}
              value={referralData.totalReferrals}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card data-testid="stat-rewards-granted">
            <Statistic
              title={t('stats.rewardsGranted')}
              value={referralData.rewardsGranted}
              prefix={<TrophyOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card data-testid="stat-credits-earned">
            <Statistic
              title={t('stats.creditsEarned')}
              value={referralData.creditsEarned}
              prefix={<GiftOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* How it works */}
      <Card className="mb-6" data-testid="referral-how-it-works">
        <Title level={4}>{t('howItWorks.title')}</Title>
        <div className="space-y-3">
          <Paragraph>
            <Text strong>1.</Text> {t('howItWorks.step1')}
          </Paragraph>
          <Paragraph>
            <Text strong>2.</Text> {t('howItWorks.step2')}
          </Paragraph>
          <Paragraph>
            <Text strong>3.</Text> {t('howItWorks.step3')}
          </Paragraph>
        </div>
      </Card>

      {/* Referral History */}
      <Card data-testid="referral-history">
        <Title level={4}>{t('history')}</Title>
        <Table
          columns={columns}
          dataSource={MOCK_RECORDS}
          rowKey="id"
          pagination={false}
          data-testid="referral-table"
          scroll={{ x: 'max-content' }}
        />
      </Card>
    </div>
  );
}
