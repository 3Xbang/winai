'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Layout, Menu, Button, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Link, usePathname } from '@/i18n/navigation';
import LanguageSwitcher from './LanguageSwitcher';
import UserAvatar from './UserAvatar';

const { Header } = Layout;

const NAV_ITEMS = [
  { key: '/', labelKey: 'home' },
  { key: '/consultation', labelKey: 'consultation' },
  { key: '/contract', labelKey: 'contract' },
  { key: '/case-analysis', labelKey: 'caseAnalysis' },
  { key: '/visa', labelKey: 'visa' },
  { key: '/mock-court', labelKey: 'mockCourt' },
  { key: '/history', labelKey: 'history' },
  { key: '/pricing', labelKey: 'pricing' },
] as const;

export default function Navbar() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selectedKey = mounted
    ? NAV_ITEMS.find((item) => item.key === pathname)?.key || '/'
    : '';
  const selectedKeys = mounted ? [selectedKey] : [];

  const menuItems = NAV_ITEMS.map((item) => ({
    key: item.key,
    label: <Link href={item.key}>{t(item.labelKey)}</Link>,
  }));

  return (
    <Header className="sticky top-0 z-50 flex items-center justify-between bg-white/90 backdrop-blur-md shadow-sm px-4 lg:px-8 h-16 leading-[64px] border-b border-gray-100">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 shrink-0 mr-4 group">
        <div className="w-9 h-9 rounded-lg winai-gradient flex items-center justify-center shadow-md group-hover:shadow-lg winai-transition">
          <span className="text-base font-black text-white tracking-tight">W</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--winai-navy)' }}>
            WIN<span style={{ color: 'var(--winai-gold)' }}>AI</span>
          </span>
          <span className="text-[10px] text-gray-400 font-medium -mt-0.5 hidden sm:block">Legal Intelligence</span>
        </div>
      </Link>

      {/* Desktop nav */}
      <div className="hidden lg:flex flex-1 items-center justify-between min-w-0">
        <Menu
          mode="horizontal"
          selectedKeys={selectedKeys}
          items={menuItems}
          className="flex-1 border-none min-w-0"
          style={{ lineHeight: '62px' }}
        />
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <LanguageSwitcher />
          <UserAvatar />
        </div>
      </div>

      {/* Mobile/Tablet hamburger */}
      <div className="flex lg:hidden items-center gap-2">
        <LanguageSwitcher />
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
        />
      </div>

      {/* Mobile/Tablet drawer */}
      <Drawer
        title={
          <span className="font-extrabold text-lg" style={{ color: 'var(--winai-navy)' }}>
            WIN<span style={{ color: 'var(--winai-gold)' }}>AI</span>
          </span>
        }
        placement="right"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={280}
      >
        <Menu
          mode="vertical"
          selectedKeys={selectedKeys}
          items={menuItems}
          onClick={() => setDrawerOpen(false)}
          className="border-none"
        />
        <div className="mt-6 px-4">
          <UserAvatar />
        </div>
      </Drawer>
    </Header>
  );
}
