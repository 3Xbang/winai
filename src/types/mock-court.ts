import type {
  CourtPhase,
  MockCourtStatus,
  UserCourtRole,
  CaseType,
  CourtJurisdiction,
  DifficultyLevel,
  EvidenceType,
  EvidenceAdmission,
  ObjectionType,
  ObjectionRuling,
} from '@prisma/client';

// Re-export Prisma enums for convenience
export type {
  CourtPhase,
  MockCourtStatus,
  UserCourtRole,
  CaseType,
  CourtJurisdiction,
  DifficultyLevel,
  EvidenceType,
  EvidenceAdmission,
  ObjectionType,
  ObjectionRuling,
};

// ==================== Score Dimension ====================

export type ScoreDimension =
  | 'LEGAL_ARGUMENT'
  | 'EVIDENCE_USE'
  | 'PROCEDURE'
  | 'ADAPTABILITY'
  | 'EXPRESSION';

// ==================== Session Creation ====================

export interface CreateSessionInput {
  caseType: CaseType;
  caseDescription: string;
  jurisdiction: CourtJurisdiction;
  userRole: UserCourtRole;
  difficulty: DifficultyLevel;
  supplementary?: Record<string, unknown>;
  importedFromSessionId?: string;
}

export interface CaseConfigPartial {
  caseDescription?: string;
  caseType?: CaseType;
  jurisdiction?: CourtJurisdiction;
  evidenceItems?: EvidenceInput[];
}

// ==================== Court Context ====================

export interface CourtContext {
  sessionId: string;
  caseConfig: {
    caseType: CaseType;
    caseDescription: string;
    jurisdiction: CourtJurisdiction;
    userRole: UserCourtRole;
    difficulty: DifficultyLevel;
    supplementary?: Record<string, unknown>;
  };
  currentPhase: CourtPhase;
  messages: CourtMessageData[];
  evidenceItems: CourtEvidenceData[];
  locale: string;
}

// ==================== Messages ====================

export interface CourtMessageData {
  id: string;
  phase: CourtPhase;
  senderRole: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface AIResponse {
  role: string; // 'JUDGE' | 'OPPOSING_COUNSEL' | 'WITNESS'
  content: string;
  phase: CourtPhase;
  metadata?: Record<string, unknown>;
}

export interface CourtMessageResponse {
  userMessage: CourtMessageData;
  aiResponses: AIResponse[];
  phaseTransition?: {
    from: CourtPhase;
    to: CourtPhase;
  };
}

// ==================== Evidence ====================

export interface EvidenceInput {
  name: string;
  evidenceType: EvidenceType;
  description: string;
  proofPurpose: string;
}

export interface SubmitEvidenceInput {
  sessionId: string;
  evidence: EvidenceInput;
}

export interface CourtEvidenceData {
  id: string;
  name: string;
  evidenceType: EvidenceType;
  description: string;
  proofPurpose: string;
  submittedBy: string;
  admission: EvidenceAdmission;
  admissionReason?: string;
}

export interface EvidenceSubmissionResult {
  evidence: CourtEvidenceData;
  crossExamination: AIResponse;
  ruling: AIResponse;
  admission: EvidenceAdmission;
}

// ==================== Objections ====================

export interface ObjectionInput {
  objectionType: ObjectionType;
  reason?: string;
}

export interface RaiseObjectionInput {
  sessionId: string;
  objection: ObjectionInput;
}

export interface ObjectionRulingResult {
  objectionId: string;
  ruling: ObjectionRuling;
  rulingReason: string;
  judgeResponse: AIResponse;
}

export interface ObjectionResolutionResult {
  objectionId: string;
  userResponse: CourtMessageData;
  ruling: ObjectionRuling;
  rulingReason: string;
  judgeResponse: AIResponse;
}

export interface CourtObjectionData {
  id: string;
  objectionType: ObjectionType;
  raisedBy: string;
  reason?: string;
  ruling: ObjectionRuling;
  rulingReason?: string;
  relatedMessageId?: string;
}

// ==================== Performance Report ====================

export interface DimensionScore {
  dimension: ScoreDimension;
  score: number; // 1-10
  comment: string;
  strengths: string[];
  weaknesses: string[];
}

export interface PerformanceReportData {
  id: string;
  sessionId: string;
  dimensions: DimensionScore[];
  overallScore: number;
  overallComment: string;
  improvements: { suggestion: string; exampleQuote: string }[];
  legalCitations: { citation: string; isAccurate: boolean; correction?: string }[];
  verdictSummary: string;
}

// ==================== Session Detail & Summary ====================

export interface MockCourtSessionDetail {
  id: string;
  userId: string;
  status: MockCourtStatus;
  currentPhase: CourtPhase;
  caseType: CaseType;
  caseDescription: string;
  jurisdiction: CourtJurisdiction;
  userRole: UserCourtRole;
  difficulty: DifficultyLevel;
  supplementary?: Record<string, unknown>;
  messages: CourtMessageData[];
  evidenceItems: CourtEvidenceData[];
  objections: CourtObjectionData[];
  report?: PerformanceReportData;
  hasPendingObjection: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MockCourtSessionSummary {
  id: string;
  caseType: CaseType;
  jurisdiction: CourtJurisdiction;
  difficulty: DifficultyLevel;
  status: MockCourtStatus;
  currentPhase: CourtPhase;
  reportGenerated: boolean;
  createdAt: Date;
}

// ==================== Case Analysis Import ====================

export interface CaseAnalysisSummary {
  sessionId: string;
  title?: string;
  legalDomain?: string;
  jurisdiction?: string;
  createdAt: Date;
}
