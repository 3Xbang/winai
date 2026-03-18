import { prisma } from '@/lib/prisma';

export interface ConflictResult {
  hasConflict: boolean;
  conflictingCases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
    opposingParty: string | null;
  }>;
}

/**
 * 检查新案件的对立方是否与工作空间内现有案件存在利益冲突
 * 冲突条件：新案件对立方字符串与现有案件当事人或对立方存在重叠
 */
export async function checkConflict(
  workspaceId: string,
  opposingParty: string,
): Promise<ConflictResult> {
  if (!opposingParty.trim()) {
    return { hasConflict: false, conflictingCases: [] };
  }

  const existingCases = await prisma.case.findMany({
    where: { workspaceId },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      clientName: true,
      opposingParty: true,
    },
  });

  const normalizedOpposing = opposingParty.toLowerCase().trim();

  const conflictingCases = existingCases.filter((c) => {
    const clientMatch = c.clientName.toLowerCase().includes(normalizedOpposing) ||
      normalizedOpposing.includes(c.clientName.toLowerCase());
    const opposingMatch = c.opposingParty
      ? c.opposingParty.toLowerCase().includes(normalizedOpposing) ||
        normalizedOpposing.includes(c.opposingParty.toLowerCase())
      : false;
    return clientMatch || opposingMatch;
  });

  return {
    hasConflict: conflictingCases.length > 0,
    conflictingCases,
  };
}
