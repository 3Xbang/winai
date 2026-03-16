/**
 * File Upload Security Validator (文件上传安全验证)
 * MIME type whitelist and size limit enforcement.
 *
 * Requirements: 18.4, 19.6
 */

// ─── Constants ──────────────────────────────────────────────

/** Maximum file size: 20 MB */
export const MAX_FILE_SIZE = 20 * 1024 * 1024;

/** Allowed MIME types: PDF, Word (legacy + OOXML), JPEG, PNG, GIF, WebP */
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// ─── Types ──────────────────────────────────────────────────

export interface FileUploadInput {
  name: string;
  size: number;
  mimeType: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Validate a file upload against the whitelist and size constraints.
 * Pure logic — no external dependencies.
 */
export function validateFileUpload(file: FileUploadInput): ValidationResult {
  if (!file.name || file.name.trim().length === 0) {
    return { valid: false, error: 'File name is required' };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'File size must be greater than 0' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds the maximum limit of 20MB. Got ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
    };
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimeType)) {
    return {
      valid: false,
      error: `File type "${file.mimeType}" is not allowed. Allowed types: PDF, Word, JPEG, PNG, GIF, WebP`,
    };
  }

  return { valid: true };
}
