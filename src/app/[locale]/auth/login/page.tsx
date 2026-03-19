'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Button, Tabs, Divider, message } from 'antd';
import {
  MailOutlined,
  LockOutlined,
  PhoneOutlined,
  WechatOutlined,
} from '@ant-design/icons';
import { Link, useRouter } from '@/i18n/navigation';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('email');
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
      });

      if (result?.error) {
        message.error('邮箱或密码错误，请重试');
      } else {
        message.success('登录成功');
        router.push('/');
      }
    } catch {
      message.error('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (values: { phone: string; code: string }) => {
    setLoading(true);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        phone: values.phone,
        code: values.code,
      });

      if (result?.error) {
        message.error('手机号或验证码错误，请重试');
      } else {
        message.success('登录成功');
        router.push('/');
      }
    } catch {
      message.error('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = () => {
    message.info('验证码功能暂未开放，请使用邮箱登录');
  };

  const tabItems = [
    {
      key: 'email',
      label: t('loginWithEmail'),
      children: (
        <Form layout="vertical" onFinish={handleEmailLogin} autoComplete="off">
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
            rules={[{ required: true, message: t('requiredField') }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder={t('password')}
              size="large"
            />
          </Form.Item>
          <div className="flex justify-end mb-4">
            <Link href="/auth/reset-password" className="text-blue-600">
              {t('forgotPassword')}
            </Link>
          </div>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              {t('loginButton')}
            </Button>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: 'phone',
      label: t('loginWithPhone'),
      children: (
        <Form layout="vertical" onFinish={handlePhoneLogin} autoComplete="off">
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
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              {t('loginButton')}
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
          {t('loginTitle')}
        </h1>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          centered
        />

        <Divider />

        <div className="flex flex-col gap-3">
          <Button
            icon={<WechatOutlined />}
            block
            size="large"
            className="!bg-[#07c160] !text-white !border-[#07c160] hover:!opacity-90"
            onClick={() => message.info('微信登录暂未开放')}
          >
            {t('wechatLogin')}
          </Button>
          <Button
            block
            size="large"
            className="!bg-[#06c755] !text-white !border-[#06c755] hover:!opacity-90"
            onClick={() => message.info('Line 登录暂未开放')}
          >
            {t('lineLogin')}
          </Button>
        </div>

        <div className="text-center mt-6">
          <span className="text-gray-500">{t('noAccount')}</span>{' '}
          <Link href="/auth/register" className="text-blue-600 font-medium">
            {t('goToRegister')}
          </Link>
        </div>
      </div>
    </div>
  );
}
