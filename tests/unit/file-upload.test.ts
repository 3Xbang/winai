import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('FileUpload Component', () => {
  describe('Component file exists and structure', () => {
    it('should have FileUpload component file', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      expect(fs.existsSync(filePath), 'FileUpload.tsx should exist').toBe(true);
    });

    it('should be a use client component', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'use client'");
    });

    it('should export default FileUpload function', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export default function FileUpload');
    });

    it('should use Ant Design Upload/Dragger component with drag-and-drop', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('Dragger');
      expect(content).toContain('Upload');
    });

    it('should use next-intl for translations', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('useTranslations');
      expect(content).toContain("'fileUpload'");
    });

    it('should export UploadedFileInfo and UploadStatus types', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('export interface UploadedFileInfo');
      expect(content).toContain('export type UploadStatus');
    });
  });

  describe('File type and size constraints', () => {
    it('should accept PDF, Word, and image file extensions', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('.pdf');
      expect(content).toContain('.doc');
      expect(content).toContain('.docx');
      expect(content).toContain('.jpg');
      expect(content).toContain('.jpeg');
      expect(content).toContain('.png');
      expect(content).toContain('.gif');
      expect(content).toContain('.webp');
    });

    it('should define accepted MIME types for PDF, Word, and images', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('application/pdf');
      expect(content).toContain('application/msword');
      expect(content).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(content).toContain('image/jpeg');
      expect(content).toContain('image/png');
      expect(content).toContain('image/gif');
      expect(content).toContain('image/webp');
    });

    it('should enforce 20MB file size limit', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('20 * 1024 * 1024');
      expect(content).toContain('MAX_FILE_SIZE');
    });

    it('should have beforeUpload validation that checks size and type', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('beforeUpload');
      expect(content).toContain('validateFile');
      expect(content).toContain('file.size');
      expect(content).toContain('file.type');
    });
  });

  describe('Upload progress display', () => {
    it('should render Progress component during upload', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('Progress');
      expect(content).toContain("status === 'uploading'");
      expect(content).toContain('percent');
    });
  });

  describe('Upload success confirmation', () => {
    it('should display file name, size, and success status', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("status === 'success'");
      expect(content).toContain('upload-success');
      expect(content).toContain('CheckCircleFilled');
      expect(content).toContain('file.name');
      expect(content).toContain('formatFileSize');
    });
  });

  describe('Upload error handling and retry', () => {
    it('should display error message on upload failure', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("status === 'error'");
      expect(content).toContain('upload-error');
      expect(content).toContain('CloseCircleFilled');
      expect(content).toContain('errorMessage');
    });

    it('should provide retry button on upload failure', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('retry-button');
      expect(content).toContain('ReloadOutlined');
      expect(content).toContain('handleRetry');
    });

    it('should provide remove button for all file states', () => {
      const filePath = path.resolve(__dirname, '../../src/components/chat/FileUpload.tsx');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('remove-button');
      expect(content).toContain('DeleteOutlined');
      expect(content).toContain('handleRemove');
    });
  });

  describe('Translation keys for fileUpload', () => {
    const locales = ['zh', 'en', 'th'];
    const translations = locales.reduce(
      (acc, locale) => {
        const filePath = path.resolve(__dirname, `../../messages/${locale}.json`);
        acc[locale] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return acc;
      },
      {} as Record<string, Record<string, unknown>>
    );

    const requiredKeys = [
      'fileUpload.dragText',
      'fileUpload.dragAreaLabel',
      'fileUpload.hint',
      'fileUpload.uploadProgress',
      'fileUpload.uploadSuccess',
      'fileUpload.errorSize',
      'fileUpload.errorType',
      'fileUpload.errorGeneric',
      'fileUpload.retry',
      'fileUpload.remove',
    ];

    function getNestedValue(obj: Record<string, unknown>, keyPath: string): unknown {
      return keyPath.split('.').reduce((current: unknown, key) => {
        if (current && typeof current === 'object') {
          return (current as Record<string, unknown>)[key];
        }
        return undefined;
      }, obj);
    }

    for (const key of requiredKeys) {
      it(`should have translation key "${key}" in all locales`, () => {
        for (const locale of locales) {
          const value = getNestedValue(translations[locale]!, key);
          expect(value, `Missing "${key}" in ${locale}.json`).toBeDefined();
          expect(typeof value, `"${key}" in ${locale}.json should be a string`).toBe('string');
          expect((value as string).length, `"${key}" in ${locale}.json should not be empty`).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('File validator supports webp', () => {
    it('should include image/webp in allowed MIME types', () => {
      const filePath = path.resolve(__dirname, '../../src/server/services/security/file-validator.ts');
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain("'image/webp'");
    });
  });
});
