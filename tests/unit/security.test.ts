import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

// ─── Encryption imports ─────────────────────────────────────
import { encrypt, decrypt } from '@/server/services/security/encryption';

// ─── File validator imports ─────────────────────────────────
import {
  validateFileUpload,
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  type FileUploadInput,
} from '@/server/services/security/file-validator';

// ─── Virus scanner imports ──────────────────────────────────
import {
  scanFile,
  updateScanStatus,
  isFileDownloadable,
  scanAndUpdateFile,
  setClamAVClient,
  resetClamAVClient,
  type ClamAVClient,
  type ScanResult,
} from '@/server/services/security/virus-scanner';

// ─── Mock Prisma ────────────────────────────────────────────
vi.mock('@/lib/prisma', () => ({
  prisma: {
    uploadedFile: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '@/lib/prisma';

// ─── Test key (32 bytes = 64 hex chars) ─────────────────────
const TEST_KEY = crypto.randomBytes(32).toString('hex');
const WRONG_KEY = crypto.randomBytes(32).toString('hex');

// ═══════════════════════════════════════════════════════════
// 1. Encryption Tests
// ═══════════════════════════════════════════════════════════

describe('Encryption Service', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it('should encrypt and decrypt a string (round-trip)', () => {
    const plaintext = 'Hello, 法律咨询数据!';
    const ciphertext = encrypt(plaintext);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt and decrypt an empty string', () => {
    const plaintext = '';
    const ciphertext = encrypt(plaintext);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt and decrypt a long string', () => {
    const plaintext = '中泰法律'.repeat(1000);
    const ciphertext = encrypt(plaintext);
    const decrypted = decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertext for the same input (random IV)', () => {
    const plaintext = 'same input';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
    // Both should still decrypt to the same value
    expect(decrypt(c1)).toBe(plaintext);
    expect(decrypt(c2)).toBe(plaintext);
  });

  it('should produce ciphertext in iv:authTag:data format', () => {
    const ciphertext = encrypt('test');
    const parts = ciphertext.split(':');
    expect(parts).toHaveLength(3);
    // IV = 12 bytes = 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // Auth tag = 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Encrypted data should be non-empty for non-empty input
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it('should fail decryption with a wrong key', () => {
    const plaintext = 'secret data';
    const ciphertext = encrypt(plaintext);

    // Switch to a different key
    process.env.ENCRYPTION_KEY = WRONG_KEY;

    expect(() => decrypt(ciphertext)).toThrow();
  });

  it('should fail decryption with tampered ciphertext', () => {
    const ciphertext = encrypt('important data');
    // Tamper with the encrypted data portion
    const parts = ciphertext.split(':');
    parts[2] = 'ff' + parts[2]!.slice(2);
    const tampered = parts.join(':');

    expect(() => decrypt(tampered)).toThrow();
  });

  it('should fail decryption with invalid format', () => {
    expect(() => decrypt('not-valid-format')).toThrow('Invalid ciphertext format');
  });

  it('should throw when ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is not set');
  });

  it('should throw when ENCRYPTION_KEY has wrong length', () => {
    process.env.ENCRYPTION_KEY = 'abcd'; // too short
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY must be 32 bytes');
  });

  it('should handle unicode and special characters', () => {
    const plaintext = '🔒 密码: pässwörd! 泰语: สวัสดี';
    const ciphertext = encrypt(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. File Validator Tests
// ═══════════════════════════════════════════════════════════

describe('File Validator', () => {
  const validFile: FileUploadInput = {
    name: 'contract.pdf',
    size: 1024 * 1024, // 1 MB
    mimeType: 'application/pdf',
  };

  // ─── Valid files ──────────────────────────────────────────

  it('should accept a valid PDF file', () => {
    const result = validateFileUpload(validFile);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept all whitelisted MIME types', () => {
    const mimeTypes = Array.from(ALLOWED_MIME_TYPES);
    for (const mimeType of mimeTypes) {
      const result = validateFileUpload({ ...validFile, mimeType });
      expect(result.valid).toBe(true);
    }
  });

  it('should accept a file exactly at the 20MB limit', () => {
    const result = validateFileUpload({ ...validFile, size: MAX_FILE_SIZE });
    expect(result.valid).toBe(true);
  });

  it('should accept a 1-byte file', () => {
    const result = validateFileUpload({ ...validFile, size: 1 });
    expect(result.valid).toBe(true);
  });

  // ─── Oversized files ─────────────────────────────────────

  it('should reject a file exceeding 20MB', () => {
    const result = validateFileUpload({ ...validFile, size: MAX_FILE_SIZE + 1 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('20MB');
  });

  it('should reject a very large file', () => {
    const result = validateFileUpload({ ...validFile, size: 100 * 1024 * 1024 });
    expect(result.valid).toBe(false);
  });

  // ─── Invalid MIME types ───────────────────────────────────

  it('should reject an executable file', () => {
    const result = validateFileUpload({ ...validFile, mimeType: 'application/x-executable' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not allowed');
  });

  it('should reject a JavaScript file', () => {
    const result = validateFileUpload({ ...validFile, mimeType: 'application/javascript' });
    expect(result.valid).toBe(false);
  });

  it('should reject a ZIP file', () => {
    const result = validateFileUpload({ ...validFile, mimeType: 'application/zip' });
    expect(result.valid).toBe(false);
  });

  it('should reject text/html', () => {
    const result = validateFileUpload({ ...validFile, mimeType: 'text/html' });
    expect(result.valid).toBe(false);
  });

  it('should reject an empty MIME type', () => {
    const result = validateFileUpload({ ...validFile, mimeType: '' });
    expect(result.valid).toBe(false);
  });

  // ─── Edge cases ───────────────────────────────────────────

  it('should reject a file with zero size', () => {
    const result = validateFileUpload({ ...validFile, size: 0 });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('greater than 0');
  });

  it('should reject a file with negative size', () => {
    const result = validateFileUpload({ ...validFile, size: -1 });
    expect(result.valid).toBe(false);
  });

  it('should reject a file with empty name', () => {
    const result = validateFileUpload({ ...validFile, name: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
  });

  it('should reject a file with whitespace-only name', () => {
    const result = validateFileUpload({ ...validFile, name: '   ' });
    expect(result.valid).toBe(false);
  });

  it('should confirm MAX_FILE_SIZE is exactly 20MB', () => {
    expect(MAX_FILE_SIZE).toBe(20 * 1024 * 1024);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. Virus Scanner Tests
// ═══════════════════════════════════════════════════════════

describe('Virus Scanner', () => {
  const mockPrisma = prisma as unknown as {
    uploadedFile: {
      update: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetClamAVClient();
  });

  // ─── scanFile ─────────────────────────────────────────────

  describe('scanFile', () => {
    it('should return CLEAN from the default mock scanner', async () => {
      const result = await scanFile('uploads/test-file.pdf');
      expect(result.status).toBe('CLEAN');
      expect(result.details).toBeDefined();
    });

    it('should return INFECTED when ClamAV client detects a virus', async () => {
      const mockClient: ClamAVClient = {
        scanFile: async () => ({ status: 'INFECTED', details: 'Eicar-Test-Signature' }),
      };
      setClamAVClient(mockClient);

      const result = await scanFile('uploads/malicious.exe');
      expect(result.status).toBe('INFECTED');
      expect(result.details).toContain('Eicar');
    });

    it('should return ERROR when ClamAV client throws', async () => {
      const mockClient: ClamAVClient = {
        scanFile: async () => { throw new Error('Connection refused'); },
      };
      setClamAVClient(mockClient);

      const result = await scanFile('uploads/file.pdf');
      expect(result.status).toBe('ERROR');
      expect(result.details).toContain('Connection refused');
    });

    it('should handle non-Error throws gracefully', async () => {
      const mockClient: ClamAVClient = {
        scanFile: async () => { throw 'string error'; },
      };
      setClamAVClient(mockClient);

      const result = await scanFile('uploads/file.pdf');
      expect(result.status).toBe('ERROR');
      expect(result.details).toContain('Unknown scan error');
    });
  });

  // ─── updateScanStatus ─────────────────────────────────────

  describe('updateScanStatus', () => {
    it('should update file status to CLEAN', async () => {
      mockPrisma.uploadedFile.update.mockResolvedValue({});
      await updateScanStatus('file-1', 'CLEAN');

      expect(mockPrisma.uploadedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-1' },
        data: { scanStatus: 'CLEAN' },
      });
    });

    it('should update file status to INFECTED', async () => {
      mockPrisma.uploadedFile.update.mockResolvedValue({});
      await updateScanStatus('file-2', 'INFECTED');

      expect(mockPrisma.uploadedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-2' },
        data: { scanStatus: 'INFECTED' },
      });
    });

    it('should update file status to ERROR', async () => {
      mockPrisma.uploadedFile.update.mockResolvedValue({});
      await updateScanStatus('file-3', 'ERROR');

      expect(mockPrisma.uploadedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-3' },
        data: { scanStatus: 'ERROR' },
      });
    });
  });

  // ─── isFileDownloadable ───────────────────────────────────

  describe('isFileDownloadable', () => {
    it('should return true for CLEAN files', async () => {
      mockPrisma.uploadedFile.findUnique.mockResolvedValue({ scanStatus: 'CLEAN' });
      const result = await isFileDownloadable('file-clean');
      expect(result).toBe(true);
    });

    it('should return false for INFECTED files', async () => {
      mockPrisma.uploadedFile.findUnique.mockResolvedValue({ scanStatus: 'INFECTED' });
      const result = await isFileDownloadable('file-infected');
      expect(result).toBe(false);
    });

    it('should return false for PENDING files', async () => {
      mockPrisma.uploadedFile.findUnique.mockResolvedValue({ scanStatus: 'PENDING' });
      const result = await isFileDownloadable('file-pending');
      expect(result).toBe(false);
    });

    it('should return false for ERROR files', async () => {
      mockPrisma.uploadedFile.findUnique.mockResolvedValue({ scanStatus: 'ERROR' });
      const result = await isFileDownloadable('file-error');
      expect(result).toBe(false);
    });

    it('should return false for non-existent files', async () => {
      mockPrisma.uploadedFile.findUnique.mockResolvedValue(null);
      const result = await isFileDownloadable('non-existent');
      expect(result).toBe(false);
    });
  });

  // ─── scanAndUpdateFile ────────────────────────────────────

  describe('scanAndUpdateFile', () => {
    it('should scan and update status to CLEAN', async () => {
      mockPrisma.uploadedFile.update.mockResolvedValue({});

      const result = await scanAndUpdateFile('file-1', 'uploads/clean.pdf');
      expect(result.status).toBe('CLEAN');
      expect(mockPrisma.uploadedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-1' },
        data: { scanStatus: 'CLEAN' },
      });
    });

    it('should scan and update status to INFECTED', async () => {
      const mockClient: ClamAVClient = {
        scanFile: async () => ({ status: 'INFECTED', details: 'Trojan.Generic' }),
      };
      setClamAVClient(mockClient);
      mockPrisma.uploadedFile.update.mockResolvedValue({});

      const result = await scanAndUpdateFile('file-2', 'uploads/bad.exe');
      expect(result.status).toBe('INFECTED');
      expect(mockPrisma.uploadedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-2' },
        data: { scanStatus: 'INFECTED' },
      });
    });

    it('should scan and update status to ERROR on scanner failure', async () => {
      const mockClient: ClamAVClient = {
        scanFile: async () => { throw new Error('Timeout'); },
      };
      setClamAVClient(mockClient);
      mockPrisma.uploadedFile.update.mockResolvedValue({});

      const result = await scanAndUpdateFile('file-3', 'uploads/file.pdf');
      expect(result.status).toBe('ERROR');
      expect(mockPrisma.uploadedFile.update).toHaveBeenCalledWith({
        where: { id: 'file-3' },
        data: { scanStatus: 'ERROR' },
      });
    });
  });

  // ─── ClamAV client management ─────────────────────────────

  describe('ClamAV client management', () => {
    it('should allow overriding the ClamAV client', async () => {
      const custom: ClamAVClient = {
        scanFile: async () => ({ status: 'CLEAN', details: 'Custom scanner' }),
      };
      setClamAVClient(custom);

      const result = await scanFile('test');
      expect(result.details).toBe('Custom scanner');
    });

    it('should reset to default client', async () => {
      const custom: ClamAVClient = {
        scanFile: async () => ({ status: 'INFECTED', details: 'Custom' }),
      };
      setClamAVClient(custom);
      resetClamAVClient();

      const result = await scanFile('test');
      expect(result.status).toBe('CLEAN');
      expect(result.details).toContain('mock scanner');
    });
  });
});
