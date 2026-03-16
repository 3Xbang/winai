/**
 * Tests for Document Exporter & Version Manager
 * Task 30.3 — Word/PDF 导出与版本管理
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { exportWord, exportPDF } from '@/server/services/ai/document/exporter';
import {
  createVersion,
  getVersionHistory,
  restoreVersion,
  clearVersions,
} from '@/server/services/ai/document/version-manager';

// ─── Exporter Tests ─────────────────────────────────────────

describe('exportWord', () => {
  it('returns buffer with correct mime type', async () => {
    const result = await exportWord('起诉状内容', '起诉状');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.mimeType).toContain('wordprocessingml');
    expect(result.filename).toBe('起诉状.docx');
  });

  it('preserves .docx extension if already present', async () => {
    const result = await exportWord('content', 'doc.docx');
    expect(result.filename).toBe('doc.docx');
  });
});

describe('exportPDF', () => {
  it('returns buffer with correct mime type', async () => {
    const result = await exportPDF('法律意见书内容', '法律意见书');
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.filename).toBe('法律意见书.pdf');
  });
});

// ─── Version Manager Tests ──────────────────────────────────

describe('Version Manager', () => {
  beforeEach(() => {
    clearVersions();
  });

  it('creates and retrieves version history', () => {
    createVersion('doc-1', '版本1内容', '初始版本');
    createVersion('doc-1', '版本2内容', '修改条款');

    const history = getVersionHistory('doc-1');
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('版本1内容');
    expect(history[1].content).toBe('版本2内容');
  });

  it('restores a specific version', () => {
    const v1 = createVersion('doc-2', '原始内容', '初始');
    createVersion('doc-2', '修改后内容', '修改');

    const restored = restoreVersion('doc-2', v1.versionId);
    expect(restored).toBe('原始内容');
  });

  it('returns null for non-existent version', () => {
    const result = restoreVersion('doc-3', 'non-existent');
    expect(result).toBeNull();
  });

  it('returns empty history for unknown document', () => {
    const history = getVersionHistory('unknown');
    expect(history).toEqual([]);
  });

  it('isolates versions between documents', () => {
    createVersion('doc-a', 'A内容', '初始');
    createVersion('doc-b', 'B内容', '初始');

    expect(getVersionHistory('doc-a')).toHaveLength(1);
    expect(getVersionHistory('doc-b')).toHaveLength(1);
    expect(getVersionHistory('doc-a')[0].content).toBe('A内容');
  });
});
