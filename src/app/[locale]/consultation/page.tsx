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

const MOCK_IRAC = {
  issue: '本案的核心争议焦点在于：中国公民在泰国设立公司时，外资持股比例是否违反了泰国《外国人经商法》的限制规定。',
  rule: '根据泰国《外国人经商法》（Foreign Business Act B.E. 2542）第8条规定，外国人不得从事附表一至附表三所列的受限业务。《外国人经商法》第4条将"外国人"定义为持有超过49%股份的法人实体。\n\n同时，根据中国《公司法》第23条，设立有限责任公司应当具备法定条件。',
  analysis: '根据用户提供的事实，拟设立的公司中方持股60%，超过了泰国法律规定的49%外资持股上限。这意味着该公司将被视为"外国法人"，受到《外国人经商法》的业务限制。\n\n需要评估拟从事的业务是否属于受限业务清单，如属于，则需要申请外国人经商许可证（Foreign Business License）或通过BOI投资促进获得豁免。',
  conclusion: '建议调整股权结构至外资49%以内，或申请BOI投资促进以获得外资持股豁免。如选择调整股权结构，需确保泰方股东为真实投资者，避免代持安排被认定为违法。',
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: '您好！我是中泰智能法律专家系统的AI法律顾问。我可以为您提供中国和泰国法律事务的专业咨询，包括企业合规、合同审查、案件分析、签证咨询等服务。\n\n请问有什么法律问题需要咨询？',
    timestamp: new Date(Date.now() - 60000),
  },
];

/** Page size for historical message loading */
const HISTORY_PAGE_SIZE = 20;

const SESSION_KEY = 'winai_chat_messages';

function serializeMessages(msgs: ChatMessage[]): string {
  return JSON.stringify(msgs.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })));
}

function deserializeMessages(raw: string): ChatMessage[] {
  try {
    const parsed = JSON.parse(raw);
    return parsed.map((m: ChatMessage & { timestamp: string }) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  } catch {
    return [];
  }
}

function loadSavedMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return INITIAL_MESSAGES;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const msgs = deserializeMessages(raw);
      if (msgs.length > 0) return msgs;
    }
  } catch {}
  return INITIAL_MESSAGES;
}

function useStreamingText(text: string, isActive: boolean, speed = 5) {
  const [displayed, setDisplayed] = useState('');
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayed('');
      setIsDone(false);
      return;
    }

    let index = 0;
    setDisplayed('');
    setIsDone(false);

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayed(text.slice(0, index + 1));
        index++;
      } else {
        setIsDone(true);
        clearInterval(timer);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, isActive, speed]);

  return { displayed, isDone };
}

export default function ConsultationPage() {
  const t = useTranslations('consultation');
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSavedMessages());
  const [isLoading, setIsLoading] = useState(false);
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const currentStreamingMsg = messages.find((m) => m.id === streamingMessageId);
  const { displayed: streamedText, isDone: streamingDone } = useStreamingText(
    currentStreamingMsg?.content ?? '',
    !!streamingMessageId
  );

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamedText]);

  // Persist messages to sessionStorage
  useEffect(() => {
    if (messages === INITIAL_MESSAGES) return;
    try {
      sessionStorage.setItem(SESSION_KEY, serializeMessages(messages));
    } catch {}
  }, [messages]);

  // When streaming finishes, clear streaming state
  useEffect(() => {
    if (streamingDone && streamingMessageId) {
      setStreamingMessageId(null);
      setProcessingPhase('idle');
    }
  }, [streamingDone, streamingMessageId]);

  // Scroll-to-top detection for loading history
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollTop <= 100 && hasMoreHistory && !isLoadingHistory) {
        loadHistory();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMoreHistory, isLoadingHistory]);

  const loadHistory = useCallback(async () => {
    // No mock history - real history is loaded via session router per user
    setHasMoreHistory(false);
  }, []);

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
        // Build conversation history for context
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
          isStreaming: false,
          detectedLanguage: 'zh',
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingMessageId(null);
      } catch (error) {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `抱歉，AI 服务暂时无法响应：${error instanceof Error ? error.message : '未知错误'}。请稍后重试。`,
          timestamp: new Date(),
          isStreaming: false,
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

      {/* Disclaimer banner */}
      <DisclaimerBanner />

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50"
        data-testid="message-list"
      >
        {/* History loading indicator */}
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
            <MessageBubble
              message={msg}
              typingText={msg.id === streamingMessageId ? streamedText : undefined}
            />
            {/* Show IRAC after streaming completes or if not streaming */}
            {msg.iracAnalysis && msg.id !== streamingMessageId && (
              <div className="ml-12 mr-4">
                <IRACDisplay data={msg.iracAnalysis} />
              </div>
            )}
            {/* Intent classification tags */}
            {msg.intentTags && msg.intentTags.length > 0 && msg.id !== streamingMessageId && (
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
            {/* Follow-up suggestions */}
            {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && msg.id !== streamingMessageId && (
              <div className="ml-12 mr-4 mb-3 flex gap-2 flex-wrap">
                {msg.followUpSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    disabled={isLoading || !!streamingMessageId}
                    className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-full hover:bg-gray-50 hover:border-blue-400 transition-colors disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {/* Show risk warnings */}
            {msg.riskWarnings && msg.id !== streamingMessageId && (
              <div className="ml-12 mr-4">
                {msg.riskWarnings.map((warning, i) => (
                  <RiskWarningAlert key={i} level={warning.level} message={warning.message} />
                ))}
              </div>
            )}
            {/* Show lawyer advice for criminal cases */}
            {msg.riskWarnings?.some((w) => w.level === 'high') && msg.id !== streamingMessageId && (
              <div className="ml-12 mr-4">
                <LawyerAdviceNotice />
              </div>
            )}
          </div>
        ))}

        {/* Processing status indicator */}
        <TypingStatus phase={processingPhase} visible={isLoading} />

        {/* Legacy loading indicator fallback */}
        {isLoading && processingPhase === 'idle' && (
          <div className="flex items-center gap-2 text-gray-400 ml-12 mb-4" data-testid="loading-indicator">
            <Spin indicator={<LoadingOutlined spin />} size="small" />
            <span className="text-sm">{t('typing')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput onSend={handleSend} disabled={isLoading || !!streamingMessageId} />
    </div>
  );
}
