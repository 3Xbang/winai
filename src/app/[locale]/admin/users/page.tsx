'use client';

import { useState } from 'react';
import { Table, Input, Select, Tag, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

type UserRole = 'FREE_USER' | 'PAID_USER' | 'VIP_MEMBER' | 'ADMIN';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  subscription: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
  FREE_USER: 'default',
  PAID_USER: 'blue',
  VIP_MEMBER: 'gold',
  ADMIN: 'red',
};

const MOCK_USERS: AdminUser[] = [
  { id: '1', name: '张伟', email: 'zhang@example.com', role: 'VIP_MEMBER', subscription: 'VIP 年度', status: 'active', createdAt: '2024-01-01' },
  { id: '2', name: 'Somchai', email: 'somchai@example.com', role: 'PAID_USER', subscription: '标准版 月度', status: 'active', createdAt: '2024-01-05' },
  { id: '3', name: 'John Doe', email: 'john@example.com', role: 'FREE_USER', subscription: '免费版', status: 'active', createdAt: '2024-01-10' },
  { id: '4', name: '李明', email: 'liming@example.com', role: 'ADMIN', subscription: '-', status: 'active', createdAt: '2023-06-15' },
  { id: '5', name: 'Nattapong', email: 'nattapong@example.com', role: 'FREE_USER', subscription: '免费版', status: 'inactive', createdAt: '2024-01-12' },
];

const ALL_ROLES: UserRole[] = ['FREE_USER', 'PAID_USER', 'VIP_MEMBER', 'ADMIN'];

export default function AdminUsersPage() {
  const t = useTranslations('admin');
  const [searchText, setSearchText] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const filteredUsers = MOCK_USERS.filter((user) => {
    const matchesSearch =
      !searchText ||
      user.name.toLowerCase().includes(searchText.toLowerCase()) ||
      user.email.toLowerCase().includes(searchText.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const columns = [
    { title: t('users.name'), dataIndex: 'name', key: 'name' },
    { title: t('users.email'), dataIndex: 'email', key: 'email' },
    {
      title: t('users.role'),
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => (
        <Tag color={ROLE_COLORS[role]}>{t(`users.roles.${role}`)}</Tag>
      ),
    },
    { title: t('users.subscription'), dataIndex: 'subscription', key: 'subscription' },
    {
      title: t('users.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {t(`users.${status}`)}
        </Tag>
      ),
    },
    { title: t('users.createdAt'), dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: t('users.actions'),
      key: 'actions',
      render: (_: unknown, record: AdminUser) => (
        <Select
          size="small"
          value={record.role}
          style={{ width: 130 }}
          onChange={(value) => console.log('Change role:', record.id, value)}
          data-testid={`role-select-${record.id}`}
          options={ALL_ROLES.map((r) => ({ value: r, label: t(`users.roles.${r}`) }))}
        />
      ),
    },
  ];

  return (
    <div data-testid="admin-users-page">
      <h1 className="text-2xl font-bold mb-6" data-testid="users-title">
        {t('users.title')}
      </h1>

      <div className="flex flex-wrap gap-4 mb-4" data-testid="users-filters">
        <Input
          placeholder={t('users.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
          data-testid="users-search"
        />
        <Select
          value={roleFilter}
          onChange={setRoleFilter}
          style={{ width: 180 }}
          data-testid="users-role-filter"
          options={[
            { value: 'all', label: t('users.allRoles') },
            ...ALL_ROLES.map((r) => ({ value: r, label: t(`users.roles.${r}`) })),
          ]}
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredUsers}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        data-testid="users-table"
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
