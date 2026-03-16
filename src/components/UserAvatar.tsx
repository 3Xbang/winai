'use client';

import { useTranslations } from 'next-intl';
import { Avatar, Button, Dropdown, type MenuProps } from 'antd';
import { UserOutlined, LogoutOutlined, ProfileOutlined } from '@ant-design/icons';
import { Link } from '@/i18n/navigation';
import { useState } from 'react';

// Mock auth state for now - will be replaced with next-auth session later
function useMockAuth() {
  const [isAuthenticated] = useState(false);
  const [user] = useState<{ name?: string; avatar?: string } | null>(null);
  return { isAuthenticated, user };
}

export default function UserAvatar() {
  const t = useTranslations('nav');
  const { isAuthenticated, user } = useMockAuth();

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/auth/login">
          <Button type="primary" size="small">
            {t('login')}
          </Button>
        </Link>
        <Link href="/auth/register">
          <Button size="small">{t('register')}</Button>
        </Link>
      </div>
    );
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <ProfileOutlined />,
      label: <Link href="/profile">{t('profile')}</Link>,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('logout'),
      danger: true,
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
      <Avatar
        src={user?.avatar}
        icon={!user?.avatar ? <UserOutlined /> : undefined}
        className="cursor-pointer"
        alt={user?.name || t('profile')}
      />
    </Dropdown>
  );
}
