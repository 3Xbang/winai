'use client';

import { useState } from 'react';
import {
  Card,
  Button,
  Tag,
  List,
  Modal,
  Form,
  Input,
  Select,
  Empty,
  message,
} from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { CourtPhase, CourtEvidenceData, EvidenceInput } from '@/types/mock-court';

const { TextArea } = Input;

const EVIDENCE_TYPES = [
  'DOCUMENTARY',
  'PHYSICAL',
  'TESTIMONY',
  'EXPERT_OPINION',
  'ELECTRONIC',
] as const;

const ADMISSION_TAG_COLORS: Record<string, string> = {
  PENDING: 'default',
  ADMITTED: 'green',
  PARTIALLY_ADMITTED: 'orange',
  REJECTED: 'red',
};

interface EvidencePanelProps {
  sessionId: string;
  currentPhase: CourtPhase;
  evidenceItems: CourtEvidenceData[];
  onSubmitEvidence: (evidence: EvidenceInput) => Promise<void>;
}

export default function EvidencePanel({
  sessionId,
  currentPhase,
  evidenceItems,
  onSubmitEvidence,
}: EvidencePanelProps) {
  const t = useTranslations('mockCourt');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<EvidenceInput>();

  const isEvidencePhase = currentPhase === 'EVIDENCE';

  const handleSubmit = async (values: EvidenceInput) => {
    setSubmitting(true);
    try {
      await onSubmitEvidence(values);
      form.resetFields();
      setModalOpen(false);
      message.success(t('submitEvidence'));
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t('errors.createFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          <FileTextOutlined />
          {t('submitEvidence')}
        </span>
      }
      className="h-full overflow-auto"
      data-testid="evidence-panel"
      extra={
        isEvidencePhase && (
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setModalOpen(true)}
            data-testid="submit-evidence-btn"
          >
            {t('submitEvidence')}
          </Button>
        )
      }
    >
      {evidenceItems.length === 0 ? (
        <Empty
          description={t('empty.noEvidence')}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          data-testid="no-evidence-empty"
        />
      ) : (
        <List
          dataSource={evidenceItems}
          data-testid="evidence-list"
          renderItem={(item) => (
            <List.Item key={item.id} data-testid={`evidence-item-${item.id}`}>
              <List.Item.Meta
                title={
                  <div className="flex items-center gap-2">
                    <span>{item.name}</span>
                    <Tag color={ADMISSION_TAG_COLORS[item.admission] ?? 'default'}>
                      {t(`evidenceAdmission.${item.admission}`)}
                    </Tag>
                  </div>
                }
                description={
                  <div className="text-xs text-gray-500">
                    <div>{t(`evidenceTypes.${item.evidenceType}`)} · {item.description}</div>
                    <div className="mt-1 text-gray-400">
                      {t('form.proofPurpose')}: {item.proofPurpose}
                    </div>
                    {item.admissionReason && (
                      <div className="mt-1 italic text-gray-400">
                        {item.admissionReason}
                      </div>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* Submit Evidence Modal */}
      <Modal
        title={t('submitEvidence')}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        data-testid="evidence-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          data-testid="evidence-form"
        >
          <Form.Item
            name="name"
            label={t('form.evidenceName')}
            rules={[{ required: true, message: t('validation.evidenceNameRequired') }]}
          >
            <Input placeholder={t('form.evidenceNamePlaceholder')} data-testid="evidence-name-input" />
          </Form.Item>

          <Form.Item
            name="evidenceType"
            label={t('form.evidenceType')}
            rules={[{ required: true, message: t('validation.evidenceTypeRequired') }]}
          >
            <Select placeholder={t('form.selectEvidenceType')} data-testid="evidence-type-select">
              {EVIDENCE_TYPES.map((type) => (
                <Select.Option key={type} value={type}>
                  {t(`evidenceTypes.${type}`)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label={t('form.evidenceDescription')}
            rules={[{ required: true, message: t('validation.evidenceDescriptionRequired') }]}
          >
            <TextArea
              rows={3}
              placeholder={t('form.evidenceDescriptionPlaceholder')}
              data-testid="evidence-description-input"
            />
          </Form.Item>

          <Form.Item
            name="proofPurpose"
            label={t('form.proofPurpose')}
            rules={[{ required: true, message: t('validation.proofPurposeRequired') }]}
          >
            <TextArea
              rows={2}
              placeholder={t('form.proofPurposePlaceholder')}
              data-testid="evidence-purpose-input"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              block
              data-testid="evidence-submit-btn"
            >
              {t('submitEvidence')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
