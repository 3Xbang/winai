'use client';

import { useState, useCallback } from 'react';
import { Upload, Progress, Button, Typography, message } from 'antd';
import {
  InboxOutlined,
  FileOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { UploadFile, UploadProps } from 'antd/es/upload';

const { Dragger } = Upload;
const { Text } = Typography;

/** Maximum file size: 20 MB */
const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Accepted MIME types */
const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/** File extension accept string for the input element */
const ACCEPT_EXTENSIONS = '.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp';

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface UploadedFileInfo {
  name: string;
  size: number;
  status: UploadStatus;
  uid: string;
  percent?: number;
  errorMessage?: string;
  content?: string; // base64 content from /api/upload response
  type?: string;
}

interface FileUploadProps {
  onFileUploaded?: (file: UploadedFileInfo) => void;
  onFileRemoved?: (uid: string) => void;
  disabled?: boolean;
  maxCount?: number;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function FileUpload({
  onFileUploaded,
  onFileRemoved,
  disabled = false,
  maxCount = 5,
}: FileUploadProps) {
  const t = useTranslations('fileUpload');
  const [fileList, setFileList] = useState<UploadedFileInfo[]>([]);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (file.size > MAX_FILE_SIZE) {
        return t('errorSize', { max: '20MB', actual: formatFileSize(file.size) });
      }
      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        return t('errorType');
      }
      return null;
    },
    [t]
  );

  const handleBeforeUpload: UploadProps['beforeUpload'] = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        message.error(error);
        return Upload.LIST_IGNORE;
      }
      return true;
    },
    [validateFile]
  );

  const handleChange: UploadProps['onChange'] = useCallback(
    (info: { file: UploadFile; fileList: UploadFile[] }) => {
      const { file } = info;

      setFileList((prev) => {
        const existing = prev.find((f) => f.uid === file.uid);

        if (file.status === 'uploading') {
          const uploadingFile: UploadedFileInfo = {
            name: file.name,
            size: file.size ?? 0,
            status: 'uploading',
            uid: file.uid,
            percent: file.percent ?? 0,
          };
          if (existing) {
            return prev.map((f) => (f.uid === file.uid ? uploadingFile : f));
          }
          return [...prev, uploadingFile];
        }

        if (file.status === 'done') {
          const successFile: UploadedFileInfo = {
            name: file.name,
            size: file.size ?? 0,
            status: 'success',
            uid: file.uid,
            percent: 100,
            content: file.response?.content,
            type: file.response?.type ?? file.type,
          };
          onFileUploaded?.(successFile);
          return prev.map((f) => (f.uid === file.uid ? successFile : f));
        }

        if (file.status === 'error') {
          const errorFile: UploadedFileInfo = {
            name: file.name,
            size: file.size ?? 0,
            status: 'error',
            uid: file.uid,
            errorMessage: file.error?.message ?? t('errorGeneric'),
          };
          return prev.map((f) => (f.uid === file.uid ? errorFile : f));
        }

        return prev;
      });
    },
    [onFileUploaded, t]
  );

  const handleRemove = useCallback(
    (uid: string) => {
      setFileList((prev) => prev.filter((f) => f.uid !== uid));
      onFileRemoved?.(uid);
    },
    [onFileRemoved]
  );

  const handleRetry = useCallback((uid: string) => {
    setFileList((prev) =>
      prev.map((f) =>
        f.uid === uid ? { ...f, status: 'uploading' as UploadStatus, percent: 0, errorMessage: undefined } : f
      )
    );
    // In a real implementation, this would re-trigger the upload via the Upload component's API
  }, []);

  return (
    <div data-testid="file-upload" className="w-full">
      <Dragger
        name="file"
        multiple
        accept={ACCEPT_EXTENSIONS}
        maxCount={maxCount}
        disabled={disabled}
        beforeUpload={handleBeforeUpload}
        onChange={handleChange}
        showUploadList={false}
        action="/api/upload"
        aria-label={t('dragAreaLabel')}
      >
        <p className="text-4xl text-gray-400 mb-2">
          <InboxOutlined />
        </p>
        <p className="text-sm text-gray-600">{t('dragText')}</p>
        <p className="text-xs text-gray-400 mt-1">{t('hint')}</p>
      </Dragger>

      {fileList.length > 0 && (
        <div className="mt-3 space-y-2" data-testid="file-list">
          {fileList.map((file) => (
            <div
              key={file.uid}
              className="flex items-center gap-3 p-2 rounded border border-gray-200 bg-white"
              data-testid={`file-item-${file.uid}`}
            >
              <FileOutlined className="text-lg text-gray-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Text ellipsis className="text-sm font-medium">
                    {file.name}
                  </Text>
                  <Text className="text-xs text-gray-400 shrink-0">
                    {formatFileSize(file.size)}
                  </Text>
                </div>

                {file.status === 'uploading' && (
                  <Progress
                    percent={file.percent ?? 0}
                    size="small"
                    status="active"
                    className="!mb-0"
                    aria-label={t('uploadProgress')}
                  />
                )}

                {file.status === 'success' && (
                  <div className="flex items-center gap-1 text-green-600" data-testid="upload-success">
                    <CheckCircleFilled className="text-xs" />
                    <Text className="text-xs !text-green-600">{t('uploadSuccess')}</Text>
                  </div>
                )}

                {file.status === 'error' && (
                  <div data-testid="upload-error">
                    <div className="flex items-center gap-1 text-red-500">
                      <CloseCircleFilled className="text-xs" />
                      <Text className="text-xs !text-red-500">
                        {file.errorMessage ?? t('errorGeneric')}
                      </Text>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {file.status === 'error' && (
                  <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => handleRetry(file.uid)}
                    aria-label={t('retry')}
                    data-testid="retry-button"
                  />
                )}
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemove(file.uid)}
                  aria-label={t('remove')}
                  data-testid="remove-button"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
