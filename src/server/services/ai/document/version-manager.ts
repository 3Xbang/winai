/**
 * Document Version Manager — Version history and restore for legal documents
 * Requirements: 27.4
 */

// ─── Types ──────────────────────────────────────────────────

export interface DocumentVersion {
  versionId: string;
  documentId: string;
  content: string;
  createdAt: Date;
  changeDescription: string;
}

// ─── In-Memory Store (production: DocumentVersion table) ────

const versionStore = new Map<string, DocumentVersion[]>();

// ─── Public API ─────────────────────────────────────────────

/**
 * Create a new version for a document.
 */
export function createVersion(
  documentId: string,
  content: string,
  changeDescription: string,
): DocumentVersion {
  const versions = versionStore.get(documentId) ?? [];
  const version: DocumentVersion = {
    versionId: `v${versions.length + 1}-${Date.now()}`,
    documentId,
    content,
    createdAt: new Date(),
    changeDescription,
  };
  versions.push(version);
  versionStore.set(documentId, versions);
  return version;
}

/**
 * Get version history for a document, sorted by creation date.
 */
export function getVersionHistory(documentId: string): DocumentVersion[] {
  const versions = versionStore.get(documentId) ?? [];
  return [...versions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Restore a specific version, returning its content.
 * Returns null if version not found.
 */
export function restoreVersion(
  documentId: string,
  versionId: string,
): string | null {
  const versions = versionStore.get(documentId) ?? [];
  const target = versions.find((v) => v.versionId === versionId);
  return target?.content ?? null;
}

/**
 * Clear all versions (for testing).
 */
export function clearVersions(): void {
  versionStore.clear();
}
