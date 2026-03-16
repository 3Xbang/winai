/**
 * Session Manager (会话管理器)
 * Manages consultation sessions: save, search, export, bookmark, resume.
 * Uses Redis for caching active session contexts (TTL: 24h).
 *
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6
 */

import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import redis from '@/lib/redis';

// ==================== Types ====================

export interface SessionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  keyword?: string;
  legalDomain?: string;
  bookmarkedOnly?: boolean;
}

export interface ConsultationContext {
  session: {
    id: string;
    userId: string;
    title: string | null;
    legalDomain: string | null;
    jurisdiction: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  messages: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    metadata: unknown;
    createdAt: Date;
  }[];
  bookmarks: {
    id: string;
    userId: string;
    sessionId: string;
    createdAt: Date;
  }[];
}

export interface SessionMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface SessionData {
  id?: string;
  userId: string;
  title?: string;
  legalDomain?: string;
  jurisdiction?: string;
  messages?: SessionMessage[];
}

// ==================== Constants ====================

const SESSION_CONTEXT_TTL = 86400; // 24 hours in seconds
const contextCacheKey = (sessionId: string) => `session:context:${sessionId}`;

// ==================== Session Manager Functions ====================

/**
 * Save a consultation session and its messages.
 * Handles both creating new sessions and adding messages to existing sessions.
 * Requirement: 17.1
 */
export async function save(session: SessionData): Promise<void> {
  if (!session.userId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '缺少用户ID' });
  }

  if (session.id) {
    // Existing session — verify it exists
    const existing = await prisma.consultationSession.findUnique({
      where: { id: session.id },
    });

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
    }

    // Update session fields if provided
    await prisma.consultationSession.update({
      where: { id: session.id },
      data: {
        ...(session.title !== undefined && { title: session.title }),
        ...(session.legalDomain !== undefined && { legalDomain: session.legalDomain }),
        ...(session.jurisdiction !== undefined && { jurisdiction: session.jurisdiction }),
      },
    });

    // Add new messages
    if (session.messages && session.messages.length > 0) {
      await prisma.message.createMany({
        data: session.messages.map((msg) => ({
          sessionId: session.id!,
          role: msg.role,
          content: msg.content,
          metadata: (msg.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        })),
      });
    }

    // Invalidate cache so next resume gets fresh data
    await redis.del(contextCacheKey(session.id));
  } else {
    // Create new session
    const created = await prisma.consultationSession.create({
      data: {
        userId: session.userId,
        title: session.title ?? null,
        legalDomain: session.legalDomain ?? null,
        jurisdiction: session.jurisdiction ?? null,
        status: 'ACTIVE',
        messages: session.messages
          ? {
              create: session.messages.map((msg) => ({
                role: msg.role,
                content: msg.content,
                metadata: (msg.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
              })),
            }
          : undefined,
      },
    });

    // Cache the new session context
    await redis.del(contextCacheKey(created.id));
  }
}

/**
 * Search consultation sessions with filters.
 * Supports date range, keyword, legal domain, and bookmarked-only filtering.
 * Requirement: 17.2
 */
export async function search(
  userId: string,
  filters: SessionFilters = {},
): Promise<any[]> {
  if (!userId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '缺少用户ID' });
  }

  const where: any = { userId };

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) {
      where.createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.createdAt.lte = filters.dateTo;
    }
  }

  // Legal domain filter
  if (filters.legalDomain) {
    where.legalDomain = filters.legalDomain;
  }

  // Bookmarked only filter
  if (filters.bookmarkedOnly) {
    where.bookmarks = {
      some: { userId },
    };
  }

  // Keyword filter — search in title and message content
  if (filters.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: 'insensitive' } },
      {
        messages: {
          some: {
            content: { contains: filters.keyword, mode: 'insensitive' },
          },
        },
      },
    ];
  }

  const sessions = await prisma.consultationSession.findMany({
    where,
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      bookmarks: {
        where: { userId },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return sessions;
}

/**
 * Export a consultation session as PDF.
 * Generates HTML and converts to a Buffer (stub for Puppeteer).
 * Requirement: 17.3
 */
export async function exportPDF(sessionId: string): Promise<Buffer> {
  if (!sessionId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '缺少会话ID' });
  }

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
  }

  const html = buildSessionHTML(session);
  // In production, use Puppeteer to render HTML to PDF
  return Buffer.from(html, 'utf-8');
}

/**
 * Bookmark a consultation session.
 * Requirement: 17.4
 */
export async function bookmark(sessionId: string, userId: string): Promise<void> {
  if (!sessionId || !userId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '缺少会话ID或用户ID' });
  }

  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
  }

  // Check if already bookmarked
  const existing = await prisma.bookmark.findUnique({
    where: {
      userId_sessionId: { userId, sessionId },
    },
  });

  if (existing) {
    throw new TRPCError({ code: 'CONFLICT', message: '该会话已收藏' });
  }

  await prisma.bookmark.create({
    data: { userId, sessionId },
  });
}

/**
 * Remove bookmark from a consultation session.
 * Requirement: 17.4
 */
export async function unbookmark(sessionId: string, userId: string): Promise<void> {
  if (!sessionId || !userId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '缺少会话ID或用户ID' });
  }

  const existing = await prisma.bookmark.findUnique({
    where: {
      userId_sessionId: { userId, sessionId },
    },
  });

  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '未找到收藏记录' });
  }

  await prisma.bookmark.delete({
    where: {
      userId_sessionId: { userId, sessionId },
    },
  });
}

/**
 * Resume a consultation session — load full context.
 * Uses Redis cache with 24h TTL for active sessions.
 * Requirements: 17.5, 17.6
 */
export async function resume(sessionId: string): Promise<ConsultationContext> {
  if (!sessionId) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: '缺少会话ID' });
  }

  // Try Redis cache first
  const cacheKey = contextCacheKey(sessionId);
  const cached = await redis.get(cacheKey);

  if (cached) {
    const parsed = JSON.parse(cached) as ConsultationContext;
    // Restore Date objects from JSON
    parsed.session.createdAt = new Date(parsed.session.createdAt);
    parsed.session.updatedAt = new Date(parsed.session.updatedAt);
    parsed.messages = parsed.messages.map((m) => ({
      ...m,
      createdAt: new Date(m.createdAt),
    }));
    parsed.bookmarks = parsed.bookmarks.map((b) => ({
      ...b,
      createdAt: new Date(b.createdAt),
    }));
    return parsed;
  }

  // Cache miss — load from database
  const session = await prisma.consultationSession.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      bookmarks: true,
    },
  });

  if (!session) {
    throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在' });
  }

  const context: ConsultationContext = {
    session: {
      id: session.id,
      userId: session.userId,
      title: session.title,
      legalDomain: session.legalDomain,
      jurisdiction: session.jurisdiction,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    },
    messages: session.messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt,
    })),
    bookmarks: session.bookmarks.map((b) => ({
      id: b.id,
      userId: b.userId,
      sessionId: b.sessionId,
      createdAt: b.createdAt,
    })),
  };

  // Update session status to ACTIVE if it was INTERRUPTED (network recovery)
  if (session.status === 'INTERRUPTED') {
    await prisma.consultationSession.update({
      where: { id: sessionId },
      data: { status: 'ACTIVE' },
    });
    context.session.status = 'ACTIVE';
  }

  // Cache the context in Redis with 24h TTL
  await redis.set(cacheKey, JSON.stringify(context), 'EX', SESSION_CONTEXT_TTL);

  return context;
}

// ==================== Private Helpers ====================

function buildSessionHTML(session: any): string {
  const messagesHTML = session.messages
    .map((msg: any) => {
      const roleLabel = msg.role === 'USER' ? '用户' : msg.role === 'ASSISTANT' ? '系统' : '系统消息';
      return `<div class="message ${msg.role.toLowerCase()}">
        <p><strong>${roleLabel}</strong> <span class="time">${new Date(msg.createdAt).toLocaleString('zh-CN')}</span></p>
        <p>${msg.content}</p>
      </div>`;
    })
    .join('\n');

  const userName = session.user?.name || '用户';
  const title = session.title || '法律咨询会话';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: 'SimSun', serif; margin: 40px; }
    h1 { text-align: center; }
    .meta { color: #666; margin-bottom: 20px; }
    .message { margin: 10px 0; padding: 10px; border-bottom: 1px solid #eee; }
    .message.user { background: #f0f7ff; }
    .message.assistant { background: #f6fff0; }
    .time { color: #999; font-size: 0.9em; }
    .disclaimer { margin-top: 30px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">
    <p>用户：${userName}</p>
    <p>法律领域：${session.legalDomain || '未指定'}</p>
    <p>管辖区：${session.jurisdiction || '未指定'}</p>
    <p>创建时间：${new Date(session.createdAt).toLocaleString('zh-CN')}</p>
  </div>
  <h2>对话记录</h2>
  ${messagesHTML}
  <div class="disclaimer">
    <p><strong>免责声明：</strong>本咨询记录由AI法律专家系统自动生成，仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。</p>
  </div>
</body>
</html>`;
}
