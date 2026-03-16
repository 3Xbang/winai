'use client';

import { Typography, Card, Tag, Button, Divider } from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  ArrowLeftOutlined,
  TwitterOutlined,
  LinkedinOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Script from 'next/script';

const { Title, Paragraph, Text } = Typography;

interface BlogPostData {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorBio: string;
  date: string;
  category: string;
  readTime: number;
  tags: string[];
}

interface BlogPostContentProps {
  post: BlogPostData;
  relatedPosts: BlogPostData[];
}

export default function BlogPostContent({ post, relatedPosts }: BlogPostContentProps) {
  const t = useTranslations('blog');

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    datePublished: post.date,
    publisher: {
      '@type': 'Organization',
      name: 'China-Thailand Legal Expert System',
    },
    keywords: post.tags.join(', '),
  };

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
    <>
      <Script
        id={`jsonld-blog-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8"
        data-testid="blog-post-page"
      >
        <div className="max-w-3xl mx-auto">
          {/* Back Link */}
          <Link href="/blog" className="inline-flex items-center text-blue-500 mb-6">
            <ArrowLeftOutlined className="mr-1" />
            {t('backToBlog')}
          </Link>

          {/* Article Header */}
          <article data-testid="blog-article">
            <Tag color={getCategoryColor(post.category)} className="mb-3">
              {t(`categories.${post.category}`)}
            </Tag>
            <Title level={1} data-testid="blog-post-title">
              {post.title}
            </Title>
            <div className="flex items-center gap-4 text-sm text-gray-500 mb-6" data-testid="blog-post-meta">
              <span>
                <UserOutlined className="mr-1" />
                {post.author}
              </span>
              <span>
                <CalendarOutlined className="mr-1" />
                {t('publishedAt')} {post.date}
              </span>
              <span>
                <ClockCircleOutlined className="mr-1" />
                {t('readTime', { min: post.readTime })}
              </span>
            </div>

            {/* Article Content */}
            <Card className="mb-8" data-testid="blog-post-content">
              <div className="prose max-w-none">
                {post.content.split('\n').map((line, i) => {
                  if (line.startsWith('## ')) {
                    return (
                      <Title level={2} key={i} className="!mt-6 !mb-3">
                        {line.replace('## ', '')}
                      </Title>
                    );
                  }
                  if (line.startsWith('### ')) {
                    return (
                      <Title level={3} key={i} className="!mt-4 !mb-2">
                        {line.replace('### ', '')}
                      </Title>
                    );
                  }
                  if (line.trim().startsWith('- ')) {
                    return (
                      <li key={i} className="ml-4 mb-1">
                        {line.trim().replace('- ', '')}
                      </li>
                    );
                  }
                  if (line.trim().match(/^\d+\.\s/)) {
                    return (
                      <li key={i} className="ml-4 mb-1">
                        {line.trim()}
                      </li>
                    );
                  }
                  if (line.trim()) {
                    return (
                      <Paragraph key={i}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</Paragraph>
                    );
                  }
                  return null;
                })}
              </div>
            </Card>

            {/* Author Info */}
            <Card className="mb-8" data-testid="blog-author-info">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <UserOutlined className="text-xl text-blue-500" />
                </div>
                <div>
                  <Text strong>{post.author}</Text>
                  <Paragraph className="!mb-0 text-gray-500 text-sm">
                    {post.authorBio}
                  </Paragraph>
                </div>
              </div>
            </Card>

            {/* Share Buttons */}
            <div className="mb-8" data-testid="blog-share-buttons">
              <Text strong className="mr-4">{t('share')}:</Text>
              <Button
                icon={<TwitterOutlined />}
                className="mr-2"
                data-testid="share-twitter"
              >
                Twitter
              </Button>
              <Button
                icon={<LinkedinOutlined />}
                className="mr-2"
                data-testid="share-linkedin"
              >
                LinkedIn
              </Button>
              <Button
                icon={<WechatOutlined />}
                data-testid="share-wechat"
              >
                WeChat
              </Button>
            </div>

            {/* Tags */}
            <div className="mb-8" data-testid="blog-tags">
              {post.tags.map((tag) => (
                <Tag key={tag} className="mb-1">{tag}</Tag>
              ))}
            </div>
          </article>

          <Divider />

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section data-testid="related-posts">
              <Title level={3}>{t('relatedPosts')}</Title>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {relatedPosts.map((relatedPost) => (
                  <Link href={`/blog/${relatedPost.slug}`} key={relatedPost.slug}>
                    <Card hoverable data-testid={`related-post-${relatedPost.slug}`}>
                      <Tag color={getCategoryColor(relatedPost.category)} className="mb-2">
                        {t(`categories.${relatedPost.category}`)}
                      </Tag>
                      <Title level={5}>{relatedPost.title}</Title>
                      <div className="text-sm text-gray-400">
                        <span className="mr-3">
                          <UserOutlined className="mr-1" />
                          {relatedPost.author}
                        </span>
                        <span>
                          <CalendarOutlined className="mr-1" />
                          {relatedPost.date}
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
