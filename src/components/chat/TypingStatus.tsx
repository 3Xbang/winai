'use client';

import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export type ProcessingPhase = 'analyzing' | 'searching' | 'generating' | 'idle';

interface TypingStatusProps {
  phase: ProcessingPhase;
  visible: boolean;
}

export default function TypingStatus({ phase, visible }: TypingStatusProps) {
  const t = useTranslations('consultation');

  if (!visible || phase === 'idle') return null;

  const phaseLabels: Record<Exclude<ProcessingPhase, 'idle'>, string> = {
    analyzing: t('statusAnalyzing'),
    searching: t('statusSearching'),
    generating: t('statusGenerating'),
  };

  return (
    <div
      className="flex items-center gap-2 text-gray-500 ml-12 mb-4 animate-pulse"
      data-testid="typing-status"
      role="status"
      aria-live="polite"
    >
      <Spin indicator={<LoadingOutlined spin />} size="small" />
      <span className="text-sm">{phaseLabels[phase]}</span>
    </div>
  );
}
