import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import BlogPostContent from './BlogPostContent';

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

const BLOG_POSTS: Record<string, BlogPostData> = {
  'thailand-company-registration-guide': {
    slug: 'thailand-company-registration-guide',
    title: '泰国公司注册完全指南：从零开始的外资企业设立流程',
    excerpt: '详细介绍外国人在泰国注册公司的完整流程，包括BOI投资促进、公司类型选择、注册资本要求等关键信息。',
    content: `
## 泰国公司注册概述

泰国作为东南亚重要的经济体，吸引了大量外国投资者。本文将详细介绍在泰国注册公司的完整流程。

## 公司类型选择

在泰国，外国投资者可以选择以下几种公司类型：

1. **泰国有限公司（Thai Limited Company）** - 最常见的公司形式
2. **BOI 促进企业** - 享受税收优惠和外资持股放宽
3. **外国人经商许可企业** - 需要获得特别许可

## 注册流程

### 第一步：名称核准
向商业发展厅（DBD）提交公司名称申请，通常需要1-3个工作日。

### 第二步：制定公司章程
准备公司章程（Memorandum of Association），包括公司目的、注册资本、股东信息等。

### 第三步：召开法定会议
召开股东法定会议，通过公司章程和任命董事。

### 第四步：注册登记
向商业发展厅提交注册申请，获得公司注册证书。

## 注意事项

- 外资持股比例限制：一般行业外资不超过49%
- BOI企业可享受100%外资持股
- 最低注册资本要求因业务类型而异
    `,
    author: '李律师',
    authorBio: '资深跨境法律顾问，专注中泰企业法务15年',
    date: '2024-01-15',
    category: 'company',
    readTime: 8,
    tags: ['公司注册', '泰国法律', 'BOI', '外资企业'],
  },
  'thailand-visa-types-comparison': {
    slug: 'thailand-visa-types-comparison',
    title: '2024年泰国签证类型全面对比：选择最适合你的签证',
    excerpt: '对比分析泰国各类签证的申请条件、费用、有效期和适用人群。',
    content: `
## 泰国签证类型概览

泰国提供多种签证类型，适合不同需求的外国人。本文将全面对比各类签证的特点。

## 主要签证类型

### 旅游签证
适合短期访问泰国的游客，有效期60天，可延期30天。

### Non-B 商务签证
适合在泰国工作或经商的外国人，需要泰国公司担保。

### 精英签证（Thailand Elite）
长期居留签证，有效期5-20年，适合高净值人士。

### 退休签证
适合50岁以上的退休人士，需要满足财务要求。

### DTV 数字游民签证
2024年新推出，适合远程工作者，有效期5年。

## 如何选择

选择签证类型时需要考虑：停留时间、工作需求、预算和长期规划。
    `,
    author: '王顾问',
    authorBio: '泰国签证移民专家，帮助数千名客户成功获得签证',
    date: '2024-01-10',
    category: 'visa',
    readTime: 6,
    tags: ['泰国签证', '工作签证', '精英签证', 'DTV签证'],
  },
  'cross-border-contract-risks': {
    slug: 'cross-border-contract-risks',
    title: '中泰跨境合同常见风险与防范策略',
    excerpt: '分析中泰跨境商业合同中最常见的法律风险点，提供实用的风险防范建议。',
    content: `
## 跨境合同风险概述

中泰跨境商业活动日益频繁，合同纠纷也随之增加。了解常见风险是防范的第一步。

## 常见风险类型

### 1. 法律适用风险
合同未明确约定适用法律，导致纠纷时法律适用不确定。

### 2. 争议解决机制风险
未约定有效的争议解决条款，增加维权难度。

### 3. 语言版本风险
多语言合同版本之间存在差异，导致理解分歧。

## 防范策略

- 明确约定适用法律和争议解决机制
- 选择国际仲裁作为争议解决方式
- 确保多语言版本的一致性
- 定期进行合同合规审查
    `,
    author: '张律师',
    authorBio: '国际商事仲裁专家，处理过百余起跨境合同纠纷',
    date: '2024-01-05',
    category: 'contract',
    readTime: 10,
    tags: ['跨境合同', '合同风险', '国际仲裁', '中泰贸易'],
  },
};

export async function generateStaticParams() {
  const locales = ['zh', 'en', 'th'];
  return locales.flatMap((locale) =>
    Object.keys(BLOG_POSTS).map((slug) => ({ locale, slug }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS[slug];
  if (!post) return {};

  return {
    title: post.title,
    description: post.excerpt,
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS[slug];

  if (!post) {
    notFound();
  }

  const relatedPosts = Object.values(BLOG_POSTS)
    .filter((p) => p.slug !== slug && p.category === post.category)
    .slice(0, 2);

  return <BlogPostContent post={post} relatedPosts={relatedPosts} />;
}
