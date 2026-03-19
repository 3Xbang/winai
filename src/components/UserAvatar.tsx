'use client';

import { useTranslations } from 'next-intl';
import { Avatar, Button, Dropdown, type MenuProps } from 'antd';
import { UserOutlined, LogoutOutlined, ProfileOutlined, ToolOutlined } from '@ant-design/icons';
import { Link, useRouter } from '@/i18n/navigation';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function UserAvatar() {
  const t = useTranslations('nav');
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch
  if (!mounted || status === 'loading') {
    return <div className="flex items-center gap-2" style={{ width: 120, height: 32 }} />;
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/auth/login">
          <Button type="primary" size="small" style={{ background: '#f97316', borderColor: '#f97316' }}>
            {t('login')}
          </Button>
        </Link>
        <Link href="/auth/register">
          <Button size="small">{t('register')}</Button>
        </Link>
      </div>
    );
  }

  const user = session.user;
  const initials = user?.name
    ? user.name.slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? 'U';

  const menuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      label: (
        <div className="py-1 px-1">
          <div className="font-semibold text-gray-800 text-sm">{user?.name || t('profile')}</div>
          <div className="text-xs text-gray-400 truncate max-w-[180px]">{user?.email}</div>
        </div>
      ),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'profile',
      icon: <ProfileOutlined />,
      label: <Link href="/profile">{t('profile')}</Link>,
    },
    {
      key: 'workspace',
      icon: <ToolOutlined />,
      label: <Link href="/workspace">{t('workspace')}</Link>,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: t('logout'),
      danger: true,
      onClick: () => signOut({ callbackUrl: '/' }),
    },
  ];

  return (
    <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
      <div className="flex items-center gap-2 cursor-pointer group">
        <Avatar
          src={user?.image}
          style={{ background: '#f97316', color: '#fff', fontWeight: 700, fontSize: 13 }}
          icon={!user?.image && !initials ? <UserOutlined /> : undefined}
          alt={user?.name || t('profile')}
        >
          {!user?.image ? initials : undefined}
        </Avatar>
        <span className="hidden sm:block text-sm font-medium text-gray-700 group-hover:text-orange-500 transition-colors max-w-[100px] truncate">
          {user?.name || user?.email?.split('@')[0]}
        </span>
      </div>
    </Dropdown>
  );
}
