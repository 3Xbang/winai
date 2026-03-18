'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, Progress, Statistic, Button, Tag, Spin, message } from 'antd';
import { CloudOutlined, CrownOutlined } from '@ant-design/icons';
import { useRouter } from '@/i18n/navigation';

interface WorkspaceInfo {
  id: string;
  planTier: string;
  status: string;
  storageQuotaGB: number;
  storageAddOnGB: number;
  storageUsedBytes: string;
  subscriptionEndDate: string | null;
}

interface StorageUsage {
  usedGB: number;
  totalGB: number;
}

const PLAN_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  BASIC: { label: '基础版', color: 'blue', desc: '5 GB 存储空间' },
  PROFESSIONAL: { label: '专业版', color: 'purple', desc: '50 GB 存储空间' },
  FIRM: { label: '事务所版', color: 'gold', desc: '500 GB 存储空间' },
};

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wsRes, storageRes] = await Promise.all([
        fetch('/api/trpc/workspace.getWorkspace'),
        fetch('/api/trpc/workspace.getStorageUsage'),
      ]);
      const [wsData, storageData] = await Promise.all([wsRes.json(), storageRes.json()]);
      setWorkspace(wsData?.result?.data ?? null);
      setStorage(storageData?.result?.data ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePurchaseAddOn = async (addedGB: number) => {
    try {
      const res = await fetch('/api/trpc/workspace.purchaseStorageAddOn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addedGB }),
      });
      if (res.ok) {
        message.success(`已成功添加 ${addedGB} GB 存储空间`);
        loadData();
      } else {
        message.error('购买失败，请重试');
      }
    } catch {
      message.error('购买失败，请重试');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Spin size="large" />
      </div>
    );
  }

  const plan = workspace ? PLAN_LABELS[workspace.planTier] ?? PLAN_LABELS['BASIC']! : null;
  const storagePercent = storage ? Math.round((storage.usedGB / storage.totalGB) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <Button type="link" onClick={() => router.push('/workspace')} className="px-0">
            ← 返回工作台
          </Button>
          <h1 className="text-2xl font-bold text-gray-800 mt-1">工作空间设置</h1>
        </div>

        {/* 套餐信息 */}
        {workspace && plan && (
          <Card className="rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <CrownOutlined className="text-2xl text-orange-500" />
              <div>
                <h2 className="text-lg font-bold text-gray-800">当前套餐</h2>
                <Tag color={plan.color} className="mt-1">{plan.label}</Tag>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Statistic title="基础配额" value={workspace.storageQuotaGB} suffix="GB" />
              <Statistic title="扩充配额" value={workspace.storageAddOnGB} suffix="GB" />
            </div>
            {workspace.subscriptionEndDate && (
              <p className="text-sm text-gray-500 mt-3">
                订阅到期：{new Date(workspace.subscriptionEndDate).toLocaleDateString('zh-CN')}
              </p>
            )}
          </Card>
        )}

        {/* 存储用量 */}
        {storage && (
          <Card
            title={
              <span className="font-bold flex items-center gap-2">
                <CloudOutlined className="text-teal-500" />
                存储用量
              </span>
            }
            className="rounded-2xl shadow-sm"
          >
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>已使用 {storage.usedGB.toFixed(2)} GB</span>
                <span>共 {storage.totalGB} GB</span>
              </div>
              <Progress
                percent={storagePercent}
                strokeColor={
                  storagePercent > 90 ? '#ef4444' : storagePercent > 70 ? '#f97316' : '#14b8a6'
                }
                trailColor="#e5e7eb"
                strokeWidth={12}
              />
            </div>

            {storagePercent > 70 && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 mb-3">购买存储扩充包</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { gb: 10, price: '¥99' },
                    { gb: 50, price: '¥399' },
                    { gb: 200, price: '¥1299' },
                  ].map((pkg) => (
                    <button
                      key={pkg.gb}
                      onClick={() => handlePurchaseAddOn(pkg.gb)}
                      className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                      <p className="text-lg font-bold text-orange-600">+{pkg.gb} GB</p>
                      <p className="text-sm text-gray-500">{pkg.price}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
