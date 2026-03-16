'use client';

import { Collapse, Tag } from 'antd';
import {
  QuestionCircleOutlined,
  BookOutlined,
  FileSearchOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

interface IRACData {
  issue: string;
  rule: string;
  analysis: string;
  conclusion: string;
}

interface IRACDisplayProps {
  data: IRACData;
}

function highlightLawReferences(text: string) {
  // Highlight patterns like 《...》Article XX or law references
  const parts = text.split(/(《[^》]+》[^，。；\s]*|第[\d]+条|Article\s+\d+|Section\s+\d+)/g);
  return parts.map((part, i) => {
    if (/^《|^第[\d]+条|^Article\s+\d+|^Section\s+\d+/.test(part)) {
      return (
        <Tag key={i} color="blue" className="!mx-0.5 !my-0.5 !text-xs">
          {part}
        </Tag>
      );
    }
    return part;
  });
}

export default function IRACDisplay({ data }: IRACDisplayProps) {
  const t = useTranslations('consultation.irac');

  const items = [
    {
      key: 'issue',
      label: (
        <span className="flex items-center gap-2 font-medium">
          <QuestionCircleOutlined className="text-red-500" />
          {t('issue')}
        </span>
      ),
      children: <div className="text-sm leading-relaxed whitespace-pre-wrap">{data.issue}</div>,
    },
    {
      key: 'rule',
      label: (
        <span className="flex items-center gap-2 font-medium">
          <BookOutlined className="text-blue-500" />
          {t('rule')}
        </span>
      ),
      children: (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {highlightLawReferences(data.rule)}
        </div>
      ),
    },
    {
      key: 'analysis',
      label: (
        <span className="flex items-center gap-2 font-medium">
          <FileSearchOutlined className="text-orange-500" />
          {t('analysis')}
        </span>
      ),
      children: <div className="text-sm leading-relaxed whitespace-pre-wrap">{data.analysis}</div>,
    },
    {
      key: 'conclusion',
      label: (
        <span className="flex items-center gap-2 font-medium">
          <CheckCircleOutlined className="text-green-500" />
          {t('conclusion')}
        </span>
      ),
      children: (
        <div className="text-sm leading-relaxed whitespace-pre-wrap">{data.conclusion}</div>
      ),
    },
  ];

  return (
    <div className="my-3" data-testid="irac-display">
      <Collapse
        items={items}
        defaultActiveKey={['issue', 'conclusion']}
        size="small"
        className="!bg-blue-50/50"
      />
    </div>
  );
}
