'use client';

import { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  ShoppingCartOutlined,
  SafetyCertificateOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const { Sider, Content } = Layout;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: <Link href="/admin">{t('sidebar.dashboard')}</Link>,
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: <Link href="/admin/users">{t('sidebar.users')}</Link>,
    },
    {
      key: 'content',
      icon: <FileTextOutlined />,
      label: <Link href="/admin/content">{t('sidebar.content')}</Link>,
    },
    {
      key: 'orders',
      icon: <ShoppingCartOutlined />,
      label: <Link href="/admin/orders">{t('sidebar.orders')}</Link>,
    },
  ];

  return (
    <Layout className="min-h-[calc(100vh-128px)]" data-testid="admin-layout">
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={80}
        trigger={null}
        className="bg-white"
        data-testid="admin-sidebar"
      >
        <div className="p-4 text-center border-b">
          <SafetyCertificateOutlined className="text-xl text-blue-600" />
          {!collapsed && (
            <div className="text-xs text-gray-500 mt-1" data-testid="admin-only-badge">
              {t('adminOnly')}
            </div>
          )}
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={menuItems}
          className="border-r-0"
          data-testid="admin-menu"
        />
        <div
          className="absolute bottom-4 left-0 right-0 text-center cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
          data-testid="sidebar-toggle"
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </Sider>
      <Content className="p-6 bg-gray-50">
        {children}
      </Content>
    </Layout>
  );
}
