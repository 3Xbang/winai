'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Segmented, Spin, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import PhaseIndicator from '@/components/mock-court/PhaseIndicator';
import CourtRoom from '@/components/mock-court/CourtRoom';
import EvidencePanel from '@/components/mock-court/EvidencePanel';
import PerformanceReport from '@/components/mock-court/PerformanceReport';
import type {
  CourtPhase,
  CourtMessageData,
  CourtEvidenceData,
  CourtObjectionData,
  MockCourtSessionDetail,
  EvidenceInput,
  PerformanceReportData,
} from '@/types/mock-court';

type ActiveView = 'courtroom' | 'report';

export default function MockCourtSessionPage() {
  const t = useTranslations('mockCourt');
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [currentPhase, setCurrentPhase] = useState<CourtPhase>('OPENING');
  const [messages, setMessages] = useState<CourtMessageData[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<CourtEvidenceData[]>([]);
  const [pendingObjection, setPendingObjection] = useState<CourtObjectionData | null>(null);
  const [hasPendingObjection, setHasPendingObjection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PerformanceReportData | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('courtroom');
  const [sessionStatus, setSessionStatus] = useState<string>('ACTIVE');
  const [exporting, setExporting] = useState(false);

  // Fetch the performance report when phase becomes VERDICT
  const loadReport = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/trpc/mockCourt.getReport?input=${encodeURIComponent(JSON.stringify({ sessionId }))}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      const data = await res.json();
      if (res.ok && data?.result?.data) {
        setReport(data.result.data);
      }
    } catch {
      // Report loading failure is non-critical; user can still view courtroom
    }
  }, [sessionId]);

  // Load session data on mount (supports session resume)
  const loadSession = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/trpc/mockCourt.getSession?input=${encodeURIComponent(JSON.stringify({ sessionId }))}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
      );
      const data = await res.json();

      if (!res.ok) {
        const errMsg = data?.error?.message ?? t('errors.sessionNotFound');
        setError(errMsg);
        return;
      }

      const session: MockCourtSessionDetail = data?.result?.data;
      if (session) {
        setCurrentPhase(session.currentPhase);
        setSessionStatus(session.status ?? 'ACTIVE');
        setMessages(session.messages ?? []);
        setEvidenceItems(session.evidenceItems ?? []);
        setHasPendingObjection(session.hasPendingObjection ?? false);

        // Find pending AI objection
        const pending = (session.objections ?? []).find(
          (o) => o.raisedBy === 'OPPOSING_COUNSEL' && o.ruling === 'PENDING',
        );
        setPendingObjection(pending ?? null);

        // If session already has a report, load it
        if (session.report) {
          setReport(session.report);
        }
      }
    } catch {
      setError(t('errors.sessionNotFound'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Auto-fetch report when phase transitions to VERDICT
  useEffect(() => {
    if (currentPhase === 'VERDICT' && !report) {
      loadReport();
    }
  }, [currentPhase, report, loadReport]);

  const handleSubmitEvidence = useCallback(async (evidence: EvidenceInput) => {
    const res = await fetch('/api/trpc/mockCourt.submitEvidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, evidence }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data?.error?.message ?? t('errors.createFailed'));
    }
    // Reload session to get updated evidence and messages
    await loadSession();
  }, [sessionId, t, loadSession]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/trpc/mockCourt.exportPDF', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data?.error?.message ?? t('errors.exportFailed'));
        return;
      }
      const base64 = data?.result?.data?.pdf;
      if (base64) {
        const html = atob(base64);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mock-court-${sessionId}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      message.error(t('errors.exportFailed'));
    } finally {
      setExporting(false);
    }
  }, [sessionId, t]);

  const showExportButton = currentPhase === 'VERDICT' || sessionStatus === 'COMPLETED';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-128px)]">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-500">{t('loading.loadingSession')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-128px)]">
        <div className="text-center text-red-500">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]" data-testid="mock-court-session">
      {/* Top: Phase progress indicator */}
      <PhaseIndicator currentPhase={currentPhase} />

      {/* View switcher + Export button */}
      {(report || showExportButton) && (
        <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between" data-testid="view-switcher">
          <div>
            {report && (
              <Segmented
                value={activeView}
                onChange={(val) => setActiveView(val as ActiveView)}
                options={[
                  { label: t('viewCourtroom'), value: 'courtroom' },
                  { label: t('viewReport'), value: 'report' },
                ]}
              />
            )}
          </div>
          {showExportButton && (
            <Button
              icon={<DownloadOutlined />}
              loading={exporting}
              onClick={handleExportPDF}
              data-testid="export-pdf-btn"
            >
              {t('exportRecord')}
            </Button>
          )}
        </div>
      )}

      {/* Report view */}
      {activeView === 'report' && report ? (
        <div className="flex-1 overflow-y-auto" data-testid="report-view">
          <PerformanceReport report={report} />
        </div>
      ) : (
        /* Courtroom view: messages + evidence panel */
        <div className="flex flex-1 overflow-hidden">
          {/* Center: CourtRoom (messages + input) */}
          <div className="flex-1 flex flex-col min-w-0">
            <CourtRoom
              sessionId={sessionId}
              currentPhase={currentPhase}
              messages={messages}
              evidenceItems={evidenceItems}
              hasPendingObjection={hasPendingObjection}
              pendingObjection={pendingObjection}
              onPhaseChange={setCurrentPhase}
              onNewMessages={setMessages}
              onEvidenceUpdate={setEvidenceItems}
            />
          </div>

          {/* Right: Evidence panel */}
          <div className="w-80 border-l border-gray-200 overflow-y-auto hidden lg:block">
            <EvidencePanel
              sessionId={sessionId}
              currentPhase={currentPhase}
              evidenceItems={evidenceItems}
              onSubmitEvidence={handleSubmitEvidence}
            />
          </div>
        </div>
      )}
    </div>
  );
}
