'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Button, Tabs, message } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { Link } from '@/i18n/navigation';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const [activeTab, setActiveTab] = useState('email');
  const [loading, setLoading] = useState(false);

  const handleEmailRegister = (values: {
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    setLoading(true);
    console.log('Email register:', values);
    message.info('Registration submitted (placeholder)');
    setLoading(false);
  };

  const handlePhoneRegister = (values: {
    phone: string;
    code: string;
    password: string;
  }) => {
    setLoading(true);
    console.log('Phone register:', values);
    message.info('Registration submitted (placeholder)');
    setLoading(false);
  };

  const handleSendCode = () => {
    console.log('Send verification code (placeholder)');
    message.info('Verification code sent (placeholder)');
  };

  const tabItems = [
    {
      key: 'email',
      label: t('registerWithEmail'),
      children: (
        <Form layout="vertical" onFinish={handleEmailRegister} autoComplete="off">
          <Form.Item
            name="email"
            rules={[
              { required: true, message: t('requiredField') },
              { type: 'email', message: t('invalidEmail') },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder={t('email')}
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: t('requiredField') },
              { min: 8, message: t('passwordMinLength') },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('password')}
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: t('requiredField') },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('passwordMismatch')));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('confirmPassword')}
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
              {t('registerButton')}
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'phone',
      label: t('registerWithPhone'),
      children: (
        <Form layout="vertical" onFinish={handlePhoneRegister} autoComplete="off">
          <Form.Item
            name="phone"
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder={t('phone')}
              size="large"
            />
          </Form.Item>
          <Form.Item
            name="code"
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <Input
              prefix={<LockOutlined />}
              placeholder={t('verificationCode')}
              size="large"
              suffix={
                <Button type="link" size="small" onClick={handleSendCode}>
                  {t('sendCode')}
                </Button>
              }
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: t('requiredField') },
              { min: 8, message: t('passwordMinLength') },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('password')}
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
              {t('registerButton')}
            </Button>
          </Form.Item>
        </Form>
      ),
    },
  ];

  return (
    <div className="min-h-[calc(100vh-128px)] flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          {t('registerTitle')}
        </h1>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          centered
        />

        <div className="text-center mt-6">
          <span className="text-gray-500">{t('hasAccount')}</span>{' '}
          <Link href="/auth/login" className="text-blue-600 font-medium">
            {t('goToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}
