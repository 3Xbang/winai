/**
 * Feedback Collector — User feedback and satisfaction scoring
 * Requirements: 30.1, 30.2
 */

// ─── Types ──────────────────────────────────────────────────

export type FeedbackType = 'HELPFUL' | 'UNHELPFUL' | 'INCORRECT';

export interface QualityFeedback {
  id: string;
  messageId: string;
  userId: string;
  rating: number; // 1-5
  feedbackType: FeedbackType;
  comment: string;
  createdAt: Date;
}

export interface FeedbackSubmission {
  messageId: string;
  userId: string;
  rating: number;
  feedbackType: FeedbackType;
  comment?: string;
}

// ─── In-Memory Store (production: QualityFeedback table) ────

const feedbackStore: QualityFeedback[] = [];

// ─── Public API ─────────────────────────────────────────────

export function submitFeedback(submission: FeedbackSubmission): QualityFeedback {
  const feedback: QualityFeedback = {
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    messageId: submission.messageId,
    userId: submission.userId,
    rating: Math.max(1, Math.min(5, Math.round(submission.rating))),
    feedbackType: submission.feedbackType,
    comment: submission.comment ?? '',
    createdAt: new Date(),
  };
  feedbackStore.push(feedback);
  return feedback;
}

export function getFeedbackByMessage(messageId: string): QualityFeedback[] {
  return feedbackStore.filter((f) => f.messageId === messageId);
}

export function getAverageSatisfaction(): number {
  if (feedbackStore.length === 0) return 0;
  return feedbackStore.reduce((sum, f) => sum + f.rating, 0) / feedbackStore.length;
}

export function clearFeedback(): void {
  feedbackStore.length = 0;
}
