import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  logAction,
  getAuditLogs,
  cleanupOldLogs,
  type AuditLogEntry,
} from '@/server/services/security/audit-logger';

// ─── Mock Prisma ────────────────────────────────────────────

vi.mock('@/lib/prisma', () => ({
  default: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import prisma from '@/lib/prisma';

const mockPrisma = prisma as unknown as {
  auditLog: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

// ─── Helpers ────────────────────────────────────────────────

function makeEntry(overrides?: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    userId: 'user-1',
    action: 'LOGIN',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

function makeAuditLog(overrides?: Record<string, unknown>) {
  return {
    id: 'log-1',
    userId: 'user-1',
    action: 'LOGIN',
    resource: null,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    metadata: null,
    createdAt: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// logAction
// ═══════════════════════════════════════════════════════════

describe('logAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create an audit log record with correct fields', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAction(makeEntry());

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'LOGIN',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        metadata: undefined,
      },
    });
  });

  it('should store details in metadata when provided', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAction(makeEntry({ details: 'Exported session abc-123' }));

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: { details: 'Exported session abc-123' },
      }),
    });
  });

  it('should pass undefined metadata when no details provided', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAction(makeEntry());

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: undefined,
      }),
    });
  });

  it('should record DATA_ACCESS action', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAction(makeEntry({ action: 'DATA_ACCESS' }));

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DATA_ACCESS' }),
    });
  });

  it('should record DATA_EXPORT action', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAction(makeEntry({ action: 'DATA_EXPORT' }));

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DATA_EXPORT' }),
    });
  });

  it('should record DATA_DELETE action', async () => {
    mockPrisma.auditLog.create.mockResolvedValue({});

    await logAction(makeEntry({ action: 'DATA_DELETE' }));

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: 'DATA_DELETE' }),
    });
  });
});

// ═══════════════════════════════════════════════════════════
// getAuditLogs
// ═══════════════════════════════════════════════════════════

describe('getAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return logs for a given userId', async () => {
    const logs = [makeAuditLog()];
    mockPrisma.auditLog.findMany.mockResolvedValue(logs);

    const result = await getAuditLogs('user-1');

    expect(result).toEqual(logs);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should return empty array when no logs exist', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    const result = await getAuditLogs('user-no-logs');

    expect(result).toEqual([]);
  });

  it('should filter by action when provided', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await getAuditLogs('user-1', { action: 'DATA_EXPORT' });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', action: 'DATA_EXPORT' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should filter by dateFrom when provided', async () => {
    const dateFrom = new Date('2024-01-01');
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await getAuditLogs('user-1', { dateFrom });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: { gte: dateFrom },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should filter by dateTo when provided', async () => {
    const dateTo = new Date('2024-12-31');
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await getAuditLogs('user-1', { dateTo });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: { lte: dateTo },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should filter by date range when both dateFrom and dateTo provided', async () => {
    const dateFrom = new Date('2024-01-01');
    const dateTo = new Date('2024-06-30');
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await getAuditLogs('user-1', { dateFrom, dateTo });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should combine action and date range filters', async () => {
    const dateFrom = new Date('2024-03-01');
    const dateTo = new Date('2024-09-01');
    mockPrisma.auditLog.findMany.mockResolvedValue([]);

    await getAuditLogs('user-1', { action: 'LOGIN', dateFrom, dateTo });

    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        action: 'LOGIN',
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('should return results ordered by createdAt descending', async () => {
    const logs = [
      makeAuditLog({ id: 'log-2', createdAt: new Date('2024-07-01') }),
      makeAuditLog({ id: 'log-1', createdAt: new Date('2024-06-01') }),
    ];
    mockPrisma.auditLog.findMany.mockResolvedValue(logs);

    const result = await getAuditLogs('user-1');

    expect(result[0]!.id).toBe('log-2');
    expect(result[1]!.id).toBe('log-1');
  });
});

// ═══════════════════════════════════════════════════════════
// cleanupOldLogs
// ═══════════════════════════════════════════════════════════

describe('cleanupOldLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delete logs older than 12 months', async () => {
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 5 });

    await cleanupOldLogs();

    const call = mockPrisma.auditLog.deleteMany.mock.calls[0]![0];
    const cutoff = call.where.createdAt.lt as Date;

    // Cutoff should be approximately June 2024 (12 months before June 2025)
    expect(cutoff.getFullYear()).toBe(2024);
    expect(cutoff.getMonth()).toBe(5); // June = month index 5
  });

  it('should return the count of deleted records', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 42 });

    const count = await cleanupOldLogs();

    expect(count).toBe(42);
  });

  it('should return 0 when no old logs exist', async () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    const count = await cleanupOldLogs();

    expect(count).toBe(0);
  });

  it('should use lt (less than) comparison for cutoff date', async () => {
    vi.setSystemTime(new Date('2025-03-10T00:00:00Z'));
    mockPrisma.auditLog.deleteMany.mockResolvedValue({ count: 0 });

    await cleanupOldLogs();

    const call = mockPrisma.auditLog.deleteMany.mock.calls[0]![0];
    expect(call.where.createdAt).toHaveProperty('lt');
    expect(call.where.createdAt.lt).toBeInstanceOf(Date);
  });
});
