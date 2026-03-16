'use client';

import { useState, useMemo } from 'react';
import {
  Input,
  Select,
  DatePicker,
  Card,
  Tag,
  Button,
  Empty,
  Tooltip,
  Tabs,
} from 'antd';
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  EyeOutlined,
  MessageOutlined,
  FilePdfOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

type LegalDomain =
  | 'CORPORATE'
  | 'CONTRACT'
  | 'CRIMINAL'
  | 'CIVIL'
  | 'VISA'
  | 'TAX'
  | 'IP'
  | 'LABOR'
  | 'TRADE';

interface ConsultationSession {
  id: string;
  title: string;
  date: string;
  legalDomain: LegalDomain;
  bookmarked: boolean;
  messageCount: number;
  summary: string;
}

const LEGAL_DOMAINS: LegalDomain[] = [
  'CORPORATE',
  'CONTRACT',
  'CRIMINAL',
  'CIVIL',
  'VISA',
  'TAX',
  'IP',
  'LABOR',
  'TRADE',
];

const DOMAIN_COLORS: Record<LegalDomain, string> = {
  CORPORATE: 'blue',
  CONTRACT: 'green',
  CRIMINAL: 'red',
  CIVIL: 'orange',
  VISA: 'purple',
  TAX: 'cyan',
  IP: 'magenta',
  LABOR: 'gold',
  TRADE: 'geekblue',
};

const MOCK_SESSIONS: ConsultationSession[] = [
  {
    id: '1',
    title: '泰国公司注册外资持股比例咨询',
    date: '2024-01-15',
    legalDomain: 'CORPORATE',
    bookmarked: true,
    messageCount: 12,
    summary: '关于中国公民在泰国设立公司时外资持股比例限制的法律分析...',
  },
  {
    id: '2',
    title: '跨境贸易合同审查',
    date: '2024-01-10',
    legalDomain: 'CONTRACT',
    bookmarked: false,
    messageCount: 8,
    summary: '中泰跨境贸易合同条款审查及风险识别...',
  },
  {
    id: '3',
    title: '泰国精英签证申请咨询',
    date: '2024-01-05',
    legalDomain: 'VISA',
    bookmarked: true,
    messageCount: 6,
    summary: '泰国精英签证申请条件、所需材料和办理流程...',
  },
  {
    id: '4',
    title: '劳动合同纠纷分析',
    date: '2023-12-20',
    legalDomain: 'LABOR',
    bookmarked: false,
    messageCount: 15,
    summary: '中泰劳动法差异分析及劳动合同纠纷处理建议...',
  },
  {
    id: '5',
    title: '知识产权跨境保护策略',
    date: '2023-12-15',
    legalDomain: 'IP',
    bookmarked: false,
    messageCount: 10,
    summary: '中泰两国知识产权保护法律框架对比及跨境保护策略...',
  },
];

export default function HistoryPage() {
  const t = useTranslations('history');
  const tCommon = useTranslations('common');

  const [searchKeyword, setSearchKeyword] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<LegalDomain | 'ALL'>('ALL');
  const [sessions, setSessions] = useState<ConsultationSession[]>(MOCK_SESSIONS);
  const [activeTab, setActiveTab] = useState<string>('all');

  const bookmarkedSessions = useMemo(
    () => sessions.filter((s) => s.bookmarked),
    [sessions]
  );

  const filteredSessions = useMemo(() => {
    let result = activeTab === 'bookmarks' ? bookmarkedSessions : sessions;

    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(keyword) ||
          s.summary.toLowerCase().includes(keyword)
      );
    }

    if (selectedDomain !== 'ALL') {
      result = result.filter((s) => s.legalDomain === selectedDomain);
    }

    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].startOf('day').valueOf();
      const end = dateRange[1].endOf('day').valueOf();
      result = result.filter((s) => {
        const d = new Date(s.date).getTime();
        return d >= start && d <= end;
      });
    }

    return result;
  }, [sessions, bookmarkedSessions, searchKeyword, selectedDomain, dateRange, activeTab]);

  const handleToggleBookmark = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId ? { ...s, bookmarked: !s.bookmarked } : s
      )
    );
  };

  const handleExportPDF = (sessionId: string) => {
    // In production, this would call tRPC: session.exportPDF({ sessionId })
    console.log('Export PDF for session:', sessionId);
  };

  const domainOptions = [
    { value: 'ALL', label: t('allDomains') },
    ...LEGAL_DOMAINS.map((d) => ({
      value: d,
      label: t(`domains.${d}`),
    })),
  ];

  const tabItems = [
    {
      key: 'all',
      label: (
        <span>
          <HistoryOutlined className="mr-1" />
          {t('allSessions')}
        </span>
      ),
    },
    {
      key: 'bookmarks',
      label: (
        <span>
          <StarFilled className="mr-1 text-yellow-500" />
          {t('bookmarks')} ({bookmarkedSessions.length})
        </span>
      ),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6" data-testid="history-title">
          {t('title')}
        </h1>

        {/* Tabs: All / Bookmarks */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="mb-4"
          data-testid="history-tabs"
        />

        {/* Filters */}
        <div
          className="flex flex-col sm:flex-row gap-3 mb-6"
          data-testid="history-filters"
        >
          <Input
            placeholder={t('searchPlaceholder')}
            prefix={<SearchOutlined />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            className="sm:flex-1"
            data-testid="search-input"
          />
          <RangePicker
            onChange={(dates) =>
              setDateRange(dates as [Dayjs | null, Dayjs | null] | null)
            }
            placeholder={[t('startDate'), t('endDate')]}
            className="sm:w-64"
            data-testid="date-range-picker"
          />
          <Select
            value={selectedDomain}
            onChange={setSelectedDomain}
            options={domainOptions}
            className="sm:w-48"
            data-testid="domain-filter"
          />
        </div>

        {/* Session list */}
        <div className="flex flex-col gap-4" data-testid="session-list">
          {filteredSessions.length === 0 ? (
            <Empty
              description={t('noResults')}
              data-testid="empty-state"
            />
          ) : (
            filteredSessions.map((session) => (
              <Card
                key={session.id}
                className="hover:shadow-md transition-shadow"
                data-testid={`session-card-${session.id}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-base font-semibold truncate">
                        {session.title}
                      </h3>
                      <Tag color={DOMAIN_COLORS[session.legalDomain]}>
                        {t(`domains.${session.legalDomain}`)}
                      </Tag>
                    </div>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">
                      {session.summary}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{session.date}</span>
                      <span>
                        {t('messageCount', { count: session.messageCount })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Tooltip
                      title={
                        session.bookmarked
                          ? t('removeBookmark')
                          : t('addBookmark')
                      }
                    >
                      <Button
                        type="text"
                        icon={
                          session.bookmarked ? (
                            <StarFilled className="text-yellow-500" />
                          ) : (
                            <StarOutlined />
                          )
                        }
                        onClick={() => handleToggleBookmark(session.id)}
                        data-testid={`bookmark-btn-${session.id}`}
                        aria-label={
                          session.bookmarked
                            ? t('removeBookmark')
                            : t('addBookmark')
                        }
                      />
                    </Tooltip>
                    <Tooltip title={t('viewDetails')}>
                      <Link href={`/history/${session.id}`}>
                        <Button
                          type="text"
                          icon={<EyeOutlined />}
                          data-testid={`view-btn-${session.id}`}
                          aria-label={t('viewDetails')}
                        />
                      </Link>
                    </Tooltip>
                    <Tooltip title={t('continueConsultation')}>
                      <Link href={`/consultation?resume=${session.id}`}>
                        <Button
                          type="text"
                          icon={<MessageOutlined />}
                          data-testid={`continue-btn-${session.id}`}
                          aria-label={t('continueConsultation')}
                        />
                      </Link>
                    </Tooltip>
                    <Tooltip title={t('exportPDF')}>
                      <Button
                        type="text"
                        icon={<FilePdfOutlined />}
                        onClick={() => handleExportPDF(session.id)}
                        data-testid={`export-btn-${session.id}`}
                        aria-label={t('exportPDF')}
                      />
                    </Tooltip>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
