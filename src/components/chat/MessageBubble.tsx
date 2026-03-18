'use client';

import { Avatar } from 'antd';
import { UserOutlined, RobotOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  iracAnalysis?: {
    issue: string;
    rule: string;
    analysis: string;
    conclusion: string;
  };
  riskWarnings?: {
    level: 'high' | 'medium' | 'info';
    message: string;
  }[];
  intentTags?: string[];
  followUpSuggestions?: string[];
  detectedLanguage?: string;
}

interface MessageBubbleProps {
  message: ChatMessage;
  typingText?: string;
}

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="Typing">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
    </span>
  );
}

function formatContent(content: string) {
  // Simple markdown-like rendering: bold, inline code
  return content.split('\n').map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={j}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code key={j} className="bg-gray-100 px-1 rounded text-sm">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </span>
  ));
}

export default function MessageBubble({ message, typingText }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const displayContent = (typingText !== undefined && typingText !== null) ? typingText : message.content;
  const showTypingIndicator = message.isStreaming && !typingText && !message.content;

  return (
    <div
      className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
      data-testid={`message-${message.id}`}
    >
      <Avatar
        size={36}
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        className={`shrink-0 ${isUser ? '!bg-blue-500' : '!bg-gray-600'}`}
      />
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-500 text-white rounded-tr-none'
              : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none shadow-sm'
          }`}
        >
          {showTypingIndicator ? (
            <TypingIndicator />
          ) : (
            <div className="whitespace-pre-wrap">{formatContent(displayContent)}</div>
          )}
        </div>
        <span className={`text-xs text-gray-400 mt-1 ${isUser ? 'text-right' : 'text-left'}`} suppressHydrationWarning>
          {mounted ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
        </span>
      </div>
    </div>
  );
}
