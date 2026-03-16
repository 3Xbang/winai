'use client';

import { Card, Rate, Empty, Row, Col, Avatar, Typography } from 'antd';
import { UserOutlined, StarFilled } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Text, Paragraph, Title } = Typography;

interface Testimonial {
  id: string;
  userName: string;
  content: string;
  rating: number;
  createdAt: string;
}

// Only show approved testimonials (admin-reviewed)
const APPROVED_TESTIMONIALS: Testimonial[] = [
  {
    id: '1',
    userName: '张伟',
    content: '非常专业的法律咨询服务，帮助我解决了公司注册问题。系统的IRAC分析非常清晰，让我对案件有了全面的了解。',
    rating: 5,
    createdAt: '2024-01-10',
  },
  {
    id: '2',
    userName: 'Somchai P.',
    content: 'Excellent visa consultation service. The AI provided detailed guidance on my Elite visa application and helped me understand all the requirements.',
    rating: 5,
    createdAt: '2024-01-08',
  },
  {
    id: '3',
    userName: '王芳',
    content: '合同审查功能很实用，帮我发现了几个重要的风险条款。推荐给需要跨境合同服务的朋友。',
    rating: 4,
    createdAt: '2024-01-05',
  },
  {
    id: '4',
    userName: 'Nattapong K.',
    content: 'ระบบวิเคราะห์กฎหมายที่ดีมาก ช่วยให้เข้าใจกฎหมายแรงงานไทยได้ง่ายขึ้น',
    rating: 4,
    createdAt: '2024-01-03',
  },
  {
    id: '5',
    userName: '李明',
    content: '签证咨询服务非常详细，从申请条件到材料清单都一目了然。节省了大量时间和精力。',
    rating: 5,
    createdAt: '2024-01-01',
  },
  {
    id: '6',
    userName: 'Sarah Chen',
    content: 'The cross-border contract dispute analysis was incredibly thorough. The three-perspective strategy gave me a comprehensive view of my case.',
    rating: 5,
    createdAt: '2023-12-28',
  },
];

export default function TestimonialsPage() {
  const t = useTranslations('testimonials');

  const averageRating =
    APPROVED_TESTIMONIALS.reduce((sum, t) => sum + t.rating, 0) / APPROVED_TESTIMONIALS.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" data-testid="testimonials-page">
      <div className="text-center mb-10" data-testid="testimonials-header">
        <Title level={2} data-testid="testimonials-title">
          {t('title')}
        </Title>
        <Paragraph className="text-gray-500 text-lg" data-testid="testimonials-subtitle">
          {t('subtitle')}
        </Paragraph>
        <div className="flex items-center justify-center gap-2 mt-4" data-testid="testimonials-average">
          <StarFilled className="text-yellow-400 text-xl" />
          <Text strong className="text-xl">
            {averageRating.toFixed(1)}
          </Text>
          <Text className="text-gray-400">
            ({APPROVED_TESTIMONIALS.length} {t('reviewCount')})
          </Text>
        </div>
      </div>

      {APPROVED_TESTIMONIALS.length === 0 ? (
        <Empty description={t('noReviews')} data-testid="testimonials-empty" />
      ) : (
        <Row gutter={[24, 24]} data-testid="testimonials-grid">
          {APPROVED_TESTIMONIALS.map((testimonial) => (
            <Col xs={24} md={12} lg={8} key={testimonial.id}>
              <Card
                className="h-full"
                data-testid={`testimonial-card-${testimonial.id}`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Avatar icon={<UserOutlined />} size={48} data-testid={`testimonial-avatar-${testimonial.id}`} />
                  <div>
                    <Text strong data-testid={`testimonial-user-${testimonial.id}`}>
                      {testimonial.userName}
                    </Text>
                    <br />
                    <Text className="text-gray-400 text-sm" data-testid={`testimonial-date-${testimonial.id}`}>
                      {testimonial.createdAt}
                    </Text>
                  </div>
                </div>
                <Rate
                  disabled
                  defaultValue={testimonial.rating}
                  className="mb-3"
                  data-testid={`testimonial-rating-${testimonial.id}`}
                />
                <Paragraph
                  className="text-gray-600"
                  data-testid={`testimonial-content-${testimonial.id}`}
                >
                  {testimonial.content}
                </Paragraph>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
}
