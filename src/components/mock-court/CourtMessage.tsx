'use client';

import { Tag } from 'antd';
import { useTranslations } from 'next-intl';
import type { CourtMessageData } from '@/types/mock-court';

interface CourtMessageProps {
  message: CourtMessageData;
}

const ROLE_STYLES: Record<string, { align: string; bg: string; text: string; tagColor: string }> = {
  USER: {
    align: 'justify-end',
    bg: 'bg-blue-500',
    text: 'text-white',
    tagColor: 'blue',
  },
  JUDGE: {
    align: 'justify-center',
    bg: 'bg-amber-50 border border-amber-300',
    text: 'text-amber-900',
    tagColor: 'gold',
  },
  OPPOSING_COUNSEL: {
    align: 'justify-start',
    bg: 'bg-red-50 border border-red-200',
    text: 'text-red-900',
    tagColor: 'red',
  },
  WITNESS: {
    align: 'justify-start',
    bg: 'bg-green-50 border border-green-200',
    text: 'text-green-900',
    tagColor: 'green',
  },
  SYSTEM: {
    align: 'justify-center',
    bg: 'bg-gray-100 border border-gray-200',
    text: 'text-gray-600',
    tagColor: 'default',
  },
};

export default function CourtMessage({ message }: CourtMessageProps) {
  const t = useTranslations('mockCourt');
  const style = ROLE_STYLES[message.senderRole] ?? ROLE_STYLES.SYSTEM;
  const isCenter = message.senderRole === 'JUDGE' || message.senderRole === 'SYSTEM';

  return (
    <div
      className={`flex ${style.align} mb-4`}
      data-testid={`court-message-${message.id}`}
    >
      <div className={`max-w-[80%] ${isCenter ? 'max-w-[90%]' : ''}`}>
        {/* Role label + phase tag */}
        <div className={`flex items-center gap-2 mb-1 ${message.senderRole === 'USER' ? 'justify-end' : isCenter ? 'justify-center' : 'justify-start'}`}>
          {message.senderRole !== 'USER' && (
            <Tag color={style.tagColor} className="!m-0">
              {t(`aiRoles.${message.senderRole}`)}
            </Tag>
          )}
          <span className="text-xs text-gray-400">
            {t(`phases.${message.phase}`)}
          </span>
        </div>

        {/* Message bubble */}
        <div
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${style.bg} ${style.text}`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-gray-400 mt-1 ${message.senderRole === 'USER' ? 'text-right' : isCenter ? 'text-center' : 'text-left'}`}>
          {message.createdAt instanceof Date
            ? message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
