'use client';

import { Card, Statistic, List, Button, Row, Col } from 'antd';
import {
  UserOutlined,
  CreditCardOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  FileTextOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const MOCK_STATS = {
  totalUsers: 1256,
  activeSubscriptions: 342,
  totalOrders: 876,
  totalRevenue: 128500,
};

const MOCK_ACTIVITIES = [
  { id: '1', description: 'New user registered: user@example.com', time: '2024-01-15 14:30' },
  { id: '2', description: 'Order ORD-20240115-001 paid', time: '2024-01-15 13:20' },
  { id: '3', description: 'Blog post published: Legal Guide 2024', time: '2024-01-15 11:00' },
  { id: '4', description: 'Testimonial approved for user Zhang Wei', time: '2024-01-15 10:15' },
  { id: '5', description: 'VIP subscription activated for enterprise@corp.com', time: '2024-01-14 16:45' },
];

export default function AdminDashboardPage() {
  const t = useTranslations('admin');

  return (
    <div data-testid="admin-dashboard">
      <h1 className="text-2xl font-bold mb-6" data-testid="dashboard-title">
        {t('dashboard.title')}
      </h1>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} className="mb-8" data-testid="stats-cards">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.totalUsers')}
              value={MOCK_STATS.totalUsers}
              prefix={<UserOutlined />}
              data-testid="stat-total-users"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.activeSubscriptions')}
              value={MOCK_STATS.activeSubscriptions}
              prefix={<CreditCardOutlined />}
              data-testid="stat-active-subscriptions"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.totalOrders')}
              value={MOCK_STATS.totalOrders}
              prefix={<ShoppingCartOutlined />}
              data-testid="stat-total-orders"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('dashboard.totalRevenue')}
              value={MOCK_STATS.totalRevenue}
              prefix={<DollarOutlined />}
              suffix="¥"
              data-testid="stat-total-revenue"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Recent Activity */}
        <Col xs={24} lg={16}>
          <Card title={t('dashboard.recentActivity')} data-testid="recent-activity">
            <List
              dataSource={MOCK_ACTIVITIES}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    description={item.description}
                  />
                  <span className="text-gray-400 text-sm">{item.time}</span>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col xs={24} lg={8}>
          <Card title={t('dashboard.quickActions')} data-testid="quick-actions">
            <div className="flex flex-col gap-3">
              <Link href="/admin/users">
                <Button icon={<TeamOutlined />} block data-testid="quick-manage-users">
                  {t('dashboard.manageUsers')}
                </Button>
              </Link>
              <Link href="/admin/content">
                <Button icon={<FileTextOutlined />} block data-testid="quick-manage-content">
                  {t('dashboard.manageContent')}
                </Button>
              </Link>
              <Link href="/admin/orders">
                <Button icon={<ShoppingCartOutlined />} block data-testid="quick-view-orders">
                  {t('dashboard.viewOrders')}
                </Button>
              </Link>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
