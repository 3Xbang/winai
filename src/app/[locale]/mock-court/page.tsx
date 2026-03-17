'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Card,
  Form,
  Select,
  Input,
  InputNumber,
  Button,
  Typography,
  Spin,
  Modal,
  List,
  Empty,
  Alert,
  message,
} from 'antd';
import { ImportOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { getSupplementaryFields } from '@/lib/mock-court-validation';
import type { CaseType } from '@prisma/client';

// ─── Subscription Tier Quota Config ─────────────────────────
type SubscriptionTier = 'FREE' | 'STANDARD' | 'VIP';

const TIER_QUOTA: Record<SubscriptionTier, { monthly: number | null; allowedDifficulties: string[] }> = {
  FREE: { monthly: 2, allowedDifficulties: ['BEGINNER'] },
  STANDARD: { monthly: 10, allowedDifficulties: ['BEGINNER', 'INTERMEDIATE'] },
  VIP: { monthly: null, allowedDifficulties: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
};

const { TextArea } = Input;
const { Option } = Select;

const CASE_TYPES = [
  'CONTRACT_DISPUTE',
  'TORT',
  'LABOR_DISPUTE',
  'IP_DISPUTE',
  'CROSS_BORDER_TRADE',
  'OTHER',
] as const;

const JURISDICTIONS = ['CHINA', 'THAILAND', 'ARBITRATION'] as const;
const DIFFICULTY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
const USER_ROLES = ['PLAINTIFF_LAWYER', 'DEFENDANT_LAWYER'] as const;

interface FormValues {
  caseType: string;
  caseDescription: string;
  jurisdiction: string;
  userRole: string;
  difficulty: string;
  supplementary: Record<string, unknown>;
}

interface CaseAnalysisSummary {
  sessionId: string;
  title?: string;
  legalDomain?: string;
  jurisdiction?: string;
  createdAt: string;
}

export default function MockCourtPage() {
  const t = useTranslations('mockCourt');
  const router = useRouter();
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [caseAnalyses, setCaseAnalyses] = useState<CaseAnalysisSummary[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // ─── Subscription tier & quota state ──────────────────────
  const [userTier, setUserTier] = useState<SubscriptionTier>('FREE');
  const [monthlyUsed, setMonthlyUsed] = useState(0);

  // Fetch user subscription info on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/trpc/subscription.checkQuota', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (res.ok && data?.result?.data) {
          const quota = data.result.data;
          setUserTier((quota.tier as SubscriptionTier) ?? 'FREE');
          setMonthlyUsed(quota.monthlyUsed ?? 0);
        }
      } catch {
        // Fallback to FREE tier on error
      }
    })();
  }, []);

  // Fetch mock-court specific monthly usage count
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/trpc/mockCourt.listSessions', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (res.ok && data?.result?.data) {
          const sessions = data.result.data as { createdAt: string }[];
          const now = new Date();
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const thisMonthCount = sessions.filter(
            (s) => new Date(s.createdAt) >= startOfMonth,
          ).length;
          setMonthlyUsed(thisMonthCount);
        }
      } catch {
        // Keep default
      }
    })();
  }, []);

  const tierQuota = TIER_QUOTA[userTier];
  const quotaExhausted = tierQuota.monthly !== null && monthlyUsed >= tierQuota.monthly;
  const remainingCount = tierQuota.monthly !== null ? Math.max(0, tierQuota.monthly - monthlyUsed) : null;

  const caseType = Form.useWatch('caseType', form) as CaseType | undefined;

  const supplementaryFields = useMemo(() => {
    if (!caseType) return [];
    return getSupplementaryFields(caseType);
  }, [caseType]);

  const handleCaseTypeChange = useCallback(() => {
    form.setFieldValue('supplementary', {});
  }, [form]);

  const handleOpenImportModal = useCallback(async () => {
    setImportModalOpen(true);
    setLoadingAnalyses(true);
    try {
      const res = await fetch('/api/trpc/mockCourt.listCaseAnalyses', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data?.result?.data) {
        setCaseAnalyses(data.result.data);
      } else {
        setCaseAnalyses([]);
      }
    } catch {
      setCaseAnalyses([]);
    } finally {
      setLoadingAnalyses(false);
    }
  }, []);

  const handleImportCaseAnalysis = useCallback(async (sessionId: string) => {
    setImportingId(sessionId);
    try {
      const res = await fetch(
        `/api/trpc/mockCourt.importFromCaseAnalysis?input=${encodeURIComponent(JSON.stringify({ caseAnalysisSessionId: sessionId }))}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        },
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Import failed');
      }

      const result = data?.result?.data;
      if (result) {
        if (result.caseDescription) {
          form.setFieldValue('caseDescription', result.caseDescription);
        }
        if (result.caseType) {
          form.setFieldValue('caseType', result.caseType);
        }
        if (result.jurisdiction) {
          form.setFieldValue('jurisdiction', result.jurisdiction);
        }
        message.success(t('importSuccess'));
      }

      setImportModalOpen(false);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t('errors.createFailed'),
      );
    } finally {
      setImportingId(null);
    }
  }, [form, t]);

  const handleSubmit = async (values: FormValues) => {
    setLoading(true);
    try {
      const payload = {
        caseType: values.caseType,
        caseDescription: values.caseDescription,
        jurisdiction: values.jurisdiction,
        userRole: values.userRole,
        difficulty: values.difficulty,
        supplementary: values.supplementary ?? {},
      };

      const res = await fetch('/api/trpc/mockCourt.create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg =
          data?.error?.message ?? data?.error ?? t('errors.createFailed');
        throw new Error(errorMsg);
      }

      const sessionId = data?.result?.data?.id;
      if (sessionId) {
        router.push(`/mock-court/${sessionId}`);
      } else {
        message.success(t('startSimulation'));
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t('errors.createFailed'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2" data-testid="mock-court-title">
          {t('title')}
        </h1>
        <Typography.Paragraph type="secondary" className="mb-6">
          {t('description')}
        </Typography.Paragraph>

        <Card>
          {/* Import from Case Analysis button */}
          <div className="mb-4">
            <Button
              icon={<ImportOutlined />}
              onClick={handleOpenImportModal}
              data-testid="import-from-analysis-btn"
            >
              {t('importFromAnalysis')}
            </Button>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              jurisdiction: 'CHINA',
              difficulty: 'BEGINNER',
              userRole: 'PLAINTIFF_LAWYER',
              supplementary: {},
            }}
            data-testid="mock-court-form"
          >
            {/* Case Type */}
            <Form.Item
              name="caseType"
              label={t('form.caseType')}
              rules={[
                { required: true, message: t('validation.caseTypeRequired') },
              ]}
            >
              <Select
                placeholder={t('form.selectCaseType')}
                size="large"
                data-testid="case-type-select"
                onChange={handleCaseTypeChange}
              >
                {CASE_TYPES.map((type) => (
                  <Option key={type} value={type}>
                    {t(`caseTypes.${type}`)}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* Case Description */}
            <Form.Item
              name="caseDescription"
              label={t('form.caseDescription')}
              rules={[
                {
                  required: true,
                  message: t('validation.caseDescriptionRequired'),
                },
                {
                  min: 50,
                  message: t('validation.caseDescriptionMinLength'),
                },
                {
                  max: 5000,
                  message: t('validation.caseDescriptionMaxLength'),
                },
              ]}
            >
              <TextArea
                rows={6}
                placeholder={t('form.caseDescriptionPlaceholder')}
                showCount
                maxLength={5000}
                data-testid="case-description-input"
              />
            </Form.Item>

            {/* Jurisdiction */}
            <Form.Item
              name="jurisdiction"
              label={t('form.jurisdiction')}
              rules={[
                {
                  required: true,
                  message: t('validation.jurisdictionRequired'),
                },
              ]}
            >
              <Select
                size="large"
                data-testid="jurisdiction-select"
              >
                {JURISDICTIONS.map((j) => (
                  <Option key={j} value={j}>
                    {t(`jurisdictions.${j}`)}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* User Role */}
            <Form.Item
              name="userRole"
              label={t('form.userRole')}
              rules={[
                {
                  required: true,
                  message: t('validation.userRoleRequired'),
                },
              ]}
            >
              <Select
                size="large"
                data-testid="user-role-select"
              >
                {USER_ROLES.map((role) => (
                  <Option key={role} value={role}>
                    {t(`userRoles.${role}`)}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* Difficulty Level */}
            <Form.Item
              name="difficulty"
              label={t('form.difficulty')}
              rules={[
                {
                  required: true,
                  message: t('validation.difficultyRequired'),
                },
              ]}
            >
              <Select
                size="large"
                data-testid="difficulty-select"
              >
                {DIFFICULTY_LEVELS.map((level) => {
                  const isAllowed = tierQuota.allowedDifficulties.includes(level);
                  return (
                    <Option key={level} value={level} disabled={!isAllowed}>
                      {t(`difficultyLevels.${level}`)}
                      {!isAllowed && ` — ${t('quota.difficultyLocked')}`}
                    </Option>
                  );
                })}
              </Select>
            </Form.Item>

            {/* Supplementary Fields (dynamic based on case type) */}
            {caseType && supplementaryFields.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supplementaryFields.map((field) => {
                  const labelKey = `form.supplementary.${field.key}` as const;
                  const placeholderKey =
                    `form.supplementary.${field.key}Placeholder` as const;

                  return (
                    <Form.Item
                      key={field.key}
                      name={['supplementary', field.key]}
                      label={t(labelKey)}
                      rules={
                        field.required
                          ? [{ required: true, message: t(labelKey) }]
                          : undefined
                      }
                    >
                      {field.type === 'number' ? (
                        <InputNumber
                          style={{ width: '100%' }}
                          placeholder={t(placeholderKey)}
                          min={0}
                          data-testid={`supplementary-${field.key}`}
                        />
                      ) : (
                        <Input
                          placeholder={t(placeholderKey)}
                          data-testid={`supplementary-${field.key}`}
                        />
                      )}
                    </Form.Item>
                  );
                })}
              </div>
            )}

            {/* Quota Alert */}
            {quotaExhausted && (
              <Form.Item>
                <Alert
                  type="warning"
                  showIcon
                  message={t('quota.limitReached')}
                  description={t('quota.upgradeHint')}
                  data-testid="quota-limit-alert"
                />
              </Form.Item>
            )}

            {/* Remaining count hint */}
            {!quotaExhausted && remainingCount !== null && (
              <Form.Item>
                <Typography.Text type="secondary" data-testid="remaining-count">
                  {t('quota.remainingCount', { count: remainingCount })}
                </Typography.Text>
              </Form.Item>
            )}

            {/* Submit */}
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                disabled={quotaExhausted}
                data-testid="start-simulation-btn"
              >
                {loading
                  ? t('loading.creatingSession')
                  : t('startSimulation')}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {loading && (
          <div className="text-center mt-4">
            <Spin size="large" />
            <p className="mt-2 text-gray-500">
              {t('loading.creatingSession')}
            </p>
          </div>
        )}

        {/* Import from Case Analysis Modal */}
        <Modal
          title={t('selectCaseAnalysis')}
          open={importModalOpen}
          onCancel={() => setImportModalOpen(false)}
          footer={null}
          data-testid="import-modal"
        >
          {loadingAnalyses ? (
            <div className="text-center py-8">
              <Spin />
              <p className="mt-2 text-gray-500">{t('loadingAnalyses')}</p>
            </div>
          ) : caseAnalyses.length === 0 ? (
            <Empty
              description={
                <div>
                  <p>{t('empty.noCaseAnalyses')}</p>
                  <p className="text-gray-400 text-sm">
                    {t('empty.noCaseAnalysesHint')}
                  </p>
                </div>
              }
              data-testid="no-analyses-empty"
            />
          ) : (
            <List
              dataSource={caseAnalyses}
              data-testid="case-analyses-list"
              renderItem={(item) => (
                <List.Item
                  key={item.sessionId}
                  actions={[
                    <Button
                      key="import"
                      type="link"
                      loading={importingId === item.sessionId}
                      onClick={() => handleImportCaseAnalysis(item.sessionId)}
                      data-testid={`import-btn-${item.sessionId}`}
                    >
                      {t('importFromAnalysis')}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={item.title || t('noTitle')}
                    description={
                      <span className="text-gray-400 text-xs">
                        {new Date(item.createdAt).toLocaleString()}
                        {item.legalDomain && ` · ${item.legalDomain}`}
                        {item.jurisdiction && ` · ${item.jurisdiction}`}
                      </span>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Modal>
      </div>
    </div>
  );
}
