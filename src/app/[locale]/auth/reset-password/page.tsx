'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Button, Steps, Result, message } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { Link } from '@/i18n/navigation';

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [verifyForm] = Form.useForm();
  const [resetForm] = Form.useForm();

  const handleVerify = (values: { emailOrPhone: string; code: string }) => {
    setLoading(true);
    console.log('Verify identity:', values);
    message.info('Identity verified (placeholder)');
    setLoading(false);
    setCurrentStep(1);
  };

  const handleReset = (values: {
    newPassword: string;
    confirmNewPassword: string;
  }) => {
    setLoading(true);
    console.log('Reset password:', values);
    message.info('Password reset (placeholder)');
    setLoading(false);
    setCurrentStep(2);
  };

  const handleSendCode = () => {
    console.log('Send verification code (placeholder)');
    message.info('Verification code sent (placeholder)');
  };

  const steps = [
    { title: t('stepVerify') },
    { title: t('stepReset') },
    { title: t('stepDone') },
  ];

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <Form
            form={verifyForm}
            layout="vertical"
            onFinish={handleVerify}
            autoComplete="off"
            className="mt-8"
          >
            <Form.Item
              name="emailOrPhone"
              rules={[{ required: true, message: t('requiredField') }]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder={t('emailOrPhone')}
                size="large"
              />
            </Form.Item>
            <Form.Item
              name="code"
              rules={[{ required: true, message: t('requiredField') }]}
            >
              <Input
                prefix={<SafetyOutlined />}
                placeholder={t('verificationCode')}
                size="large"
                suffix={
                  <Button type="link" size="small" onClick={handleSendCode}>
                    {t('sendCode')}
                  </Button>
                }
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
              >
                {tCommon('next')}
              </Button>
            </Form.Item>
          </Form>
        );
      case 1:
        return (
          <Form
            form={resetForm}
            layout="vertical"
            onFinish={handleReset}
            autoComplete="off"
            className="mt-8"
          >
            <Form.Item
              name="newPassword"
              rules={[
                { required: true, message: t('requiredField') },
                { min: 8, message: t('passwordMinLength') },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('newPassword')}
                size="large"
              />
            </Form.Item>
            <Form.Item
              name="confirmNewPassword"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: t('requiredField') },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error(t('passwordMismatch')));
                  },
                }),
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder={t('confirmNewPassword')}
                size="large"
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                size="large"
              >
                {t('resetButton')}
              </Button>
            </Form.Item>
          </Form>
        );
      case 2:
        return (
          <Result
            status="success"
            title={t('resetSuccess')}
            extra={
              <Link href="/auth/login">
                <Button type="primary" size="large">
                  {t('backToLogin')}
                </Button>
              </Link>
            }
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-[calc(100vh-128px)] flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          {t('resetPassword')}
        </h1>

        <Steps current={currentStep} items={steps} className="mb-4" />

        {renderStep()}

        {currentStep < 2 && (
          <div className="text-center mt-4">
            <Link href="/auth/login" className="text-blue-600">
              {t('backToLogin')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
