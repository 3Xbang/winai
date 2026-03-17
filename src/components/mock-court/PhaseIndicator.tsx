'use client';

import { Steps } from 'antd';
import { useTranslations } from 'next-intl';
import type { CourtPhase } from '@/types/mock-court';

const PHASES: CourtPhase[] = ['OPENING', 'EVIDENCE', 'DEBATE', 'CLOSING', 'VERDICT'];

interface PhaseIndicatorProps {
  currentPhase: CourtPhase;
}

export default function PhaseIndicator({ currentPhase }: PhaseIndicatorProps) {
  const t = useTranslations('mockCourt');
  const currentIndex = PHASES.indexOf(currentPhase);

  const items = PHASES.map((phase, index) => {
    let status: 'finish' | 'process' | 'wait' = 'wait';
    if (index < currentIndex) status = 'finish';
    else if (index === currentIndex) status = 'process';

    return {
      title: t(`phases.${phase}`),
      status,
    };
  });

  return (
    <div className="bg-white px-6 py-4 border-b border-gray-200" data-testid="phase-indicator">
      <Steps
        current={currentIndex}
        items={items as any}
        size="small"
        responsive
      />
    </div>
  );
}
