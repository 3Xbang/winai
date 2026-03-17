'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Form,
  Select,
  Input,
  InputNumber,
  Button,
  Typography,
  Divider,
  Checkbox,
  Spin,
  message,
} from 'antd';
import {
  FileTextOutlined,
  CopyOutlined,
  CheckOutlined,
  ArrowLeftOutlined,
  PlusOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  ContractType,
  OUTCOME_FIELD_CONFIG,
  PARTY_ROLE_LABELS,
  MIN_PARTIES,
  MAX_PARTIES,
} from '@/lib/contract-config';
import { validatePositiveNumber } from '@/lib/contract-validation';

const { TextArea } = Input;
const { Option } = Select;

const CONTRACT_TYPES = ['EMPLOYMENT', 'SALE', 'SERVICE', 'LEASE', 'PARTNERSHIP', 'OTHER'] as const;
const GOVERNING_LAW_OPTIONS = ['CN_LAW', 'TH_LAW', 'DUAL_LAW'] as const;
const DISPUTE_RESOLUTION_OPTIONS = ['NEGOTIATION', 'CIETAC_ARBITRATION', 'TAI_ARBITRATION', 'CN_COURT', 'TH_COURT'] as const;
const LANGUAGES = ['zh', 'en', 'th'] as const;

interface PartyFormValue {
  name: string;
  role: string;
  nationality?: string;
  address?: string;
}

interface DraftFormValues {
  contractType: string;
  parties: PartyFormValue[];
  userPartyIndex: number;
  desiredOutcomes: Record<string, string>;
  governingLaw: string;
  disputeResolution: string;
  languages: string[];
  specialClauses?: string;
}

export default function ContractDraftPage() {
  const t = useTranslations('contract.draft');
  const tCommon = useTranslations('common');
  const locale = useLocale() as 'zh' | 'en' | 'th';
  const [form] = Form.useForm<DraftFormValues>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const contractType = Form.useWatch('contractType', form) as ContractType | undefined;
  const parties = Form.useWatch('parties', form) as PartyFormValue[] | undefined;
  const userPartyIndex = Form.useWatch('userPartyIndex', form) as number | undefined;

  const outcomeFields = useMemo(() => {
    if (!contractType || !OUTCOME_FIELD_CONFIG[contractType]) return [];
    return OUTCOME_FIELD_CONFIG[contractType];
  }, [contractType]);

  const partyCount = parties?.length ?? MIN_PARTIES;
  const canAddParty = partyCount < MAX_PARTIES;

  const userPartyOptions = useMemo(() => {
    if (!parties) return [];
    return parties.map((p, i) => {
      const roleLabel = PARTY_ROLE_LABELS[locale]?.[i] ?? `Party ${i + 1}`;
      const name = p?.name?.trim() || '';
      const display = name ? `${roleLabel} (${name})` : roleLabel;
      return { value: i, label: display };
    });
  }, [parties, locale]);

  const handleContractTypeChange = useCallback(() => {
    // Clear outcome field values when contract type changes
    form.setFieldValue('desiredOutcomes', {});
  }, [form]);

  const handleGenerate = async (values: DraftFormValues) => {
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        contractType: values.contractType,
        parties: values.parties,
        userPartyIndex: values.userPartyIndex ?? 0,
        desiredOutcomes: values.desiredOutcomes ?? {},
        governingLaw: values.governingLaw,
        disputeResolution: values.disputeResolution,
        languages: values.languages,
        specialClauses: values.specialClauses,
      };

      const res = await fetch('/api/contract/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '合同生成失败');
      }

      setResult(data.content);
    } catch (err) {
      message.error(err instanceof Error ? err.message : tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (result) {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getDefaultParty = (index: number): PartyFormValue => ({
    name: '',
    role: PARTY_ROLE_LABELS[locale]?.[index] ?? '',
    nationality: '',
    address: '',
  });

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4">
          <Link href="/contract">
            <Button type="link" icon={<ArrowLeftOutlined />} className="!px-0">
              {tCommon('back')}
            </Button>
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-6" data-testid="draft-title">
          <FileTextOutlined className="mr-2" />
          {t('title')}
        </h1>

        <Card className="mb-6">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleGenerate}
            initialValues={{
              parties: [getDefaultParty(0), getDefaultParty(1)],
              userPartyIndex: 0,
              languages: ['zh'],
              desiredOutcomes: {},
            }}
            data-testid="draft-form"
          >
            {/* Contract Type */}
            <Form.Item
              name="contractType"
              label={t('contractType')}
              rules={[{ required: true, message: t('selectType') }]}
            >
              <Select
                placeholder={t('selectType')}
                size="large"
                data-testid="contract-type-select"
                onChange={handleContractTypeChange}
              >
                {CONTRACT_TYPES.map((type) => (
                  <Option key={type} value={type}>
                    {t(`types.${type}`)}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* User Party Selector */}
            <Form.Item
              name="userPartyIndex"
              label={t('iAm')}
              rules={[
                {
                  required: true,
                  message: t('validation.userPartyRequired'),
                },
              ]}
            >
              <Select
                placeholder={t('iAmPlaceholder')}
                size="large"
                data-testid="user-party-select"
              >
                {userPartyOptions.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Divider>{t('partyInfo')}</Divider>

            {/* Multi-Party Panels */}
            <Form.List name="parties">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field, index) => {
                    const isHighlighted = userPartyIndex === index;
                    const roleLabel = PARTY_ROLE_LABELS[locale]?.[index] ?? '';

                    return (
                      <div
                        key={field.key}
                        className={`mb-4 p-4 rounded-lg border-2 transition-colors ${
                          isHighlighted
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 bg-white'
                        }`}
                        data-testid={`party-panel-${index}`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <Typography.Text strong>
                            {t('partyLabel', { index: index + 1 })}
                            {isHighlighted && (
                              <span className="ml-2 text-blue-600 text-sm">
                                ({t('iAm')})
                              </span>
                            )}
                          </Typography.Text>
                          {index >= MIN_PARTIES && (
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined />}
                              onClick={() => {
                                remove(field.name);
                                // If the removed party was the selected user party,
                                // or if userPartyIndex is now out of range, reset to 0
                                const currentUserParty = form.getFieldValue('userPartyIndex');
                                const newLength = (parties?.length ?? MIN_PARTIES) - 1;
                                if (currentUserParty >= newLength) {
                                  form.setFieldValue('userPartyIndex', 0);
                                }
                              }}
                              data-testid={`remove-party-${index}`}
                            >
                              {t('removeParty')}
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Form.Item
                            name={[field.name, 'name']}
                            label={t('partyName')}
                            rules={[
                              {
                                required: true,
                                whitespace: true,
                                message: t('partyName'),
                              },
                            ]}
                          >
                            <Input data-testid={`party-${index}-name`} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'role']}
                            label={t('partyRole')}
                            initialValue={roleLabel}
                          >
                            <Input data-testid={`party-${index}-role`} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'nationality']}
                            label={t('partyNationality')}
                          >
                            <Input data-testid={`party-${index}-nationality`} />
                          </Form.Item>
                          <Form.Item
                            name={[field.name, 'address']}
                            label={t('partyAddress')}
                          >
                            <Input data-testid={`party-${index}-address`} />
                          </Form.Item>
                        </div>
                      </div>
                    );
                  })}

                  {/* Add Party Button */}
                  <div className="mb-4">
                    <Button
                      type="dashed"
                      onClick={() => {
                        const newIndex = fields.length;
                        add(getDefaultParty(newIndex));
                      }}
                      disabled={!canAddParty}
                      icon={<PlusOutlined />}
                      data-testid="add-party-btn"
                    >
                      {t('addParty')}
                    </Button>
                    {!canAddParty && (
                      <Typography.Text type="warning" className="ml-3">
                        {t('maxPartiesReached')}
                      </Typography.Text>
                    )}
                  </div>
                </>
              )}
            </Form.List>

            {/* Dynamic Outcome Fields */}
            {contractType && outcomeFields.length > 0 && (
              <>
                <Divider>{t('desiredOutcomes')}</Divider>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {outcomeFields.map((field) => {
                    const labelKey = `outcomes.${contractType}.${field.key}.label` as const;
                    const placeholderKey = `outcomes.${contractType}.${field.key}.placeholder` as const;
                    const fieldRules: Array<Record<string, unknown>> = [];

                    if (field.required) {
                      fieldRules.push({
                        required: true,
                        message: t('validation.outcomeRequired'),
                      });
                    }

                    if (field.inputType === 'number') {
                      fieldRules.push({
                        validator: (_: unknown, value: string | number | undefined) => {
                          if (value === undefined || value === '' || value === null) {
                            return field.required
                              ? Promise.reject(t('validation.outcomeRequired'))
                              : Promise.resolve();
                          }
                          const strVal = String(value);
                          if (!validatePositiveNumber(strVal)) {
                            return Promise.reject(t('validation.positiveNumber'));
                          }
                          return Promise.resolve();
                        },
                      });
                    }

                    const isFullWidth = field.inputType === 'textarea';

                    return (
                      <div
                        key={field.key}
                        className={isFullWidth ? 'md:col-span-2' : ''}
                      >
                        <Form.Item
                          name={['desiredOutcomes', field.key]}
                          label={t(labelKey)}
                          rules={fieldRules}
                        >
                          {field.inputType === 'textarea' ? (
                            <TextArea
                              rows={3}
                              placeholder={t(placeholderKey)}
                              data-testid={`outcome-${field.key}`}
                            />
                          ) : field.inputType === 'number' ? (
                            <InputNumber
                              style={{ width: '100%' }}
                              placeholder={t(placeholderKey)}
                              min={0}
                              data-testid={`outcome-${field.key}`}
                            />
                          ) : (
                            <Input
                              placeholder={t(placeholderKey)}
                              data-testid={`outcome-${field.key}`}
                            />
                          )}
                        </Form.Item>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <Divider>{t('keyTerms')}</Divider>

            {/* Key Terms */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="governingLaw"
                label={t('governingLaw')}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder={t('selectGoverningLaw')}
                  size="large"
                  data-testid="governing-law"
                >
                  {GOVERNING_LAW_OPTIONS.map((key) => (
                    <Option key={key} value={key}>
                      {t(`governingLawOptions.${key}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="disputeResolution"
                label={t('disputeResolution')}
                rules={[{ required: true }]}
              >
                <Select
                  placeholder={t('selectDisputeResolution')}
                  size="large"
                  data-testid="dispute-resolution"
                >
                  {DISPUTE_RESOLUTION_OPTIONS.map((key) => (
                    <Option key={key} value={key}>
                      {t(`disputeResolutionOptions.${key}`)}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Form.Item name="languages" label={t('language')}>
              <Checkbox.Group data-testid="language-checkboxes">
                {LANGUAGES.map((lang) => (
                  <Checkbox key={lang} value={lang}>
                    {lang === 'zh' ? '中文' : lang === 'en' ? 'English' : 'ภาษาไทย'}
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>

            <Form.Item name="specialClauses" label={t('specialClauses')}>
              <TextArea rows={3} data-testid="special-clauses" />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                icon={<FileTextOutlined />}
                data-testid="generate-btn"
              >
                {loading ? t('generating') : t('generate')}
              </Button>
            </Form.Item>
          </Form>
        </Card>

        {/* Result */}
        {loading && (
          <Card className="text-center py-8">
            <Spin size="large" />
            <p className="mt-4 text-gray-500">{t('generating')}</p>
          </Card>
        )}

        {result && (
          <Card
            title={t('result')}
            extra={
              <Button
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
                data-testid="copy-btn"
              >
                {copied ? t('copied') : t('copyText')}
              </Button>
            }
            data-testid="draft-result"
          >
            <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
              {result}
            </pre>
          </Card>
        )}
      </div>
    </div>
  );
}
