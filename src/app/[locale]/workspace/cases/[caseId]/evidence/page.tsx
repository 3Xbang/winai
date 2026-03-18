'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Tag, Spin, Empty, message, Upload, Progress } from 'antd';
import {
  UploadOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

interface EvidenceItem {
  id: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  category: string;
  proofPurpose: string | null;
  legalBasis: string[];
  strength: string | null;
  similarCase: string | null;
  classifiedAt: string | null;
  createdAt: string;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  VALID: { label: '有效证据', color: 'green', icon: <CheckCircleOutlined /> },
  INVALID: { label: '无效证据', color: 'red', icon: <CloseCircleOutlined /> },
  NEEDS_SUPPLEMENT: { label: '需补充', color: 'orange', icon: <QuestionCircleOutlined /> },
  PENDING_CLASSIFICATION: { label: 'AI 分析中', color: 'blue', icon: <LoadingOutlined spin /> },
};

const STRENGTH_CONFIG: Record<string, { label: string; color: string }> = {
  STRONG: { label: '强', color: 'green' },
  MEDIUM: { label: '中', color: 'orange' },
  WEAK: { label: '弱', color: 'red' },
};

function EvidenceCard({ evidence, onDownload }: { evidence: EvidenceItem; onDownload: (id: string) => void }) {
  const cat = CATEGORY_CONFIG[evidence.category] ?? CATEGORY_CONFIG['PENDING_CLASSIFICATION']!;
  const strength = evidence.strength ? STRENGTH_CONFIG[evidence.strength] : null;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {/* 文件名 + 分类 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileTextOutlined className="text-orange-400 text-lg shrink-0" />
          <span className="font-semibold text-gray-800 truncate">{evidence.fileName}</span>
        </div>
        <Tag color={cat.color} icon={cat.icon} className="shrink-0">
          {cat.label}
        </Tag>
      </div>

      {/* AI 分析结果 */}
      {evidence.proofPurpose && (
        <div className="bg-teal-50 rounded-xl p-3 mb-3">
          <p className="text-xs text-teal-600 font-semibold mb-1">证明目的</p>
          <p className="text-sm text-gray-700">{evidence.proofPurpose}</p>
        </div>
      )}

      {evidence.legalBasis && evidence.legalBasis.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">法律依据</p>
          <div className="flex flex-wrap gap-1">
            {evidence.legalBasis.map((b, i) => (
              <Tag key={i} className="text-xs">{b}</Tag>
            ))}
          </div>
        </div>
      )}

      {evidence.similarCase && (
        <p className="text-xs text-gray-500 mb-3">
          <span className="font-medium">类似案例：</span>{evidence.similarCase}
        </p>
      )}

      {/* 底部：证明力 + 操作 */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {strength && (
            <Tag color={strength.color} className="text-xs">
              证明力：{strength.label}
            </Tag>
          )}
          <span className="text-xs text-gray-400">
            {new Date(evidence.createdAt).toLocaleDateString('zh-CN')}
          </span>
        </div>
        <Button
          type="link"
          size="small"
          onClick={() => onDownload(evidence.id)}
          className="text-orange-500"
        >
          下载
        </Button>
      </div>
    </div>
  );
}

export default function EvidencePage() {
  const params = useParams();
  const caseId = params?.caseId as string;
  const router = useRouter();

  const [evidences, setEvidences] = useState<EvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generatingList, setGeneratingList] = useState(false);

  const loadEvidences = useCallback(async () => {
    setLoading(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceEvidence.list?input=${input}`);
      const data = await res.json();
      setEvidences(data?.result?.data ?? []);
    } catch {
      setEvidences([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadEvidences();
  }, [loadEvidences]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const res = await fetch('/api/trpc/workspaceEvidence.upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          fileName: file.name,
          mimeType: file.type,
          fileBase64: base64,
        }),
      });

      if (res.ok) {
        message.success('上传成功，AI 正在分析中...');
        loadEvidences();
      } else {
        const data = await res.json();
        message.error(data?.error?.message ?? '上传失败');
      }
    } catch {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
    return false; // 阻止 antd 默认上传
  };

  const handleDownload = async (evidenceId: string) => {
    try {
      const input = encodeURIComponent(JSON.stringify({ evidenceId }));
      const res = await fetch(`/api/trpc/workspaceEvidence.getDownloadUrl?input=${input}`);
      const data = await res.json();
      const url = data?.result?.data;
      if (url) window.open(url, '_blank');
    } catch {
      message.error('获取下载链接失败');
    }
  };

  const handleGenerateList = async () => {
    setGeneratingList(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceEvidence.generateList?input=${input}`);
      const data = await res.json();
      const list = data?.result?.data;
      if (list) {
        // 简单展示为 JSON 下载
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `证据清单-${list.caseNumber}.json`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('证据清单已生成');
      }
    } catch {
      message.error('生成失败，请重试');
    } finally {
      setGeneratingList(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Button type="link" onClick={() => router.push(`/workspace/cases/${caseId}` as any)} className="px-0">
              ← 返回案件详情
            </Button>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">证据管理</h1>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleGenerateList}
              loading={generatingList}
              className="rounded-xl"
            >
              生成证据清单
            </Button>
            <Upload
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp3,.mp4,.wav"
              showUploadList={false}
              beforeUpload={handleUpload}
            >
              <Button
                type="primary"
                icon={<UploadOutlined />}
                loading={uploading}
                className="rounded-xl"
                style={{ background: '#f97316', borderColor: '#f97316' }}
              >
                上传证据
              </Button>
            </Upload>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spin size="large" />
          </div>
        ) : evidences.length === 0 ? (
          <div className="text-center py-20">
            <Empty description="暂无证据，点击上传按钮添加" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidences.map((e) => (
              <EvidenceCard key={e.id} evidence={e} onDownload={handleDownload} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
