'use client';

import { Card, Typography } from 'antd';
import { FileTextOutlined, AuditOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function ContractPage() {
  const t = useTranslations('contract');

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="contract-title">
            {t('title')}
          </h1>
          <p className="text-gray-500 text-lg">{t('subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/contract/draft">
            <Card
              hoverable
              className="h-full"
              data-testid="draft-card"
            >
              <div className="text-center py-4">
                <FileTextOutlined className="text-5xl text-blue-500 mb-4" />
                <Typography.Title level={3}>{t('draftTitle')}</Typography.Title>
                <Typography.Paragraph className="text-gray-500">
                  {t('draftDescription')}
                </Typography.Paragraph>
                <span className="text-blue-500 font-medium">{t('goToDraft')} →</span>
              </div>
            </Card>
          </Link>

          <Link href="/contract/review">
            <Card
              hoverable
              className="h-full"
              data-testid="review-card"
            >
              <div className="text-center py-4">
                <AuditOutlined className="text-5xl text-green-500 mb-4" />
                <Typography.Title level={3}>{t('reviewTitle')}</Typography.Title>
                <Typography.Paragraph className="text-gray-500">
                  {t('reviewDescription')}
                </Typography.Paragraph>
                <span className="text-green-500 font-medium">{t('goToReview')} →</span>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
