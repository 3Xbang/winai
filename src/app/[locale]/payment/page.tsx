'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Button, Radio, Spin, Result, Descriptions } from 'antd';
import {
  WechatOutlined,
  AlipayCircleOutlined,
  CreditCardOutlined,
  BankOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';

type PaymentMethod = 'WECHAT' | 'ALIPAY' | 'PROMPTPAY' | 'STRIPE';
type PaymentStatus = 'IDLE' | 'PROCESSING' | 'POLLING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

interface PaymentMethodOption {
  key: PaymentMethod;
  icon: React.ReactNode;
  color: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  { key: 'WECHAT', icon: <WechatOutlined className="text-2xl" />, color: '#07C160' },
  { key: 'ALIPAY', icon: <AlipayCircleOutlined className="text-2xl" />, color: '#1677FF' },
  { key: 'PROMPTPAY', icon: <BankOutlined className="text-2xl" />, color: '#1A3C6E' },
  { key: 'STRIPE', icon: <CreditCardOutlined className="text-2xl" />, color: '#635BFF' },
];

const PLAN_PRICES: Record<string, Record<string, { price: number; currency: string }>> = {
  STANDARD: {
    MONTHLY: { price: 99, currency: '¥' },
    YEARLY: { price: 999, currency: '¥' },
  },
  VIP: {
    MONTHLY: { price: 299, currency: '¥' },
    YEARLY: { price: 2999, currency: '¥' },
  },
};

export default function PaymentPage() {
  const t = useTranslations('payment');
  const tPricing = useTranslations('pricing');
  const searchParams = useSearchParams();

  const plan = searchParams.get('plan') || 'STANDARD';
  const period = searchParams.get('period') || 'MONTHLY';

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('WECHAT');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('IDLE');
  const [pollingCount, setPollingCount] = useState(0);

  const planPrice = PLAN_PRICES[plan]?.[period] || { price: 99, currency: '¥' };

  const handlePay = useCallback(() => {
    setPaymentStatus('PROCESSING');

    // Simulate payment initiation
    setTimeout(() => {
      setPaymentStatus('POLLING');
      setPollingCount(0);
    }, 1500);
  }, []);

  // Payment status polling simulation
  useEffect(() => {
    if (paymentStatus !== 'POLLING') return;

    const interval = setInterval(() => {
      setPollingCount((prev) => {
        const next = prev + 1;
        // Simulate: after 3 polls, payment succeeds
        if (next >= 3) {
          setPaymentStatus('SUCCESS');
          clearInterval(interval);
        }
        return next;
      });
    }, 2000);

    // Timeout after 30 seconds (15 polls)
    const timeout = setTimeout(() => {
      if (paymentStatus === 'POLLING') {
        setPaymentStatus('EXPIRED');
      }
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [paymentStatus]);

  const handleRetry = () => {
    setPaymentStatus('IDLE');
    setPollingCount(0);
  };

  // Result screens
  if (paymentStatus === 'SUCCESS') {
    return (
      <div className="min-h-[calc(100vh-128px)] bg-gray-50 flex items-center justify-center px-4">
        <Result
          icon={<CheckCircleOutlined className="text-green-500" />}
          status="success"
          title={t('success')}
          subTitle={t('successMessage')}
          data-testid="payment-success"
          extra={[
            <Link key="consultation" href="/consultation">
              <Button type="primary" data-testid="go-consultation-btn">
                {t('goToConsultation')}
              </Button>
            </Link>,
            <Link key="orders" href="/orders">
              <Button data-testid="view-orders-btn">
                {t('backToPricing')}
              </Button>
            </Link>,
          ]}
        />
      </div>
    );
  }

  if (paymentStatus === 'FAILED') {
    return (
      <div className="min-h-[calc(100vh-128px)] bg-gray-50 flex items-center justify-center px-4">
        <Result
          icon={<CloseCircleOutlined className="text-red-500" />}
          status="error"
          title={t('failed')}
          subTitle={t('failedMessage')}
          data-testid="payment-failed"
          extra={[
            <Button key="retry" type="primary" onClick={handleRetry} data-testid="retry-btn">
              {t('retry')}
            </Button>,
            <Link key="pricing" href="/pricing">
              <Button data-testid="back-pricing-btn">{t('backToPricing')}</Button>
            </Link>,
          ]}
        />
      </div>
    );
  }

  if (paymentStatus === 'EXPIRED') {
    return (
      <div className="min-h-[calc(100vh-128px)] bg-gray-50 flex items-center justify-center px-4">
        <Result
          icon={<ClockCircleOutlined className="text-orange-500" />}
          title={t('expired')}
          subTitle={t('expiredMessage')}
          data-testid="payment-expired"
          extra={[
            <Link key="pricing" href="/pricing">
              <Button type="primary" data-testid="back-pricing-btn">
                {t('backToPricing')}
              </Button>
            </Link>,
          ]}
        />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" data-testid="payment-title">
          {t('title')}
        </h1>

        {/* Order Summary */}
        <Card className="mb-6" data-testid="order-summary">
          <h2 className="text-lg font-semibold mb-4">{t('orderSummary')}</h2>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('plan')}>
              {tPricing(`plans.${plan}.name`)}
            </Descriptions.Item>
            <Descriptions.Item label={t('period')}>
              {period === 'YEARLY' ? tPricing('annual') : tPricing('monthly')}
            </Descriptions.Item>
            <Descriptions.Item label={t('amount')}>
              <span className="text-xl font-bold text-blue-600">
                {planPrice.currency}{planPrice.price}
              </span>
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Payment Method Selection */}
        <Card className="mb-6" data-testid="payment-methods">
          <h2 className="text-lg font-semibold mb-4">{t('selectMethod')}</h2>
          <Radio.Group
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
            className="w-full"
            data-testid="method-radio-group"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((method) => (
                <Radio.Button
                  key={method.key}
                  value={method.key}
                  className="h-auto p-4 flex items-center justify-center"
                  data-testid={`method-${method.key}`}
                >
                  <div className="flex items-center gap-2">
                    {method.icon}
                    <span>{t(`methods.${method.key}`)}</span>
                  </div>
                </Radio.Button>
              ))}
            </div>
          </Radio.Group>
        </Card>

        {/* Pay Button / Processing State */}
        {paymentStatus === 'IDLE' && (
          <Button
            type="primary"
            size="large"
            block
            onClick={handlePay}
            data-testid="pay-now-btn"
          >
            {t('payNow')}
          </Button>
        )}

        {paymentStatus === 'PROCESSING' && (
          <div className="text-center py-8" data-testid="payment-processing">
            <Spin indicator={<LoadingOutlined className="text-3xl" />} />
            <p className="mt-4 text-gray-500">{t('processing')}</p>
          </div>
        )}

        {paymentStatus === 'POLLING' && (
          <div className="text-center py-8" data-testid="payment-polling">
            <Spin indicator={<LoadingOutlined className="text-3xl" />} />
            <p className="mt-4 text-gray-500">{t('polling')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
