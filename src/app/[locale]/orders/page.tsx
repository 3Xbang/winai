'use client';

import { useState } from 'react';
import { Table, Tag, Button, Empty, Modal, Form, Select, Input } from 'antd';
import {
  FileTextOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

type OrderStatus = 'PAID' | 'PENDING' | 'EXPIRED' | 'REFUNDED' | 'FAILED';
type InvoiceFormat = 'CN_VAT' | 'TH_TAX';

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  product: string;
  amount: number;
  currency: string;
  status: OrderStatus;
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  PAID: 'green',
  PENDING: 'orange',
  EXPIRED: 'default',
  REFUNDED: 'blue',
  FAILED: 'red',
};

const MOCK_ORDERS: Order[] = [
  {
    id: '1',
    orderNumber: 'ORD-20240115-001',
    date: '2024-01-15',
    product: 'VIP 尊享版 - 年度',
    amount: 2999,
    currency: '¥',
    status: 'PAID',
  },
  {
    id: '2',
    orderNumber: 'ORD-20240110-002',
    date: '2024-01-10',
    product: '标准版 - 月度',
    amount: 99,
    currency: '¥',
    status: 'PAID',
  },
  {
    id: '3',
    orderNumber: 'ORD-20240105-003',
    date: '2024-01-05',
    product: '单次咨询',
    amount: 29,
    currency: '¥',
    status: 'EXPIRED',
  },
  {
    id: '4',
    orderNumber: 'ORD-20231220-004',
    date: '2023-12-20',
    product: '标准版 - 月度',
    amount: 99,
    currency: '¥',
    status: 'REFUNDED',
  },
];

export default function OrdersPage() {
  const t = useTranslations('orders');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const handleRequestInvoice = (orderId: string) => {
    setSelectedOrderId(orderId);
    setInvoiceModalOpen(true);
  };

  const handleInvoiceSubmit = () => {
    form.validateFields().then(() => {
      // In production: call tRPC payment.generateInvoice
      console.log('Invoice request for order:', selectedOrderId);
      setInvoiceModalOpen(false);
      form.resetFields();
    });
  };

  const columns = [
    {
      title: t('orderNumber'),
      dataIndex: 'orderNumber',
      key: 'orderNumber',
    },
    {
      title: t('date'),
      dataIndex: 'date',
      key: 'date',
    },
    {
      title: t('product'),
      dataIndex: 'product',
      key: 'product',
    },
    {
      title: t('amount'),
      key: 'amount',
      render: (_: unknown, record: Order) => (
        <span className="font-semibold">
          {record.currency}{record.amount}
        </span>
      ),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderStatus) => (
        <Tag color={STATUS_COLORS[status]} data-testid={`status-tag-${status}`}>
          {t(`statuses.${status}`)}
        </Tag>
      ),
    },
    {
      title: t('action'),
      key: 'action',
      render: (_: unknown, record: Order) => (
        <div className="flex gap-2">
          {record.status === 'PAID' && (
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => handleRequestInvoice(record.id)}
              data-testid={`invoice-btn-${record.id}`}
            >
              {t('requestInvoice')}
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            data-testid={`details-btn-${record.id}`}
          >
            {t('viewDetails')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" data-testid="orders-title">
          {t('title')}
        </h1>

        {MOCK_ORDERS.length === 0 ? (
          <Empty description={t('noOrders')} data-testid="no-orders" />
        ) : (
          <Table
            columns={columns}
            dataSource={MOCK_ORDERS}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            data-testid="orders-table"
            scroll={{ x: 'max-content' }}
          />
        )}

        {/* Invoice Request Modal */}
        <Modal
          title={t('invoice.title')}
          open={invoiceModalOpen}
          onOk={handleInvoiceSubmit}
          onCancel={() => {
            setInvoiceModalOpen(false);
            form.resetFields();
          }}
          okText={t('invoice.submitRequest')}
          data-testid="invoice-modal"
        >
          <Form form={form} layout="vertical">
            <Form.Item
              name="invoiceType"
              label={t('invoice.type')}
              rules={[{ required: true }]}
            >
              <Select
                data-testid="invoice-type-select"
                options={[
                  { value: 'CN_VAT', label: t('invoice.CN_VAT') },
                  { value: 'TH_TAX', label: t('invoice.TH_TAX') },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="companyName"
              label={t('invoice.companyName')}
              rules={[{ required: true }]}
            >
              <Input data-testid="invoice-company-input" />
            </Form.Item>
            <Form.Item
              name="taxId"
              label={t('invoice.taxId')}
              rules={[{ required: true }]}
            >
              <Input data-testid="invoice-taxid-input" />
            </Form.Item>
            <Form.Item
              name="address"
              label={t('invoice.address')}
            >
              <Input data-testid="invoice-address-input" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </div>
  );
}
