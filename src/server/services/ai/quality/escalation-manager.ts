/**
 * Escalation Manager — Human escalation for low-confidence responses
 * Requirements: 30.5
 */

// ─── Types ──────────────────────────────────────────────────

export interface HumanEscalation {
  id: string;
  sessionId: string;
  reason: string;
  status: 'PENDING' | 'ASSIGNED' | 'RESOLVED';
  createdAt: Date;
}

// ─── In-Memory Store (production: HumanEscalation table) ────

const escalationStore: HumanEscalation[] = [];

// ─── Public API ─────────────────────────────────────────────

export function triggerHumanEscalation(
  sessionId: string,
  reason: string,
): HumanEscalation {
  const escalation: HumanEscalation = {
    id: `esc-${Date.now()}`,
    sessionId,
    reason,
    status: 'PENDING',
    createdAt: new Date(),
  };
  escalationStore.push(escalation);
  return escalation;
}

export function getEscalations(): HumanEscalation[] {
  return [...escalationStore];
}

export function clearEscalations(): void {
  escalationStore.length = 0;
}
