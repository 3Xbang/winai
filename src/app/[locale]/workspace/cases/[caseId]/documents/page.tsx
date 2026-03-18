'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Tag, Spin, Empty, message, Upload, List } from 'antd';
import { UploadOutlined, HistoryOutlined, DownloadOutlined, CheckOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

interface DocumentItem {
  id: string;
  title: string;
  currentVersionId: string | null;
  updatedAt: string;
  versions: Array<{ id: string; versionNumber: number; isActive: boolean; fileSize: string; createdAt: string }>;
}

export default function DocumentsPage() {
  const params = useParams();
  const caseId = params?.caseId as string;
  const router = useRouter();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [versions, setVersions] = useState<Record<string, any[]>>({});

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceDocument.listDocuments?input=${input}`);
      const data = await res.json();
      setDocuments(data?.result?.data ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const loadVersions = async (documentId: string) => {
    try {
      const input = encodeURIComponent(JSON.stringify({ documentId }));
      const res = await fetch(`/api/trpc/workspaceDocument.listVersions?input=${input}`);
      const data = await res.json();
      setVersions((prev) => ({ ...prev, [documentId]: data?.result?.data ?? [] }));
    } catch {
      // ignore
    }
  };

  const handleUpload = async (file: File, documentId?: string) => {
    setUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      const res = await fetch('/api/trpc/workspaceDocument.uploadVersion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          documentId,
          title: file.name.replace(/\.[^.]+$/, ''),
          fileName: file.name,
          mimeType: file.type,
          fileBase64: base64,
        }),
      });

      if (res.ok) {
        message.success('文件上传成功');
        loadDocuments();
        if (documentId) loadVersions(documentId);
      } else {
        const data = await res.json();
        message.error(data?.error?.message ?? '上传失败');
      }
    } catch {
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleDownload = async (versionId: string) => {
    try {
      const input = encodeURIComponent(JSON.stringify({ versionId }));
      const res = await fetch(`/api/trpc/workspaceDocument.getVersionDownloadUrl?input=${input}`);
      const data = await res.json();
      const url = data?.result?.data;
      if (url) window.open(url, '_blank');
    } catch {
      message.error('获取下载链接失败');
    }
  };

  const handleSetActive = async (versionId: string, documentId: string) => {
    try {
      const res = await fetch('/api/trpc/workspaceDocument.setActiveVersion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      });
      if (res.ok) {
        message.success('已设为当前版本');
        loadVersions(documentId);
        loadDocuments();
      }
    } catch {
      message.error('操作失败');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Button type="link" onClick={() => router.push(`/workspace/cases/${caseId}` as any)} className="px-0">
              ← 返回案件详情
            </Button>
            <h1 className="text-2xl font-bold text-gray-800 mt-1">文件版本管理</h1>
          </div>
          <Upload accept="*" showUploadList={false} beforeUpload={(f) => handleUpload(f)}>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
              className="rounded-xl"
              style={{ background: '#f97316', borderColor: '#f97316' }}
            >
              上传新文件
            </Button>
          </Upload>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Spin /></div>
        ) : documents.length === 0 ? (
          <Empty description="暂无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.id} className="rounded-2xl shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">{doc.title}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      更新：{new Date(doc.updatedAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Upload accept="*" showUploadList={false} beforeUpload={(f) => handleUpload(f, doc.id)}>
                      <Button size="small" icon={<UploadOutlined />} className="rounded-xl">
                        上传新版本
                      </Button>
                    </Upload>
                    <Button
                      size="small"
                      icon={<HistoryOutlined />}
                      className="rounded-xl"
                      onClick={() => {
                        if (expandedDoc === doc.id) {
                          setExpandedDoc(null);
                        } else {
                          setExpandedDoc(doc.id);
                          loadVersions(doc.id);
                        }
                      }}
                    >
                      版本历史
                    </Button>
                  </div>
                </div>

                {expandedDoc === doc.id && (
                  <div className="mt-4 border-t pt-4">
                    <List
                      size="small"
                      dataSource={versions[doc.id] ?? []}
                      renderItem={(v: any) => (
                        <List.Item
                          actions={[
                            <Button key="dl" size="small" icon={<DownloadOutlined />} type="link" onClick={() => handleDownload(v.id)}>
                              下载
                            </Button>,
                            !v.isActive && (
                              <Button key="set" size="small" icon={<CheckOutlined />} type="link" onClick={() => handleSetActive(v.id, doc.id)}>
                                设为当前
                              </Button>
                            ),
                          ].filter(Boolean)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">v{v.versionNumber}</span>
                            {v.isActive && <Tag color="green">当前版本</Tag>}
                            <span className="text-xs text-gray-400">
                              {new Date(v.createdAt).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                        </List.Item>
                      )}
                    />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
