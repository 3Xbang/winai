'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Typography, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import MessageBubble, { type ChatMessage } from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import IRACDisplay from '@/components/chat/IRACDisplay';
import { RiskWarningAlert, DisclaimerBanner, LawyerAdviceNotice } from '@/components/chat/RiskWarning';
import TypingStatus, { type ProcessingPhase } from '@/components/chat/TypingStatus';

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: '您好！我是中泰智能法律专家系统的AI法律顾问。我可以为您提供中国和泰国法律事务的专业咨询，包括企业合规、合同审查、案件分析、签证咨询等服务。\n\n请问有什么法律问题需要咨询？',
    timestamp: new Date(Date.now() - 60000),
  },
];

const HISTORY_PAGE_SIZE = 20;

export default function ConsultationPage() {
  const t = useTranslations('consultation');
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [isLoading, setIsLoading] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [hasMoreHistory] = useState(false);
  const [isLoadingHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setProcessingPhase('analyzing');

      const phaseTimer1 = setTimeout(() => setProcessingPhase('searching'), 500);
      const phaseTimer2 = setTimeout(() => setProcessingPhase('generating'), 1000);

      try {
        const history = messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, history }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'AI 服务异常');
        }

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.content || '抱歉，未能生成回复。',
          timestamp: new Date(),
          detectedLanguage: 'zh',
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (error) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `抱歉，AI 服务暂时无法响应：${error instanceof Error ? error.message : '未知错误'}。请稍后重试。`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        clearTimeout(phaseTimer1);
        clearTimeout(phaseTimer2);
        setIsLoading(false);
        setProcessingPhase('idle');
      }
    },
    [messages]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-gray-200 shadow-sm">
        <Typography.Title level={4} className="!mb-0">
          {t('title')}
        </Typography.Title>
      </div>

      <DisclaimerBanner />

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50"
        data-testid="message-list"
      >
        {isLoadingHistory && (
          <div className="flex justify-center py-3" data-testid="history-loading">
            <Spin indicator={<LoadingOutlined spin />} size="small" />
            <span className="ml-2 text-sm text-gray-400">{t('loadingHistory')}</span>
          </div>
        )}

        {!hasMoreHistory && messages.length > HISTORY_PAGE_SIZE && (
          <div className="text-center text-xs text-gray-400 py-2" data-testid="no-more-history">
            {t('noMoreHistory')}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            <MessageBubble message={msg} />
            {msg.iracAnalysis && (
              <div className="ml-12 mr-4">
                <IRACDisplay data={msg.iracAnalysis} />
              </div>
            )}
            {msg.intentTags && msg.intentTags.length > 0 && (
              <div className="ml-12 mr-4 mb-2 flex gap-1 flex-wrap">
                {msg.intentTags.map((tag) => (
                  <span key={tag} className="inline-block px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded-full border border-blue-200">
                    {tag}
                  </span>
                ))}
                {msg.detectedLanguage && (
                  <span className="inline-block px-2 py-0.5 text-xs bg-gray-50 text-gray-500 rounded-full border border-gray-200">
                    🌐 {msg.detectedLanguage === 'zh' ? '中文' : msg.detectedLanguage === 'th' ? 'ไทย' : 'EN'}
                  </span>
                )}
              </div>
            )}
            {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
              <div className="ml-12 mr-4 mb-3 flex gap-2 flex-wrap">
                {msg.followUpSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:border-blue-400 transition-colors disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {msg.riskWarnings && (
              <div className="ml-12 mr-4">
                {msg.riskWarnings.map((warning, i) => (
                  <RiskWarningAlert key={i} level={warning.level} message={warning.message} />
                ))}
              </div>
            )}
            {msg.riskWarnings?.some((w) => w.level === 'high') && (
              <div className="ml-12 mr-4">
                <LawyerAdviceNotice />
              </div>
            )}
          </div>
        ))}

        <TypingStatus phase={processingPhase} visible={isLoading} />

        {isLoading && processingPhase === 'idle' && (
          <div className="flex items-center gap-2 text-gray-400 ml-12 mb-4" data-testid="loading-indicator">
            <Spin indicator={<LoadingOutlined spin />} size="small" />
            <span className="text-sm">{t('typing')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={isLoading} />
    </div>
  );
}
