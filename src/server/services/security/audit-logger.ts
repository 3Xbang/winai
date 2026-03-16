/**
 * Audit Logger Service (审计日志服务)
 * Records critical user operations and enforces a 12-month retention policy.
 *
 * Requirements: 19.7
 */

import prisma from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────

export type AuditAction =
  | 'LOGIN'
  | 'DATA_ACCESS'
  | 'DATA_EXPORT'
  | 'DATA_DELETE'
  | 'LOGOUT'
  | 'PASSWORD_RESET'
  | 'ROLE_CHANGE';

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  ipAddress: string;
  userAgent: string;
  details?: string;
}

export interface AuditLogFilters {
  action?: AuditAction;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date;
}

// ─── Constants ──────────────────────────────────────────────

/** Retention period in months */
const RETENTION_MONTHS = 12;

// ─── Public API ─────────────────────────────────────────────

/**
 * Write an audit log entry to the database.
 */
export async function logAction(entry: AuditLogEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      metadata: entry.details ? { details: entry.details } : undefined,
    },
  });
}

/**
 * Query audit logs for a specific user, with optional filters.
 */
export async function getAuditLogs(
  userId: string,
  filters?: AuditLogFilters,
): Promise<AuditLog[]> {
  const where: Record<string, unknown> = { userId };

  if (filters?.action) {
    where.action = filters.action;
  }

  if (filters?.dateFrom || filters?.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) createdAt.gte = filters.dateFrom;
    if (filters.dateTo) createdAt.lte = filters.dateTo;
    where.createdAt = createdAt;
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Delete audit log records older than 12 months.
 * Returns the number of deleted records.
 */
export async function cleanupOldLogs(): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

  const result = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}
