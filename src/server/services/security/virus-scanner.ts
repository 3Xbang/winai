/**
 * Virus Scanner Service (病毒扫描服务)
 * ClamAV integration for uploaded file scanning, status management,
 * and infected file download blocking.
 *
 * Requirements: 19.6
 */

import { prisma } from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────

export type ScanStatus = 'CLEAN' | 'INFECTED' | 'ERROR';

export interface ScanResult {
  status: ScanStatus;
  details?: string;
}

/**
 * ClamAV scanner interface — abstracted for easy mocking/swapping.
 */
export interface ClamAVClient {
  scanFile(fileKey: string): Promise<ScanResult>;
}

// ─── Default ClamAV Client (mock) ───────────────────────────

/**
 * Default ClamAV client implementation.
 * In production this would connect to a ClamAV daemon via clamd socket/TCP.
 * Currently returns CLEAN for all files as a placeholder.
 */
export const defaultClamAVClient: ClamAVClient = {
  async scanFile(_fileKey: string): Promise<ScanResult> {
    // TODO: Replace with real ClamAV daemon integration (clamd TCP/socket)
    return { status: 'CLEAN', details: 'No threats detected (mock scanner)' };
  },
};

// ─── Module-level configurable client ───────────────────────

let clamavClient: ClamAVClient = defaultClamAVClient;

/**
 * Override the ClamAV client (useful for testing or swapping implementations).
 */
export function setClamAVClient(client: ClamAVClient): void {
  clamavClient = client;
}

/**
 * Reset to the default ClamAV client.
 */
export function resetClamAVClient(): void {
  clamavClient = defaultClamAVClient;
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Scan a file using ClamAV and return the scan result.
 * Does NOT update the database — call `updateScanStatus` separately.
 */
export async function scanFile(fileKey: string): Promise<ScanResult> {
  try {
    return await clamavClient.scanFile(fileKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown scan error';
    return { status: 'ERROR', details: `Scan failed: ${message}` };
  }
}

/**
 * Update the scan status of an uploaded file in the database.
 * Transitions from PENDING → CLEAN | INFECTED | ERROR.
 */
export async function updateScanStatus(
  fileId: string,
  status: ScanStatus,
): Promise<void> {
  await prisma.uploadedFile.update({
    where: { id: fileId },
    data: { scanStatus: status },
  });
}

/**
 * Check whether a file is safe to download.
 * Returns false for INFECTED files — blocks download.
 * Returns true for CLEAN files.
 * Returns false for PENDING or ERROR files (not yet verified).
 */
export async function isFileDownloadable(fileId: string): Promise<boolean> {
  const file = await prisma.uploadedFile.findUnique({
    where: { id: fileId },
    select: { scanStatus: true },
  });

  if (!file) {
    return false;
  }

  return file.scanStatus === 'CLEAN';
}

/**
 * Full scan-and-update workflow: scan a file, then persist the result.
 * Convenience function combining scanFile + updateScanStatus.
 */
export async function scanAndUpdateFile(
  fileId: string,
  fileKey: string,
): Promise<ScanResult> {
  const result = await scanFile(fileKey);
  await updateScanStatus(fileId, result.status);
  return result;
}
