'use client';

import { useState } from 'react';
import { Modal, Button, Form, Select, Input, Alert, message } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { CourtPhase, ObjectionInput, CourtObjectionData } from '@/types/mock-court';

const { TextArea } = Input;

const OBJECTION_TYPES = [
  'IRRELEVANT',
  'HEARSAY',
  'LEADING_QUESTION',
  'NON_RESPONSIVE',
  'OTHER',
] as const;

interface ObjectionDialogProps {
  sessionId: string;
  currentPhase: CourtPhase;
  pendingObjection: CourtObjectionData | null;
  onRaiseObjection: (objection: ObjectionInput) => Promise<void>;
  onRespondToObjection: (response: string) => Promise<void>;
}

export default function ObjectionDialog({
  sessionId,
  currentPhase,
  pendingObjection,
  onRaiseObjection,
  onRespondToObjection,
}: ObjectionDialogProps) {
  const t = useTranslations('mockCourt');
  const [raiseModalOpen, setRaiseModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [raiseForm] = Form.useForm<ObjectionInput>();
  const [responseText, setResponseText] = useState('');

  const isVerdictPhase = currentPhase === 'VERDICT';
  const hasPendingAIObjection =
    pendingObjection && pendingObjection.raisedBy === 'OPPOSING_COUNSEL' && pendingObjection.ruling === 'PENDING';

  const handleRaiseObjection = async (values: ObjectionInput) => {
    setSubmitting(true);
    try {
      await onRaiseObjection(values);
      raiseForm.resetFields();
      setRaiseModalOpen(false);
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t('errors.createFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespondToObjection = async () => {
    const trimmed = responseText.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      await onRespondToObjection(trimmed);
      setResponseText('');
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : t('errors.createFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Raise Objection Button — hidden during VERDICT */}
      {!isVerdictPhase && (
        <Button
          icon={<ExclamationCircleOutlined />}
          onClick={() => setRaiseModalOpen(true)}
          danger
          data-testid="raise-objection-btn"
        >
          {t('raiseObjection')}
        </Button>
      )}

      {/* Raise Objection Modal */}
      <Modal
        title={t('raiseObjection')}
        open={raiseModalOpen}
        onCancel={() => setRaiseModalOpen(false)}
        footer={null}
        data-testid="raise-objection-modal"
      >
        <Form
          form={raiseForm}
          layout="vertical"
          onFinish={handleRaiseObjection}
          data-testid="objection-form"
        >
          <Form.Item
            name="objectionType"
            label={t('form.objectionType')}
            rules={[{ required: true, message: t('validation.objectionTypeRequired') }]}
          >
            <Select placeholder={t('form.selectObjectionType')} data-testid="objection-type-select">
              {OBJECTION_TYPES.map((type) => (
                <Select.Option key={type} value={type}>
                  {t(`objectionTypes.${type}`)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="reason"
            label={t('form.objectionReason')}
          >
            <TextArea
              rows={3}
              placeholder={t('form.objectionReasonPlaceholder')}
              data-testid="objection-reason-input"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={submitting}
              danger
              block
              data-testid="objection-submit-btn"
            >
              {t('raiseObjection')}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* AI Objection Response Modal — shown when AI raises an objection */}
      <Modal
        title={t('respondToObjection')}
        open={!!hasPendingAIObjection}
        closable={false}
        maskClosable={false}
        footer={null}
        data-testid="respond-objection-modal"
      >
        {hasPendingAIObjection && pendingObjection && (
          <div>
            <Alert
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              message={t(`objectionTypes.${pendingObjection.objectionType}`)}
              description={pendingObjection.reason || undefined}
              className="mb-4"
            />
            <TextArea
              rows={3}
              value={responseText}
              onChange={(e) => setResponseText(e.target.value)}
              placeholder={t('form.objectionReasonPlaceholder')}
              data-testid="objection-response-input"
            />
            <Button
              type="primary"
              onClick={handleRespondToObjection}
              loading={submitting}
              disabled={!responseText.trim()}
              block
              className="mt-3"
              data-testid="objection-response-submit-btn"
            >
              {t('respondToObjection')}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
