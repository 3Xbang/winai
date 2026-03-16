'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Form, Input, Button, Card, Upload, message } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  UploadOutlined,
  BankOutlined,
  IdcardOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';

export default function ProfilePage() {
  const t = useTranslations('profile');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');
  const [personalForm] = Form.useForm();
  const [enterpriseForm] = Form.useForm();
  const [personalLoading, setPersonalLoading] = useState(false);
  const [enterpriseLoading, setEnterpriseLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handlePersonalSave = (values: {
    name: string;
    email: string;
    phone: string;
  }) => {
    setPersonalLoading(true);
    console.log('Save personal info:', values, 'avatar:', fileList);
    message.success(t('saveSuccess'));
    setPersonalLoading(false);
  };

  const handleEnterpriseSave = (values: {
    companyName: string;
    businessLicense: string;
    companyAddress: string;
  }) => {
    setEnterpriseLoading(true);
    console.log('Save enterprise info:', values);
    message.success(t('saveSuccess'));
    setEnterpriseLoading(false);
  };

  return (
    <div className="min-h-[calc(100vh-128px)] bg-gray-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>

        <div className="flex flex-col gap-6">
          <Card title={t('personalInfo')}>
            <Form
              form={personalForm}
              layout="vertical"
              onFinish={handlePersonalSave}
              autoComplete="off"
            >
              <Form.Item label={t('avatar')}>
                <Upload
                  listType="picture-card"
                  fileList={fileList}
                  onChange={({ fileList: newList }) => setFileList(newList)}
                  beforeUpload={() => false}
                  maxCount={1}
                  accept="image/*"
                >
                  {fileList.length < 1 && (
                    <div>
                      <UploadOutlined />
                      <div className="mt-2">{t('uploadAvatar')}</div>
                    </div>
                  )}
                </Upload>
              </Form.Item>
              <Form.Item
                name="name"
                label={t('name')}
                rules={[{ required: true, message: tAuth('requiredField') }]}
              >
                <Input prefix={<UserOutlined />} size="large" />
              </Form.Item>
              <Form.Item
                name="email"
                label={tAuth('email')}
                rules={[
                  { required: true, message: tAuth('requiredField') },
                  { type: 'email', message: tAuth('invalidEmail') },
                ]}
              >
                <Input prefix={<MailOutlined />} size="large" />
              </Form.Item>
              <Form.Item name="phone" label={tAuth('phone')}>
                <Input prefix={<PhoneOutlined />} size="large" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={personalLoading}
                  size="large"
                >
                  {t('saveButton')}
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title={t('enterpriseInfo')}>
            <Form
              form={enterpriseForm}
              layout="vertical"
              onFinish={handleEnterpriseSave}
              autoComplete="off"
            >
              <Form.Item name="companyName" label={t('companyName')}>
                <Input prefix={<BankOutlined />} size="large" />
              </Form.Item>
              <Form.Item name="businessLicense" label={t('businessLicense')}>
                <Input prefix={<IdcardOutlined />} size="large" />
              </Form.Item>
              <Form.Item name="companyAddress" label={t('companyAddress')}>
                <Input prefix={<EnvironmentOutlined />} size="large" />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={enterpriseLoading}
                  size="large"
                >
                  {t('saveButton')}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </div>
      </div>
    </div>
  );
}
