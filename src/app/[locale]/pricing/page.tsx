'use client';

import { useState } from 'react';
import { Card, Button, Tag, Switch, Table } from 'antd';
import { CheckOutlined, CloseOutlined, CrownOutlined, StarOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

type SubscriptionTier = 'FREE' | 'STANDARD' | 'VIP';
type BillingPeriod = 'MONTHLY' | 'YEARLY';

interface PlanConfig {
  tier: SubscriptionTier;
  icon: React.ReactNode;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  popular?: boolean;
  color: string;
}

const PLANS: PlanConfig[] = [
  {
    tier: 'FREE',
    icon: <UserOutlined />,
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: '¥',
    color: 'default',
  },
  {
    tier: 'STANDARD',
    icon: <StarOutlined />,
    monthlyPrice: 99,
    yearlyPrice: 999,
    currency: '¥',
    popular: true,
    color: 'blue',
  },
  {
    tier: 'VIP',
    icon: <CrownOutlined />,
    monthlyPrice: 299,
    yearlyPrice: 2999,
    currency: '¥',
    color: 'gold',
  },
];

const COMPARISON_FEATURES = [
  'basicConsultation',
  'contractService',
  'caseAnalysis',
  'evidenceAssessment',
  'caseSearch',
  'visaConsultation',
  'priorityResponse',
  'unlimitedConsultation',
] as const;

const FEATURE_MATRIX: Record<string, Record<SubscriptionTier, boolean>> = {
  basicConsultation: { FREE: true, STANDARD: true, VIP: true },
  contractService: { FREE: false, STANDARD: true, VIP: true },
  caseAnalysis: { FREE: false, STANDARD: true, VIP: true },
  evidenceAssessment: { FREE: false, STANDARD: true, VIP: true },
  caseSearch: { FREE: false, STANDARD: true, VIP: true },
  visaConsultation: { FREE: false, STANDARD: false, VIP: true },
  priorityResponse: { FREE: false, STANDARD: false, VIP: true },
  unlimitedConsultation: { FREE: false, STANDARD: false, VIP: true },
};

export default function PricingPage() {
  const t = useTranslations('pricing');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('MONTHLY');

  const isAnnual = billingPeriod === 'YEARLY';

  const getPrice = (plan: PlanConfig) => {
    return isAnnual ? plan.yearlyPrice : plan.monthlyPrice;
  };

  const getAnnualSavings = (plan: PlanConfig) => {
    if (plan.monthlyPrice === 0) return 0;
    const yearlyFull = plan.monthlyPrice * 12;
    return Math.round(((yearlyFull - plan.yearlyPrice) / yearlyFull) * 100);
  };

  const comparisonColumns = [
    {
      title: t('comparison.feature'),
      dataIndex: 'feature',
      key: 'feature',
    },
    ...PLANS.map((plan) => ({
      title: t(`plans.${plan.tier}.name`),
      dataIndex: plan.tier,
      key: plan.tier,
      align: 'center' as const,
      render: (included: boolean) =>
        included ? (
          <CheckOutlined className="text-green-500" />
        ) : (
          <CloseOutlined className="text-gray-300" />
        ),
    })),
  ];

  const comparisonData = COMPARISON_FEATURES.map((feature) => {
    const matrix = FEATURE_MATRIX[feature];
    return {
      key: feature,
      feature: t(`comparison.${feature}`),
      FREE: matrix?.FREE ?? false,
      STANDARD: matrix?.STANDARD ?? false,
      VIP: matrix?.VIP ?? false,
    };
  });

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="pricing-title">
            {t('title')}
          </h1>
          <p className="text-gray-500 text-lg">{t('subtitle')}</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-8" data-testid="billing-toggle">
          <span className={!isAnnual ? 'font-semibold' : 'text-gray-500'}>
            {t('monthly')}
          </span>
          <Switch
            checked={isAnnual}
            onChange={(checked) => setBillingPeriod(checked ? 'YEARLY' : 'MONTHLY')}
            data-testid="billing-switch"
          />
          <span className={isAnnual ? 'font-semibold' : 'text-gray-500'}>
            {t('annual')}
          </span>
          {isAnnual && (
            <Tag color="green" data-testid="annual-discount-tag">
              {t('annualDiscount')}
            </Tag>
          )}
        </div>

        {/* Plan cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
          data-testid="plan-cards"
        >
          {PLANS.map((plan) => {
            const price = getPrice(plan);
            const savings = getAnnualSavings(plan);

            return (
              <Card
                key={plan.tier}
                className={`relative ${plan.popular ? 'border-blue-500 border-2 shadow-lg' : ''}`}
                data-testid={`plan-card-${plan.tier}`}
              >
                {plan.popular && (
                  <Tag
                    color="blue"
                    className="absolute -top-3 left-1/2 -translate-x-1/2"
                    data-testid="popular-tag"
                  >
                    ★ Popular
                  </Tag>
                )}

                <div className="text-center">
                  <div className="text-3xl mb-2">{plan.icon}</div>
                  <h2 className="text-xl font-bold mb-1">
                    {t(`plans.${plan.tier}.name`)}
                  </h2>
                  <p className="text-gray-500 text-sm mb-4">
                    {t(`plans.${plan.tier}.description`)}
                  </p>

                  {/* Price */}
                  <div className="mb-4" data-testid={`price-${plan.tier}`}>
                    <span className="text-4xl font-bold">
                      {plan.currency}{price}
                    </span>
                    <span className="text-gray-500">
                      {isAnnual ? t('perYear') : t('perMonth')}
                    </span>
                    {isAnnual && savings > 0 && (
                      <div className="mt-1">
                        <Tag color="green" data-testid={`savings-${plan.tier}`}>
                          {t('savePercent', { percent: savings })}
                        </Tag>
                      </div>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="text-sm text-gray-600 mb-4">
                    <div>{t(`plans.${plan.tier}.dailyLimit`)}</div>
                    <div>{t(`plans.${plan.tier}.monthlyLimit`)}</div>
                  </div>

                  {/* CTA Button */}
                  <Link href={plan.tier === 'FREE' ? '/consultation' : `/payment?plan=${plan.tier}&period=${billingPeriod}`}>
                    <Button
                      type={plan.popular ? 'primary' : 'default'}
                      size="large"
                      block
                      data-testid={`subscribe-btn-${plan.tier}`}
                    >
                      {plan.tier === 'FREE' ? t('freeTrial') : t('subscribe')}
                    </Button>
                  </Link>
                </div>

                {/* Features list */}
                <div className="mt-6 border-t pt-4">
                  <h3 className="font-semibold mb-3">{t('features')}</h3>
                  <ul className="space-y-2">
                    {(t.raw(`plans.${plan.tier}.features`) as string[]).map(
                      (feature: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <CheckOutlined className="text-green-500 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Comparison table */}
        <div className="mb-8" data-testid="comparison-table">
          <Table
            columns={comparisonColumns}
            dataSource={comparisonData}
            pagination={false}
            bordered
            size="middle"
          />
        </div>
      </div>
    </div>
  );
}
