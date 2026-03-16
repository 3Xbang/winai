/**
 * Data Retention & Deletion Service (数据保留与删除策略)
 * Soft delete, 90-day mark-for-deletion, data export, and permanent deletion.
 *
 * Requirements: 19.2, 19.3, 19.4, 19.5
 */

import prisma from '@/lib/prisma';

// ─── Types ──────────────────────────────────────────────────

export interface UserDataExport {
  user: any;
  sessions: any[];
  messages: any[];
  bookmarks: any[];
  orders: any[];
}

// ─── Public API ─────────────────────────────────────────────

/**
 * Soft-delete a user by setting the deletedAt timestamp.
 */
export async function softDeleteUser(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Find users whose deletedAt is more than 90 days ago and mark them
 * for permanent deletion by returning their IDs.
 * In a real system this would update a status field; here we return
 * the list of user IDs that are eligible for permanent deletion.
 */
export async function markForDeletion(): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const users = await prisma.user.findMany({
    where: {
      deletedAt: {
        not: null,
        lte: cutoffDate,
      },
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}

/**
 * Export all user data as a structured JSON object.
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { enterprise: true },
  });

  if (!user) {
    throw new Error(`User ${userId} not found`);
  }

  const sessions = await prisma.consultationSession.findMany({
    where: { userId },
  });

  const sessionIds = sessions.map((s) => s.id);

  const messages = await prisma.message.findMany({
    where: { sessionId: { in: sessionIds } },
  });

  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
  });

  const orders = await prisma.order.findMany({
    where: { userId },
  });

  return { user, sessions, messages, bookmarks, orders };
}

/**
 * Permanently and irrecoverably delete all data for a user.
 * Deletes in dependency order to respect foreign key constraints.
 */
export async function permanentlyDeleteUser(userId: string): Promise<void> {
  // Get session IDs for cascading message deletion
  const sessions = await prisma.consultationSession.findMany({
    where: { userId },
    select: { id: true },
  });
  const sessionIds = sessions.map((s) => s.id);

  // Delete in dependency order
  await prisma.message.deleteMany({
    where: { sessionId: { in: sessionIds } },
  });

  await prisma.bookmark.deleteMany({ where: { userId } });
  await prisma.consultationSession.deleteMany({ where: { userId } });
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.auditLog.deleteMany({ where: { userId } });
  await prisma.enterprise.deleteMany({ where: { userId } });
  await prisma.socialAccount.deleteMany({ where: { userId } });

  // Finally delete the user record
  await prisma.user.delete({ where: { id: userId } });
}
