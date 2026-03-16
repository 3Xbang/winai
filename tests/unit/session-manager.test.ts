import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock Redis
vi.mock('@/lib/redis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };
  return { default: mockRedis, redis: mockRedis };
});

// Mock Prisma
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    consultationSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    message: {
      createMany: vi.fn(),
    },
    bookmark: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { default: mockPrisma, prisma: mockPrisma };
});

import prisma from '@/lib/prisma';
import redis from '@/lib/redis';
import {
  save,
  search,
  exportPDF,
  bookmark,
  unbookmark,
  resume,
} from '@/server/services/session/manager';

const mockPrisma = prisma as any;
const mockRedis = redis as any;

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== save ====================

describe('save', () => {
  it('should throw BAD_REQUEST when userId is missing', async () => {
    await expect(save({ userId: '' })).rejects.toThrow(TRPCError);
    await expect(save({ userId: '' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should create a new session when no id is provided', async () => {
    mockPrisma.consultationSession.create.mockResolvedValue({ id: 'session-1' });
    mockRedis.del.mockResolvedValue(1);

    await save({
      userId: 'user-1',
      title: '合同咨询',
      legalDomain: 'CONTRACT',
    });

    expect(mockPrisma.consultationSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          title: '合同咨询',
          legalDomain: 'CONTRACT',
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('should create a new session with messages', async () => {
    mockPrisma.consultationSession.create.mockResolvedValue({ id: 'session-2' });
    mockRedis.del.mockResolvedValue(1);

    await save({
      userId: 'user-1',
      title: '签证咨询',
      messages: [
        { role: 'USER', content: '我想咨询泰国签证' },
        { role: 'ASSISTANT', content: '请问您需要哪种签证类型？' },
      ],
    });

    expect(mockPrisma.consultationSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          messages: {
            create: expect.arrayContaining([
              expect.objectContaining({ role: 'USER', content: '我想咨询泰国签证' }),
              expect.objectContaining({ role: 'ASSISTANT', content: '请问您需要哪种签证类型？' }),
            ]),
          },
        }),
      }),
    );
  });

  it('should throw NOT_FOUND when updating a non-existent session', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue(null);

    await expect(
      save({ id: 'nonexistent', userId: 'user-1' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should update an existing session and add messages', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.consultationSession.update.mockResolvedValue({});
    mockPrisma.message.createMany.mockResolvedValue({ count: 1 });
    mockRedis.del.mockResolvedValue(1);

    await save({
      id: 'session-1',
      userId: 'user-1',
      title: '更新标题',
      messages: [{ role: 'USER', content: '追加问题' }],
    });

    expect(mockPrisma.consultationSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-1' },
        data: expect.objectContaining({ title: '更新标题' }),
      }),
    );
    expect(mockPrisma.message.createMany).toHaveBeenCalled();
    expect(mockRedis.del).toHaveBeenCalledWith('session:context:session-1');
  });

  it('should update an existing session without messages', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.consultationSession.update.mockResolvedValue({});
    mockRedis.del.mockResolvedValue(1);

    await save({
      id: 'session-1',
      userId: 'user-1',
      legalDomain: 'VISA',
    });

    expect(mockPrisma.consultationSession.update).toHaveBeenCalled();
    expect(mockPrisma.message.createMany).not.toHaveBeenCalled();
  });

  it('should invalidate Redis cache when updating existing session', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.consultationSession.update.mockResolvedValue({});
    mockRedis.del.mockResolvedValue(1);

    await save({ id: 'session-1', userId: 'user-1' });

    expect(mockRedis.del).toHaveBeenCalledWith('session:context:session-1');
  });
});

// ==================== search ====================

describe('search', () => {
  it('should throw BAD_REQUEST when userId is missing', async () => {
    await expect(search('')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should return all sessions for a user with no filters', async () => {
    const mockSessions = [
      { id: 'session-1', userId: 'user-1', title: '咨询1', messages: [], bookmarks: [] },
      { id: 'session-2', userId: 'user-1', title: '咨询2', messages: [], bookmarks: [] },
    ];
    mockPrisma.consultationSession.findMany.mockResolvedValue(mockSessions);

    const result = await search('user-1');

    expect(result).toHaveLength(2);
    expect(mockPrisma.consultationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    );
  });

  it('should filter by date range', async () => {
    mockPrisma.consultationSession.findMany.mockResolvedValue([]);
    const dateFrom = new Date('2024-01-01');
    const dateTo = new Date('2024-06-30');

    await search('user-1', { dateFrom, dateTo });

    expect(mockPrisma.consultationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: dateFrom, lte: dateTo },
        }),
      }),
    );
  });

  it('should filter by dateFrom only', async () => {
    mockPrisma.consultationSession.findMany.mockResolvedValue([]);
    const dateFrom = new Date('2024-01-01');

    await search('user-1', { dateFrom });

    expect(mockPrisma.consultationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: { gte: dateFrom },
        }),
      }),
    );
  });

  it('should filter by legal domain', async () => {
    mockPrisma.consultationSession.findMany.mockResolvedValue([]);

    await search('user-1', { legalDomain: 'CONTRACT' });

    expect(mockPrisma.consultationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          legalDomain: 'CONTRACT',
        }),
      }),
    );
  });

  it('should filter by keyword in title and messages', async () => {
    mockPrisma.consultationSession.findMany.mockResolvedValue([]);

    await search('user-1', { keyword: '合同' });

    expect(mockPrisma.consultationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ title: { contains: '合同', mode: 'insensitive' } }),
            expect.objectContaining({
              messages: { some: { content: { contains: '合同', mode: 'insensitive' } } },
            }),
          ]),
        }),
      }),
    );
  });

  it('should filter bookmarked only sessions', async () => {
    mockPrisma.consultationSession.findMany.mockResolvedValue([]);

    await search('user-1', { bookmarkedOnly: true });

    expect(mockPrisma.consultationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookmarks: { some: { userId: 'user-1' } },
        }),
      }),
    );
  });

  it('should combine multiple filters', async () => {
    mockPrisma.consultationSession.findMany.mockResolvedValue([]);

    await search('user-1', {
      legalDomain: 'VISA',
      keyword: '签证',
      bookmarkedOnly: true,
    });

    const call = mockPrisma.consultationSession.findMany.mock.calls[0][0];
    expect(call.where.legalDomain).toBe('VISA');
    expect(call.where.bookmarks).toBeDefined();
    expect(call.where.OR).toBeDefined();
  });

  it('should order results by updatedAt descending', async () => {
    mockPrisma.consultationSession.findMany.mockResolvedValue([]);

    await search('user-1');

    expect(mockPrisma.consultationSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });
});

// ==================== exportPDF ====================

describe('exportPDF', () => {
  it('should throw BAD_REQUEST when sessionId is missing', async () => {
    await expect(exportPDF('')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should throw NOT_FOUND when session does not exist', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue(null);

    await expect(exportPDF('nonexistent')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should return a Buffer containing HTML', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue({
      id: 'session-1',
      title: '合同咨询',
      legalDomain: 'CONTRACT',
      jurisdiction: 'CHINA',
      createdAt: new Date('2024-01-15'),
      user: { name: '张三', email: 'zhang@example.com' },
      messages: [
        { role: 'USER', content: '请帮我审查合同', createdAt: new Date('2024-01-15T10:00:00') },
        { role: 'ASSISTANT', content: '好的，请上传合同文件', createdAt: new Date('2024-01-15T10:01:00') },
      ],
    });

    const result = await exportPDF('session-1');

    expect(result).toBeInstanceOf(Buffer);
    const html = result.toString('utf-8');
    expect(html).toContain('合同咨询');
    expect(html).toContain('张三');
    expect(html).toContain('请帮我审查合同');
    expect(html).toContain('好的，请上传合同文件');
    expect(html).toContain('免责声明');
  });

  it('should include all messages in the PDF', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue({
      id: 'session-1',
      title: '测试',
      legalDomain: null,
      jurisdiction: null,
      createdAt: new Date(),
      user: { name: null, email: null },
      messages: [
        { role: 'USER', content: '消息1', createdAt: new Date() },
        { role: 'ASSISTANT', content: '消息2', createdAt: new Date() },
        { role: 'SYSTEM', content: '消息3', createdAt: new Date() },
      ],
    });

    const result = await exportPDF('session-1');
    const html = result.toString('utf-8');

    expect(html).toContain('消息1');
    expect(html).toContain('消息2');
    expect(html).toContain('消息3');
  });
});

// ==================== bookmark ====================

describe('bookmark', () => {
  it('should throw BAD_REQUEST when sessionId is missing', async () => {
    await expect(bookmark('', 'user-1')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should throw BAD_REQUEST when userId is missing', async () => {
    await expect(bookmark('session-1', '')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should throw NOT_FOUND when session does not exist', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue(null);

    await expect(bookmark('nonexistent', 'user-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should throw CONFLICT when session is already bookmarked', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'bm-1' });

    await expect(bookmark('session-1', 'user-1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('should create a bookmark successfully', async () => {
    mockPrisma.consultationSession.findUnique.mockResolvedValue({ id: 'session-1' });
    mockPrisma.bookmark.findUnique.mockResolvedValue(null);
    mockPrisma.bookmark.create.mockResolvedValue({ id: 'bm-1' });

    await bookmark('session-1', 'user-1');

    expect(mockPrisma.bookmark.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', sessionId: 'session-1' },
    });
  });
});

// ==================== unbookmark ====================

describe('unbookmark', () => {
  it('should throw BAD_REQUEST when sessionId is missing', async () => {
    await expect(unbookmark('', 'user-1')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should throw BAD_REQUEST when userId is missing', async () => {
    await expect(unbookmark('session-1', '')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should throw NOT_FOUND when bookmark does not exist', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue(null);

    await expect(unbookmark('session-1', 'user-1')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should delete the bookmark successfully', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'bm-1' });
    mockPrisma.bookmark.delete.mockResolvedValue({});

    await unbookmark('session-1', 'user-1');

    expect(mockPrisma.bookmark.delete).toHaveBeenCalledWith({
      where: { userId_sessionId: { userId: 'user-1', sessionId: 'session-1' } },
    });
  });
});

// ==================== resume ====================

describe('resume', () => {
  it('should throw BAD_REQUEST when sessionId is missing', async () => {
    await expect(resume('')).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('should return cached context from Redis (cache hit)', async () => {
    const cachedContext = {
      session: {
        id: 'session-1',
        userId: 'user-1',
        title: '缓存会话',
        legalDomain: 'CONTRACT',
        jurisdiction: 'CHINA',
        status: 'ACTIVE',
        createdAt: '2024-01-15T00:00:00.000Z',
        updatedAt: '2024-01-15T01:00:00.000Z',
      },
      messages: [
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'USER',
          content: '缓存消息',
          metadata: null,
          createdAt: '2024-01-15T00:00:00.000Z',
        },
      ],
      bookmarks: [],
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(cachedContext));

    const result = await resume('session-1');

    expect(result.session.id).toBe('session-1');
    expect(result.session.title).toBe('缓存会话');
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].content).toBe('缓存消息');
    // Should restore Date objects
    expect(result.session.createdAt).toBeInstanceOf(Date);
    expect(result.messages[0].createdAt).toBeInstanceOf(Date);
    // Should NOT query database on cache hit
    expect(mockPrisma.consultationSession.findUnique).not.toHaveBeenCalled();
  });

  it('should load from database on cache miss and cache the result', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const now = new Date();
    mockPrisma.consultationSession.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      title: 'DB会话',
      legalDomain: 'VISA',
      jurisdiction: 'THAILAND',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      messages: [
        { id: 'msg-1', sessionId: 'session-1', role: 'USER', content: 'DB消息', metadata: null, createdAt: now },
      ],
      bookmarks: [
        { id: 'bm-1', userId: 'user-1', sessionId: 'session-1', createdAt: now },
      ],
    });

    const result = await resume('session-1');

    expect(result.session.id).toBe('session-1');
    expect(result.session.title).toBe('DB会话');
    expect(result.messages).toHaveLength(1);
    expect(result.bookmarks).toHaveLength(1);
    // Should cache the result with 24h TTL
    expect(mockRedis.set).toHaveBeenCalledWith(
      'session:context:session-1',
      expect.any(String),
      'EX',
      86400,
    );
  });

  it('should throw NOT_FOUND when session does not exist (cache miss)', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockPrisma.consultationSession.findUnique.mockResolvedValue(null);

    await expect(resume('nonexistent')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('should update INTERRUPTED session status to ACTIVE on resume', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const now = new Date();
    mockPrisma.consultationSession.findUnique.mockResolvedValue({
      id: 'session-interrupted',
      userId: 'user-1',
      title: '中断会话',
      legalDomain: null,
      jurisdiction: null,
      status: 'INTERRUPTED',
      createdAt: now,
      updatedAt: now,
      messages: [],
      bookmarks: [],
    });
    mockPrisma.consultationSession.update.mockResolvedValue({});

    const result = await resume('session-interrupted');

    expect(result.session.status).toBe('ACTIVE');
    expect(mockPrisma.consultationSession.update).toHaveBeenCalledWith({
      where: { id: 'session-interrupted' },
      data: { status: 'ACTIVE' },
    });
  });

  it('should NOT update status for non-INTERRUPTED sessions', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const now = new Date();
    mockPrisma.consultationSession.findUnique.mockResolvedValue({
      id: 'session-active',
      userId: 'user-1',
      title: '活跃会话',
      legalDomain: null,
      jurisdiction: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      messages: [],
      bookmarks: [],
    });

    await resume('session-active');

    expect(mockPrisma.consultationSession.update).not.toHaveBeenCalled();
  });

  it('should include all messages and bookmarks in context', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const now = new Date();
    mockPrisma.consultationSession.findUnique.mockResolvedValue({
      id: 'session-full',
      userId: 'user-1',
      title: '完整会话',
      legalDomain: 'CRIMINAL',
      jurisdiction: 'DUAL',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      messages: [
        { id: 'msg-1', sessionId: 'session-full', role: 'USER', content: '问题1', metadata: null, createdAt: now },
        { id: 'msg-2', sessionId: 'session-full', role: 'ASSISTANT', content: '回答1', metadata: { key: 'val' }, createdAt: now },
        { id: 'msg-3', sessionId: 'session-full', role: 'USER', content: '问题2', metadata: null, createdAt: now },
      ],
      bookmarks: [
        { id: 'bm-1', userId: 'user-1', sessionId: 'session-full', createdAt: now },
      ],
    });

    const result = await resume('session-full');

    expect(result.messages).toHaveLength(3);
    expect(result.bookmarks).toHaveLength(1);
    expect(result.session.legalDomain).toBe('CRIMINAL');
    expect(result.session.jurisdiction).toBe('DUAL');
  });

  it('should use correct Redis cache key pattern', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue('OK');

    const now = new Date();
    mockPrisma.consultationSession.findUnique.mockResolvedValue({
      id: 'session-key-test',
      userId: 'user-1',
      title: null,
      legalDomain: null,
      jurisdiction: null,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      messages: [],
      bookmarks: [],
    });

    await resume('session-key-test');

    expect(mockRedis.get).toHaveBeenCalledWith('session:context:session-key-test');
    expect(mockRedis.set).toHaveBeenCalledWith(
      'session:context:session-key-test',
      expect.any(String),
      'EX',
      86400,
    );
  });
});
