'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button, Input, Empty, Spin } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useSSEStream } from '@/hooks/useSSEStream';
import CourtMessage from './CourtMessage';
import type {
  CourtPhase,
  CourtMessageData,
  CourtEvidenceData,
  CourtObjectionData,
  ObjectionInput,
} from '@/types/mock-court';
import ObjectionDialog from './ObjectionDialog';

const { TextArea } = Input;

interface CourtRoomProps {
  sessionId: string;
  currentPhase: CourtPhase;
  messages: CourtMessageData[];
  evidenceItems: CourtEvidenceData[];
  hasPendingObjection: boolean;
  pendingObjection: CourtObjectionData | null;
  onPhaseChange: (phase: CourtPhase) => void;
  onNewMessages: (msgs: CourtMessageData[]) => void;
  onEvidenceUpdate: (items: CourtEvidenceData[]) => void;
}

export default function CourtRoom({
  sessionId,
  currentPhase,
  messages,
  hasPendingObjection,
  pendingObjection,
  onPhaseChange,
  onNewMessages,
  onEvidenceUpdate,
}: CourtRoomProps) {
  const t = useTranslations('mockCourt');
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isStreaming, start } = useSSEStream();

  const isVerdictPhase = currentPhase === 'VERDICT';
  const inputDisabled = isVerdictPhase || isStreaming || sending || hasPendingObjection;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || inputDisabled) return;

    setSending(true);
    setInputValue('');

    // Optimistically add user message
    const userMsg: CourtMessageData = {
      id: `temp-${Date.now()}`,
      phase: currentPhase,
      senderRole: 'USER',
      content: trimmed,
      createdAt: new Date(),
    };
    onNewMessages([...messages, userMsg]);

    // Stream AI response via SSE
    let streamedContent = '';
    const streamingMsgId = `streaming-${Date.now()}`;

    await start({
      url: '/api/mock-court/stream',
      body: { sessionId, content: trimmed },
      onChunk: (chunk) => {
        try {
          const parsed = JSON.parse(chunk);
          if (parsed.content) {
            streamedContent += parsed.content;
          }
          // Update messages with streaming AI response
          const aiMsg: CourtMessageData = {
            id: streamingMsgId,
            phase: parsed.phase || currentPhase,
            senderRole: parsed.role || 'OPPOSING_COUNSEL',
            content: streamedContent,
            createdAt: new Date(),
          };
          onNewMessages([...messages, userMsg, aiMsg]);

          // Handle phase transition
          if (parsed.phase && parsed.phase !== currentPhase) {
            onPhaseChange(parsed.phase);
          }
        } catch {
          // Plain text chunk
          streamedContent += chunk;
          const aiMsg: CourtMessageData = {
            id: streamingMsgId,
            phase: currentPhase,
            senderRole: 'OPPOSING_COUNSEL',
            content: streamedContent,
            createdAt: new Date(),
          };
          onNewMessages([...messages, userMsg, aiMsg]);
        }
      },
      onComplete: () => {
        setSending(false);
        // Reload session to get server-persisted messages
        reloadSession();
      },
      onError: (error) => {
        setSending(false);
        console.error('SSE stream error:', error);
      },
    });

    setSending(false);
  }, [inputValue, inputDisabled, currentPhase, sessionId, messages, onNewMessages, onPhaseChange, start]);

  const reloadSession = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/trpc/mockCourt.getSession?input=${encodeURIComponent(JSON.stringify({ sessionId }))}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      const data = await res.json();
      if (res.ok && data?.result?.data) {
        const session = data.result.data;
        onNewMessages(session.messages ?? []);
        if (session.currentPhase) onPhaseChange(session.currentPhase);
        if (session.evidenceItems) onEvidenceUpdate(session.evidenceItems);
      }
    } catch {
      // Silently fail — user can refresh
    }
  }, [sessionId, onNewMessages, onPhaseChange, onEvidenceUpdate]);

  const handleRaiseObjection = useCallback(async (objection: ObjectionInput) => {
    const res = await fetch('/api/trpc/mockCourt.raiseObjection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, objection }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data?.error?.message ?? t('errors.createFailed'));
    }
    await reloadSession();
  }, [sessionId, reloadSession, t]);

  const handleRespondToObjection = useCallback(async (response: string) => {
    const res = await fetch('/api/trpc/mockCourt.respondToObjection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, response }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data?.error?.message ?? t('errors.createFailed'));
    }
    await reloadSession();
  }, [sessionId, reloadSession, t]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="court-room">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4" data-testid="messages-container">
        {messages.length === 0 ? (
          <Empty
            description={t('empty.noMessages')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          messages.map((msg) => (
            <CourtMessage key={msg.id} message={msg} />
          ))
        )}
        {isStreaming && (
          <div className="flex justify-center py-2">
            <Spin size="small" />
            <span className="ml-2 text-gray-400 text-sm">{t('loading.aiThinking')}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white p-4" data-testid="input-area">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextArea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isVerdictPhase ? '' : t('messagePlaceholder')}
              autoSize={{ minRows: 1, maxRows: 4 }}
              disabled={inputDisabled}
              data-testid="court-input"
            />
          </div>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim() || inputDisabled}
            data-testid="court-send-btn"
            aria-label={t('sendMessage')}
          />
          <ObjectionDialog
            sessionId={sessionId}
            currentPhase={currentPhase}
            pendingObjection={pendingObjection}
            onRaiseObjection={handleRaiseObjection}
            onRespondToObjection={handleRespondToObjection}
          />
        </div>
      </div>
    </div>
  );
}
