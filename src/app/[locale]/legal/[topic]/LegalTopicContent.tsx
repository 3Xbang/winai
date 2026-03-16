'use client';

import { Typography, Card, Collapse, Button, Row, Col } from 'antd';
import {
  CheckCircleOutlined,
  QuestionCircleOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

const { Title, Paragraph } = Typography;

interface LegalTopicContentProps {
  topic: string;
}

export default function LegalTopicContent({ topic }: LegalTopicContentProps) {
  const t = useTranslations('seo');
  const router = useRouter();

  const title = t(`topics.${topic}.heroTitle`);
  const description = t(`topics.${topic}.heroDescription`);
  const topicTitle = t(`topics.${topic}.title`);
  const topicDescription = t(`topics.${topic}.description`);
  const topicKeywords = t(`topics.${topic}.keywords`);

  const features: string[] = [];
  for (let i = 0; i < 6; i++) {
    try {
      features.push(t(`topics.${topic}.features.${i}`));
    } catch {
      break;
    }
  }

  const faqItems = ['q1', 'q2', 'q3'].map((key, index) => ({
    key: String(index + 1),
    label: t(`topics.${topic}.faq.${key}`),
    children: <Paragraph>{t(`topics.${topic}.faq.a${index + 1}`)}</Paragraph>,
  }));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    name: topicTitle,
    description: topicDescription,
    keywords: topicKeywords,
    provider: {
      '@type': 'Organization',
      name: 'China-Thailand Legal Expert System',
    },
    areaServed: ['China', 'Thailand'],
    serviceType: 'Legal Consultation',
  };

  return (
    <>
      <Script
        id={`jsonld-${topic}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="min-h-[calc(100vh-128px)]" data-testid="legal-topic-page">
        {/* Hero Section */}
        <section
          className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16 px-4"
          data-testid="hero-section"
        >
          <div className="max-w-4xl mx-auto text-center">
            <Title level={1} className="!text-white !mb-4" data-testid="hero-title">
              {title}
            </Title>
            <Paragraph className="!text-blue-100 text-lg" data-testid="hero-description">
              {description}
            </Paragraph>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 px-4 bg-gray-50" data-testid="features-section">
          <div className="max-w-4xl mx-auto">
            <Title level={2} className="text-center !mb-8">
              {t('featuresTitle')}
            </Title>
            <Row gutter={[16, 16]}>
              {features.map((feature, index) => (
                <Col xs={24} sm={12} md={8} key={index}>
                  <Card className="h-full text-center" data-testid={`feature-card-${index}`}>
                    <CheckCircleOutlined className="text-2xl text-blue-500 mb-2" />
                    <Paragraph className="!mb-0 font-medium">{feature}</Paragraph>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-12 px-4" data-testid="faq-section">
          <div className="max-w-4xl mx-auto">
            <Title level={2} className="text-center !mb-8">
              <QuestionCircleOutlined className="mr-2" />
              {t('faqTitle')}
            </Title>
            <Collapse
              items={faqItems}
              defaultActiveKey={['1']}
              data-testid="faq-collapse"
            />
          </div>
        </section>

        {/* CTA Section */}
        <section
          className="py-12 px-4 bg-blue-50"
          data-testid="cta-section"
        >
          <div className="max-w-4xl mx-auto text-center">
            <Title level={2}>{t('cta.title')}</Title>
            <Paragraph className="text-gray-600 mb-6">
              {t('cta.description')}
            </Paragraph>
            <Button
              type="primary"
              size="large"
              icon={<RightOutlined />}
              onClick={() => router.push('/consultation')}
              data-testid="cta-button"
            >
              {t('cta.button')}
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
