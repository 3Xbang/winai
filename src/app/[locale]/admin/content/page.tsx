'use client';

import { Tabs, Table, Tag, Button, Rate } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

type BlogStatus = 'draft' | 'published';
type TestimonialStatus = 'pending' | 'approved' | 'rejected';

interface BlogPost {
  id: string;
  title: string;
  author: string;
  status: BlogStatus;
  date: string;
}

interface Testimonial {
  id: string;
  user: string;
  content: string;
  rating: number;
  status: TestimonialStatus;
}

const BLOG_STATUS_COLORS: Record<BlogStatus, string> = {
  draft: 'default',
  published: 'green',
};

const TESTIMONIAL_STATUS_COLORS: Record<TestimonialStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

const MOCK_BLOGS: BlogPost[] = [
  { id: '1', title: '中泰公司注册指南 2024', author: '张律师', status: 'published', date: '2024-01-10' },
  { id: '2', title: 'Thailand Visa Guide for Chinese Citizens', author: 'Admin', status: 'published', date: '2024-01-08' },
  { id: '3', title: '跨境合同纠纷处理流程', author: '李律师', status: 'draft', date: '2024-01-15' },
];

const MOCK_TESTIMONIALS: Testimonial[] = [
  { id: '1', user: '张伟', content: '非常专业的法律咨询服务，帮助我解决了公司注册问题。', rating: 5, status: 'approved' },
  { id: '2', user: 'Somchai', content: 'Great service for visa consultation.', rating: 4, status: 'pending' },
  { id: '3', user: '王芳', content: '合同审查功能很实用。', rating: 4, status: 'pending' },
  { id: '4', user: 'Nattapong', content: 'Not very helpful.', rating: 2, status: 'rejected' },
];

export default function AdminContentPage() {
  const t = useTranslations('admin');

  const blogColumns = [
    { title: t('content.blog.postTitle'), dataIndex: 'title', key: 'title' },
    { title: t('content.blog.author'), dataIndex: 'author', key: 'author' },
    {
      title: t('content.blog.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: BlogStatus) => (
        <Tag color={BLOG_STATUS_COLORS[status]}>
          {t(`content.blog.${status}`)}
        </Tag>
      ),
    },
    { title: t('content.blog.date'), dataIndex: 'date', key: 'date' },
    {
      title: t('content.blog.actions'),
      key: 'actions',
      render: (_: unknown, record: BlogPost) => (
        <div className="flex gap-2">
          <Button type="link" size="small" icon={<EditOutlined />} data-testid={`blog-edit-${record.id}`}>
            {t('content.blog.edit')}
          </Button>
          {record.status === 'draft' && (
            <Button type="link" size="small" icon={<SendOutlined />} data-testid={`blog-publish-${record.id}`}>
              {t('content.blog.publish')}
            </Button>
          )}
          <Button type="link" size="small" danger icon={<DeleteOutlined />} data-testid={`blog-delete-${record.id}`}>
            {t('content.blog.delete')}
          </Button>
        </div>
      ),
    },
  ];

  const testimonialColumns = [
    { title: t('content.testimonial.user'), dataIndex: 'user', key: 'user' },
    {
      title: t('content.testimonial.content'),
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: t('content.testimonial.rating'),
      dataIndex: 'rating',
      key: 'rating',
      render: (rating: number) => <Rate disabled defaultValue={rating} />,
    },
    {
      title: t('content.testimonial.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: TestimonialStatus) => (
        <Tag color={TESTIMONIAL_STATUS_COLORS[status]}>
          {t(`content.testimonial.${status}`)}
        </Tag>
      ),
    },
    {
      title: t('content.testimonial.actions'),
      key: 'actions',
      render: (_: unknown, record: Testimonial) => (
        <div className="flex gap-2">
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                data-testid={`testimonial-approve-${record.id}`}
              >
                {t('content.testimonial.approve')}
              </Button>
              <Button
                type="link"
                size="small"
                danger
                icon={<CloseOutlined />}
                data-testid={`testimonial-reject-${record.id}`}
              >
                {t('content.testimonial.reject')}
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'blogs',
      label: t('content.blogPosts'),
      children: (
        <Table
          columns={blogColumns}
          dataSource={MOCK_BLOGS}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          data-testid="blog-table"
          scroll={{ x: 'max-content' }}
        />
      ),
    },
    {
      key: 'testimonials',
      label: t('content.testimonials'),
      children: (
        <Table
          columns={testimonialColumns}
          dataSource={MOCK_TESTIMONIALS}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          data-testid="testimonial-table"
          scroll={{ x: 'max-content' }}
        />
      ),
    },
  ];

  return (
    <div data-testid="admin-content-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="content-title">
        {t('content.title')}
      </h1>

      <Tabs items={tabItems} data-testid="content-tabs" />
    </div>
  );
}
