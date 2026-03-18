'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Spin, Empty, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';

interface ChannelMessage {
  id: string;
  senderId: string;
  messageType: string;
  content: string;
  createdAt: string;
}

export default function ChannelPage() {
  const params = useParams();
  const caseId = params?.caseId as string;
  const router = useRouter();

  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const input = encodeURIComponent(JSON.stringify({ caseId }));
      const res = await fetch(`/api/trpc/workspaceChannel.listMessages?input=${input}`);
      const data = await res.json();
      setMessages(data?.result?.data?.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/trpc/workspaceChannel.sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, content: inputText.trim() }),
      });
      if (res.ok) {
        setInputText('');
        loadMessages();
      } else {
        message.error('发送失败');
      }
    } catch {
      message.error('发送失败');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-teal-50 flex flex-col">
      {/* 顶部 */}
      <div className="px-4 py-4 bg-white shadow-sm">
        <Button type="link" onClick={() => router.push(`/workspace/cases/${caseId}` as any)} className="px-0">
          ← 返回案件详情
        </Button>
        <h1 className="text-xl font-bold text-gray-800">沟通频道</h1>
        <p className="text-xs text-gray-400">消息永久保存，不可删除</p>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-10"><Spin /></div>
        ) : messages.length === 0 ? (
          <Empty description="暂无消息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(msg.createdAt).toLocaleString('zh-CN')}
              </p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 输入框 */}
      <div className="px-4 py-4 bg-white border-t border-gray-100">
        <div className="flex gap-3">
          <Input.TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            className="rounded-xl flex-1"
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            className="rounded-xl h-auto"
            style={{ background: '#f97316', borderColor: '#f97316' }}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}
