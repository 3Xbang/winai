'use client';

import { Alert } from 'antd';
import {
  WarningOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

interface RiskWarningProps {
  level: 'high' | 'medium' | 'info';
  message: string;
}

const levelConfig = {
  high: {
    type: 'error' as const,
    icon: <WarningOutlined />,
    titleKey: 'highRisk' as const,
  },
  medium: {
    type: 'warning' as const,
    icon: <ExclamationCircleOutlined />,
    titleKey: 'highRisk' as const,
  },
  info: {
    type: 'info' as const,
    icon: <InfoCircleOutlined />,
    titleKey: 'disclaimer' as const,
  },
};

export function RiskWarningAlert({ level, message }: RiskWarningProps) {
  const t = useTranslations('consultation.risk');
  const config = levelConfig[level];

  return (
    <Alert
      type={config.type}
      icon={config.icon}
      message={t(config.titleKey)}
      description={message}
      showIcon
      className="!my-2"
      data-testid={`risk-warning-${level}`}
    />
  );
}

export function DisclaimerBanner() {
  const t = useTranslations('consultation.risk');

  return (
    <Alert
      type="info"
      icon={<InfoCircleOutlined />}
      message={t('disclaimer')}
      showIcon
      banner
      className="!text-xs"
      data-testid="disclaimer-banner"
    />
  );
}

export function LawyerAdviceNotice() {
  const t = useTranslations('consultation.risk');

  return (
    <Alert
      type="error"
      icon={<WarningOutlined />}
      message={t('lawyerAdvice')}
      showIcon
      className="!my-2 !border-red-300 !bg-red-50"
      data-testid="lawyer-advice-notice"
    />
  );
}
