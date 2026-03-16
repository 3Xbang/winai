'use client';

import { useState, useMemo } from 'react';
import { Card, Input, Select, Pagination, Tag, Empty, Typography, Row, Col } from 'antd';
import {
  SearchOutlined,
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  category: string;
  readTime: number;
  coverImage?: string;
}

const MOCK_POSTS: BlogPost[] = [
  {
    slug: 'thailand-company-registration-guide',
    title: '泰国公司注册完全指南：从零开始的外资企业设立流程',
    excerpt: '详细介绍外国人在泰国注册公司的完整流程，包括BOI投资促进、公司类型选择、注册资本要求等关键信息。',
    author: '李律师',
    date: '2024-01-15',
    category: 'company',
    readTime: 8,
  },
  {
    slug: 'thailand-visa-types-comparison',
    title: '2024年泰国签证类型全面对比：选择最适合你的签证',
    excerpt: '对比分析泰国各类签证的申请条件、费用、有效期和适用人群，帮助您做出最佳选择。',
    author: '王顾问',
    date: '2024-01-10',
    category: 'visa',
    readTime: 6,
  },
  {
    slug: 'cross-border-contract-risks',
    title: '中泰跨境合同常见风险与防范策略',
    excerpt: '分析中泰跨境商业合同中最常见的法律风险点，提供实用的风险防范建议和合同条款优化方案。',
    author: '张律师',
    date: '2024-01-05',
    category: 'contract',
    readTime: 10,
  },
  {
    slug: 'thailand-labor-law-essentials',
    title: '泰国劳动法核心要点：雇主必知的合规指南',
    excerpt: '解读泰国劳动保护法的核心条款，包括最低工资、工作时间、解雇补偿和外籍员工管理等关键内容。',
    author: '陈律师',
    date: '2023-12-28',
    category: 'labor',
    readTime: 7,
  },
  {
    slug: 'china-thailand-tax-planning',
    title: '中泰双重征税协定解读与税务筹划实务',
    excerpt: '深入解读中泰避免双重征税协定的核心条款，提供跨境经营的税务筹划策略和合规建议。',
    author: '刘税务师',
    date: '2023-12-20',
    category: 'tax',
    readTime: 9,
  },
  {
    slug: 'ip-protection-in-thailand',
    title: '在泰国保护知识产权：商标、专利与版权实务指南',
    excerpt: '全面介绍在泰国进行知识产权保护的法律框架、注册流程和维权途径。',
    author: '赵律师',
    date: '2023-12-15',
    category: 'ip',
    readTime: 8,
  },
];

const CATEGORIES = ['company', 'visa', 'contract', 'labor', 'tax', 'ip'] as const;
const PAGE_SIZE = 4;

export default function BlogListPage() {
  const t = useTranslations('blog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredPosts = useMemo(() => {
    return MOCK_POSTS.filter((post) => {
      const matchesSearch =
        !searchQuery ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === 'all' || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const paginatedPosts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPosts.slice(start, start + PAGE_SIZE);
  }, [filteredPosts, currentPage]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      company: 'blue',
      visa: 'green',
      contract: 'orange',
      labor: 'purple',
      tax: 'red',
      ip: 'cyan',
    };
    return colors[category] || 'default';
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8" data-testid="blog-list-page">
      <div className="max-w-5xl mx-auto">
        <Title level={1} data-testid="blog-title">{t('title')}</Title>
        <Paragraph className="text-gray-500 mb-6" data-testid="blog-subtitle">
          {t('subtitle')}
        </Paragraph>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8" data-testid="blog-filters">
          <Input
            prefix={<SearchOutlined />}
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="flex-1"
            data-testid="blog-search"
            allowClear
          />
          <Select
            value={selectedCategory}
            onChange={(value) => {
              setSelectedCategory(value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-48"
            data-testid="blog-category-filter"
          >
            <Option value="all">{t('allCategories')}</Option>
            {CATEGORIES.map((cat) => (
              <Option key={cat} value={cat}>
                {t(`categories.${cat}`)}
              </Option>
            ))}
          </Select>
        </div>

        {/* Blog Post Cards */}
        {paginatedPosts.length === 0 ? (
          <Empty description={t('noResults')} data-testid="blog-no-results" />
        ) : (
          <Row gutter={[16, 16]} data-testid="blog-posts-grid">
            {paginatedPosts.map((post) => (
              <Col xs={24} md={12} key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="block">
                  <Card
                    hoverable
                    className="h-full"
                    data-testid={`blog-card-${post.slug}`}
                  >
                    <Tag color={getCategoryColor(post.category)} className="mb-2">
                      {t(`categories.${post.category}`)}
                    </Tag>
                    <Title level={4} className="!mb-2">{post.title}</Title>
                    <Paragraph className="text-gray-600 !mb-3" ellipsis={{ rows: 2 }}>
                      {post.excerpt}
                    </Paragraph>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span>
                        <UserOutlined className="mr-1" />
                        {post.author}
                      </span>
                      <span>
                        <CalendarOutlined className="mr-1" />
                        {post.date}
                      </span>
                      <span>
                        <ClockCircleOutlined className="mr-1" />
                        {t('readTime', { min: post.readTime })}
                      </span>
                    </div>
                  </Card>
                </Link>
              </Col>
            ))}
          </Row>
        )}

        {/* Pagination */}
        {filteredPosts.length > PAGE_SIZE && (
          <div className="flex justify-center mt-8" data-testid="blog-pagination">
            <Pagination
              current={currentPage}
              total={filteredPosts.length}
              pageSize={PAGE_SIZE}
              onChange={setCurrentPage}
              showSizeChanger={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
