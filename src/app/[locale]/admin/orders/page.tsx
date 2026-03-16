'use client';

import { useState } from 'react';
import { Table, Input, Select, Tag, Button } from 'antd';
import { SearchOutlined, RollbackOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

type OrderStatus = 'PAID' | 'PENDING' | 'EXPIRED' | 'REFUNDED' | 'FAILED';

interface AdminOrder {
  id: string;
  orderNumber: string;
  user: string;
  product: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  date: string;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PAID: 'green',
  PENDING: 'orange',
  EXPIRED: 'default',
  REFUNDED: 'blue',
  FAILED: 'red',
};

const ALL_STATUSES: OrderStatus[] = ['PAID', 'PENDING', 'EXPIRED', 'REFUNDED', 'FAILED'];

const MOCK_ORDERS: AdminOrder[] = [
  { id: '1', orderNumber: 'ORD-20240115-001', user: 'zhang@example.com', product: 'VIP 年度', amount: 2999, currency: '¥', status: 'PAID', date: '2024-01-15' },
  { id: '2', orderNumber: 'ORD-20240114-002', user: 'somchai@example.com', product: '标准版 月度', amount: 99, currency: '¥', status: 'PAID', date: '2024-01-14' },
  { id: '3', orderNumber: 'ORD-20240113-003', user: 'john@example.com', product: '单次咨询', amount: 29, currency: '¥', status: 'PENDING', date: '2024-01-13' },
  { id: '4', orderNumber: 'ORD-20240112-004', user: 'liming@example.com', product: '标准版 月度', amount: 99, currency: '¥', status: 'EXPIRED', date: '2024-01-12' },
  { id: '5', orderNumber: 'ORD-20240110-005', user: 'wang@example.com', product: 'VIP 月度', amount: 299, currency: '¥', status: 'REFUNDED', date: '2024-01-10' },
];

export default function AdminOrdersPage() {
  const t = useTranslations('admin');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredOrders = MOCK_ORDERS.filter((order) => {
    const matchesSearch =
      !searchText ||
      order.orderNumber.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { title: t('orders.orderNumber'), dataIndex: 'orderNumber', key: 'orderNumber' },
    { title: t('orders.user'), dataIndex: 'user', key: 'user' },
    { title: t('orders.product'), dataIndex: 'product', key: 'product' },
    {
      title: t('orders.amount'),
      key: 'amount',
      render: (_: unknown, record: AdminOrder) => (
        <span className="font-semibold">{record.currency}{record.amount}</span>
      ),
    },
    {
      title: t('orders.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderStatus) => (
        <Tag color={STATUS_COLORS[status]}>
          {t(`orders.statuses.${status}`)}
        </Tag>
      ),
    },
    { title: t('orders.date'), dataIndex: 'date', key: 'date' },
    {
      title: t('orders.actions'),
      key: 'actions',
      render: (_: unknown, record: AdminOrder) => (
        <div className="flex gap-2">
          {record.status === 'PAID' && (
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              data-testid={`refund-btn-${record.id}`}
            >
              {t('orders.refund')}
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            data-testid={`view-btn-${record.id}`}
          >
            {t('orders.viewDetails')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="admin-orders-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="admin-orders-title">
        {t('orders.title')}
      </h1>

      <div className="flex flex-wrap gap-4 mb-4" data-testid="orders-filters">
        <Input
          placeholder={t('orders.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          data-testid="orders-search"
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 180 }}
          data-testid="orders-status-filter"
          options={[
            { value: 'all', label: t('orders.allStatuses') },
            ...ALL_STATUSES.map((s) => ({ value: s, label: t(`orders.statuses.${s}`) })),
          ]}
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredOrders}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        data-testid="admin-orders-table"
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
