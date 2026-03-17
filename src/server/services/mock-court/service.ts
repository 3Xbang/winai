import { TRPCError } from '@trpc/server';
import prisma from '@/lib/prisma';
import type { CourtPhase, SubscriptionTier } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type {
  CreateSessionInput,
  CourtContext,
  CourtMessageData,
  CourtMessageResponse,
  EvidenceInput,
  EvidenceSubmissionResult,
  ObjectionInput,
  ObjectionRulingResult,
  ObjectionResolutionResult,
  MockCourtSessionDetail,
  CourtEvidenceData,
  CourtObjectionData,
} from '@/types/mock-court';
import { validateCaseConfig, validateEvidenceInput } from '@/lib/mock-court-validation';
import { PhaseManager } from './phase-manager';
import { CourtAIService } from './court-ai';
import { LLMGateway, getLLMGateway } from '../llm/gateway';

// ==================== Quota Constants ====================

const QUOTA_LIMITS: Record<SubscriptionTier, { monthly: number | null; allowedDifficulties: string[] }> = {
  FREE: { monthly: 2, allowedDifficulties: ['BEGINNER'] },
  STANDARD: { monthly: 10, allowedDifficulties: ['BEGINNER', 'INTERMEDIATE'] },
  VIP: { monthly: null, allowedDifficulties: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
};

// ==================== MockCourtService ====================

export class MockCourtService {
  private phaseManager: PhaseManager;
  private courtAI: CourtAIService;

  constructor(llm?: LLMGateway) {
    this.phaseManager = new PhaseManager();
    this.courtAI = new CourtAIService(llm ?? getLLMGateway());
  }

  // ─── Quota Checking ──────────────────────────────────────

  /**
   * Check if user has quota to create a new session.
   * Returns the user's subscription tier.
   */
  async checkQuota(userId: string): Promise<SubscriptionTier> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: { include: { plan: true } },
      },
    });

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '用户不存在' });
    }

    const now = new Date();
    let tier: SubscriptionTier = 'FREE';

    if (user.subscription && user.subscription.status === 'ACTIVE') {
      if (user.subscription.endDate > now) {
        if (user.subscription.isTrial && user.subscription.trialEndDate && user.subscription.trialEndDate <= now) {
          tier = 'FREE';
        } else {
          tier = user.subscription.plan.tier;
        }
      }
    }

    const limits = QUOTA_LIMITS[tier];

    // VIP has no monthly limit
    if (limits.monthly !== null) {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const count = await prisma.mockCourtSession.count({
        where: {
          userId,
          createdAt: { gte: startOfMonth },
          status: { not: 'DELETED' },
        },
      });

      if (count >= limits.monthly) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `本月模拟法庭次数已达上限（${limits.monthly}次），请升级订阅以获取更多次数。`,
        });
      }
    }

    return tier;
  }

  /**
   * Check if the user's subscription tier allows the requested difficulty.
   */
  checkDifficultyAccess(tier: SubscriptionTier, difficulty: string): void {
    const limits = QUOTA_LIMITS[tier];
    if (!limits.allowedDifficulties.includes(difficulty)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `当前订阅等级（${tier}）不支持${difficulty}难度，请升级订阅。`,
      });
    }
  }

  // ─── Create Session ──────────────────────────────────────

  /**
   * Create a new mock court session.
   * Validates quota → validates config → creates DB record → generates judge opening → records usage.
   */
  async createSession(userId: string, config: CreateSessionInput): Promise<MockCourtSessionDetail> {
    // 1. Validate case config
    const validation = validateCaseConfig(config);
    if (!validation.valid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `表单验证失败: ${Object.values(validation.errors).join('; ')}`,
      });
    }

    // 2. Check subscription quota
    const tier = await this.checkQuota(userId);

    // 3. Check difficulty access
    this.checkDifficultyAccess(tier, config.difficulty);

    // 4. Create session in DB
    const session = await prisma.mockCourtSession.create({
      data: {
        userId,
        caseType: config.caseType,
        caseDescription: config.caseDescription,
        jurisdiction: config.jurisdiction,
        userRole: config.userRole,
        difficulty: config.difficulty,
        supplementary: (config.supplementary as Prisma.InputJsonValue) ?? undefined,
        importedFromSessionId: config.importedFromSessionId ?? undefined,
        currentPhase: 'OPENING',
        status: 'ACTIVE',
      },
    });

    // 5. Generate judge opening statement
    const context = this.buildCourtContext(session, [], []);
    const judgeResponse = await this.courtAI.generateJudgeResponse(context);

    // 6. Save judge opening message
    const judgeMessage = await prisma.courtMessage.create({
      data: {
        sessionId: session.id,
        phase: 'OPENING',
        senderRole: judgeResponse.role,
        content: judgeResponse.content,
        metadata: { type: 'phase_introduction' },
      },
    });

    // 7. Record usage
    await this.recordUsage(userId);

    // 8. Return session detail
    return this.buildSessionDetail(session.id);
  }

  // ─── Process Message ─────────────────────────────────────

  /**
   * Process a user message in the court session.
   * Validates session → checks objection state → saves message → dispatches AI → checks phase transition.
   */
  async processMessage(sessionId: string, userId: string, content: string): Promise<CourtMessageResponse> {
    // 1. Load and validate session
    const session = await this.getSessionOrThrow(sessionId, userId);

    // 2. Check session is active
    if (session.status !== 'ACTIVE') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: '该会话已结束，无法发送消息。' });
    }

    // 3. Check action is allowed in current phase
    if (!this.phaseManager.isActionAllowed(session.currentPhase, 'SEND_MESSAGE')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `当前阶段（${session.currentPhase}）不允许发送消息。`,
      });
    }

    // 4. Check for pending AI objection
    const pendingObjection = await prisma.courtObjection.findFirst({
      where: {
        sessionId,
        raisedBy: 'OPPOSING_COUNSEL',
        ruling: 'PENDING',
      },
    });

    if (pendingObjection) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: '对方律师已提出异议，请先回应异议后再继续发言。',
      });
    }

    // 5. Save user message
    const userMsg = await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: session.currentPhase,
        senderRole: 'USER',
        content,
      },
    });

    // 6. Load conversation history
    const messages = await this.getSessionMessages(sessionId);
    const evidenceItems = await this.getSessionEvidence(sessionId);

    // 7. Build context and generate AI responses
    const context = this.buildCourtContext(session, messages, evidenceItems);
    const aiResponses = [];

    // Generate opposing counsel response
    const opposingResponse = await this.courtAI.generateOpposingCounselResponse(context);
    const opposingMsg = await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: session.currentPhase,
        senderRole: opposingResponse.role,
        content: opposingResponse.content,
      },
    });
    aiResponses.push(opposingResponse);

    // Check if opposing counsel raised an objection (detected by content analysis)
    if (this.detectObjectionInResponse(opposingResponse.content)) {
      await this.createAIObjection(sessionId, opposingMsg.id);
    }

    // 8. Check phase transition — ask judge if phase should advance
    const phaseTransition = await this.checkPhaseTransition(session, [...messages, this.toMessageData(userMsg), this.toMessageData(opposingMsg)], evidenceItems);

    if (phaseTransition) {
      // Generate judge phase transition message
      const newPhaseContext: CourtContext = {
        ...context,
        currentPhase: phaseTransition.to,
        messages: [...context.messages, this.toMessageData(userMsg), this.toMessageData(opposingMsg)],
      };
      const judgeTransitionResponse = await this.courtAI.generateJudgeResponse(newPhaseContext);
      await prisma.courtMessage.create({
        data: {
          sessionId,
          phase: phaseTransition.to,
          senderRole: 'JUDGE',
          content: judgeTransitionResponse.content,
          metadata: { type: 'phase_transition', from: phaseTransition.from, to: phaseTransition.to },
        },
      });
      aiResponses.push(judgeTransitionResponse);

      // Update session phase
      await prisma.mockCourtSession.update({
        where: { id: sessionId },
        data: { currentPhase: phaseTransition.to },
      });

      // If entering VERDICT, mark session as completed
      if (phaseTransition.to === 'VERDICT') {
        await prisma.mockCourtSession.update({
          where: { id: sessionId },
          data: { status: 'COMPLETED' },
        });
      }
    }

    return {
      userMessage: this.toMessageData(userMsg),
      aiResponses,
      phaseTransition: phaseTransition ?? undefined,
    };
  }

  // ─── Submit Evidence ─────────────────────────────────────

  /**
   * Submit evidence during the EVIDENCE phase.
   * Validates phase → validates fields → saves evidence → AI cross-examination → AI judge ruling.
   */
  async submitEvidence(sessionId: string, userId: string, evidence: EvidenceInput): Promise<EvidenceSubmissionResult> {
    // 1. Load and validate session
    const session = await this.getSessionOrThrow(sessionId, userId);

    // 2. Check EVIDENCE phase
    if (!this.phaseManager.isActionAllowed(session.currentPhase, 'SUBMIT_EVIDENCE')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: '证据提交仅在举证质证阶段（EVIDENCE）可用。',
      });
    }

    // 3. Validate evidence fields
    const validation = validateEvidenceInput(evidence);
    if (!validation.valid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `证据验证失败: ${Object.values(validation.errors).join('; ')}`,
      });
    }

    // 4. Save evidence to DB
    const evidenceRecord = await prisma.courtEvidence.create({
      data: {
        sessionId,
        name: evidence.name,
        evidenceType: evidence.evidenceType,
        description: evidence.description,
        proofPurpose: evidence.proofPurpose,
        submittedBy: 'USER',
      },
    });

    // 5. Save a system message about evidence submission
    await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: 'EVIDENCE',
        senderRole: 'SYSTEM',
        content: `用户提交证据：${evidence.name}（${evidence.evidenceType}）— ${evidence.proofPurpose}`,
        metadata: { type: 'evidence_submission', evidenceId: evidenceRecord.id },
      },
    });

    // 6. Load context for AI responses
    const messages = await this.getSessionMessages(sessionId);
    const allEvidence = await this.getSessionEvidence(sessionId);
    const context = this.buildCourtContext(session, messages, allEvidence);

    // 7. AI opposing counsel cross-examination
    const crossExamContext = {
      ...context,
      messages: [
        ...context.messages,
        {
          id: 'evidence-prompt',
          phase: 'EVIDENCE' as const,
          senderRole: 'SYSTEM',
          content: `请对以下证据进行质证：\n证据名称：${evidence.name}\n证据类型：${evidence.evidenceType}\n证据描述：${evidence.description}\n证明目的：${evidence.proofPurpose}`,
          createdAt: new Date(),
        },
      ],
    };
    const crossExamResponse = await this.courtAI.generateOpposingCounselResponse(crossExamContext);
    await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: 'EVIDENCE',
        senderRole: crossExamResponse.role,
        content: crossExamResponse.content,
        metadata: { type: 'cross_examination', evidenceId: evidenceRecord.id },
      },
    });

    // 8. AI judge ruling on evidence admission
    const rulingContext = {
      ...crossExamContext,
      messages: [
        ...crossExamContext.messages,
        {
          id: 'cross-exam',
          phase: 'EVIDENCE' as const,
          senderRole: 'OPPOSING_COUNSEL',
          content: crossExamResponse.content,
          createdAt: new Date(),
        },
      ],
    };
    const judgeRulingResponse = await this.courtAI.generateJudgeResponse(rulingContext);
    await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: 'EVIDENCE',
        senderRole: 'JUDGE',
        content: judgeRulingResponse.content,
        metadata: { type: 'evidence_ruling', evidenceId: evidenceRecord.id },
      },
    });

    // 9. Parse admission decision from judge response
    const admission = this.parseEvidenceAdmission(judgeRulingResponse.content);
    await prisma.courtEvidence.update({
      where: { id: evidenceRecord.id },
      data: {
        admission: admission.status,
        admissionReason: admission.reason,
      },
    });

    return {
      evidence: {
        id: evidenceRecord.id,
        name: evidenceRecord.name,
        evidenceType: evidenceRecord.evidenceType,
        description: evidenceRecord.description,
        proofPurpose: evidenceRecord.proofPurpose,
        submittedBy: evidenceRecord.submittedBy,
        admission: admission.status,
        admissionReason: admission.reason,
      },
      crossExamination: crossExamResponse,
      ruling: judgeRulingResponse,
      admission: admission.status,
    };
  }

  // ─── Handle Objection (User raises objection) ───────────

  /**
   * Handle a user-raised objection.
   * Saves objection → AI judge ruling.
   */
  async handleObjection(sessionId: string, userId: string, objection: ObjectionInput): Promise<ObjectionRulingResult> {
    // 1. Load and validate session
    const session = await this.getSessionOrThrow(sessionId, userId);

    // 2. Check action is allowed
    if (!this.phaseManager.isActionAllowed(session.currentPhase, 'RAISE_OBJECTION')) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `当前阶段（${session.currentPhase}）不允许提出异议。`,
      });
    }

    // 3. Save objection to DB
    const objectionRecord = await prisma.courtObjection.create({
      data: {
        sessionId,
        objectionType: objection.objectionType,
        raisedBy: 'USER',
        reason: objection.reason ?? undefined,
      },
    });

    // 4. Save objection message
    await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: session.currentPhase,
        senderRole: 'USER',
        content: `【异议】类型：${objection.objectionType}${objection.reason ? `，理由：${objection.reason}` : ''}`,
        metadata: { type: 'objection', objectionId: objectionRecord.id },
      },
    });

    // 5. AI judge ruling
    const messages = await this.getSessionMessages(sessionId);
    const evidenceItems = await this.getSessionEvidence(sessionId);
    const context = this.buildCourtContext(session, messages, evidenceItems);

    const judgeResponse = await this.courtAI.generateJudgeResponse({
      ...context,
      messages: [
        ...context.messages,
        {
          id: 'objection-prompt',
          phase: session.currentPhase,
          senderRole: 'SYSTEM',
          content: `用户提出异议，类型：${objection.objectionType}，理由：${objection.reason ?? '未说明'}。请裁定该异议是否成立。`,
          createdAt: new Date(),
        },
      ],
    });

    // 6. Save judge ruling message
    await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: session.currentPhase,
        senderRole: 'JUDGE',
        content: judgeResponse.content,
        metadata: { type: 'objection_ruling', objectionId: objectionRecord.id },
      },
    });

    // 7. Parse ruling from judge response
    const ruling = this.parseObjectionRuling(judgeResponse.content);

    // 8. Update objection record
    await prisma.courtObjection.update({
      where: { id: objectionRecord.id },
      data: {
        ruling: ruling.ruling,
        rulingReason: ruling.reason,
      },
    });

    return {
      objectionId: objectionRecord.id,
      ruling: ruling.ruling,
      rulingReason: ruling.reason,
      judgeResponse,
    };
  }

  // ─── Respond to AI Objection ─────────────────────────────

  /**
   * Respond to an AI-raised objection.
   * Saves user response → clears pending objection state → AI judge ruling.
   */
  async respondToObjection(sessionId: string, userId: string, response: string): Promise<ObjectionResolutionResult> {
    // 1. Load and validate session
    const session = await this.getSessionOrThrow(sessionId, userId);

    // 2. Find pending AI objection
    const pendingObjection = await prisma.courtObjection.findFirst({
      where: {
        sessionId,
        raisedBy: 'OPPOSING_COUNSEL',
        ruling: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pendingObjection) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: '当前没有待回应的异议。',
      });
    }

    // 3. Save user response message
    const userResponseMsg = await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: session.currentPhase,
        senderRole: 'USER',
        content: response,
        metadata: { type: 'objection_response', objectionId: pendingObjection.id },
      },
    });

    // 4. AI judge ruling on the objection
    const messages = await this.getSessionMessages(sessionId);
    const evidenceItems = await this.getSessionEvidence(sessionId);
    const context = this.buildCourtContext(session, messages, evidenceItems);

    const judgeResponse = await this.courtAI.generateJudgeResponse({
      ...context,
      messages: [
        ...context.messages,
        {
          id: 'objection-response-prompt',
          phase: session.currentPhase,
          senderRole: 'SYSTEM',
          content: `对方律师提出异议（类型：${pendingObjection.objectionType}），用户回应：${response}。请裁定该异议是否成立。`,
          createdAt: new Date(),
        },
      ],
    });

    // 5. Save judge ruling message
    await prisma.courtMessage.create({
      data: {
        sessionId,
        phase: session.currentPhase,
        senderRole: 'JUDGE',
        content: judgeResponse.content,
        metadata: { type: 'objection_ruling', objectionId: pendingObjection.id },
      },
    });

    // 6. Parse ruling
    const ruling = this.parseObjectionRuling(judgeResponse.content);

    // 7. Update objection record — clears pending state
    await prisma.courtObjection.update({
      where: { id: pendingObjection.id },
      data: {
        ruling: ruling.ruling,
        rulingReason: ruling.reason,
      },
    });

    return {
      objectionId: pendingObjection.id,
      userResponse: this.toMessageData(userResponseMsg),
      ruling: ruling.ruling,
      rulingReason: ruling.reason,
      judgeResponse,
    };
  }

  // ─── Resume Session ─────────────────────────────────────

  /**
   * Resume a session — returns full session state for the client to restore.
   */
  async resumeSession(sessionId: string, userId: string): Promise<MockCourtSessionDetail> {
    return this.buildSessionDetail(sessionId, userId);
  }

  // ─── Incremental Sync (Reconnection Support) ──────────────

  /**
   * Get messages created after a given message ID (for incremental sync on reconnection).
   * If afterMessageId is not provided, returns all messages for the session.
   * This enables the frontend to fetch only missed messages after a network interruption.
   * Requirements: 11.3
   */
  async getMessagesSince(
    sessionId: string,
    userId: string,
    afterMessageId?: string,
  ): Promise<CourtMessageData[]> {
    // Verify session ownership
    await this.getSessionOrThrow(sessionId, userId);

    // If no afterMessageId, return all messages
    if (!afterMessageId) {
      return this.getSessionMessages(sessionId);
    }

    // Find the reference message to get its createdAt timestamp
    const refMessage = await prisma.courtMessage.findUnique({
      where: { id: afterMessageId },
    });

    if (!refMessage || refMessage.sessionId !== sessionId) {
      // If the reference message doesn't exist or belongs to a different session,
      // fall back to returning all messages
      return this.getSessionMessages(sessionId);
    }

    // Fetch messages created after the reference message
    // Use createdAt + id to handle messages created at the same timestamp
    const messages = await prisma.courtMessage.findMany({
      where: {
        sessionId,
        OR: [
          { createdAt: { gt: refMessage.createdAt } },
          {
            createdAt: refMessage.createdAt,
            id: { gt: afterMessageId },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map(this.toMessageData);
  }

  // ─── Private Helpers ───────────────────────────────────────

  /**
   * Load session and verify ownership.
   */
  private async getSessionOrThrow(sessionId: string, userId: string) {
    const session = await prisma.mockCourtSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在。' });
    }

    if (session.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问该会话。' });
    }

    return session;
  }

  /**
   * Get all messages for a session, ordered by creation time.
   */
  private async getSessionMessages(sessionId: string): Promise<CourtMessageData[]> {
    const messages = await prisma.courtMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map(this.toMessageData);
  }

  /**
   * Get all evidence items for a session.
   */
  private async getSessionEvidence(sessionId: string): Promise<CourtEvidenceData[]> {
    const items = await prisma.courtEvidence.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return items.map((e) => ({
      id: e.id,
      name: e.name,
      evidenceType: e.evidenceType,
      description: e.description,
      proofPurpose: e.proofPurpose,
      submittedBy: e.submittedBy,
      admission: e.admission,
      admissionReason: e.admissionReason ?? undefined,
    }));
  }

  /**
   * Get all objections for a session.
   */
  private async getSessionObjections(sessionId: string): Promise<CourtObjectionData[]> {
    const objections = await prisma.courtObjection.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return objections.map((o) => ({
      id: o.id,
      objectionType: o.objectionType,
      raisedBy: o.raisedBy,
      reason: o.reason ?? undefined,
      ruling: o.ruling,
      rulingReason: o.rulingReason ?? undefined,
      relatedMessageId: o.relatedMessageId ?? undefined,
    }));
  }

  /**
   * Build a CourtContext from session data.
   */
  private buildCourtContext(
    session: {
      id: string;
      caseType: string;
      caseDescription: string;
      jurisdiction: string;
      userRole: string;
      difficulty: string;
      supplementary?: unknown;
      currentPhase: string;
    },
    messages: CourtMessageData[],
    evidenceItems: CourtEvidenceData[],
    locale = 'zh',
  ): CourtContext {
    return {
      sessionId: session.id,
      caseConfig: {
        caseType: session.caseType as CourtContext['caseConfig']['caseType'],
        caseDescription: session.caseDescription,
        jurisdiction: session.jurisdiction as CourtContext['caseConfig']['jurisdiction'],
        userRole: session.userRole as CourtContext['caseConfig']['userRole'],
        difficulty: session.difficulty as CourtContext['caseConfig']['difficulty'],
        supplementary: (session.supplementary as Record<string, unknown>) ?? undefined,
      },
      currentPhase: session.currentPhase as CourtContext['currentPhase'],
      messages,
      evidenceItems,
      locale,
    };
  }

  /**
   * Build a full MockCourtSessionDetail from DB.
   */
  private async buildSessionDetail(sessionId: string, userId?: string): Promise<MockCourtSessionDetail> {
    const session = await prisma.mockCourtSession.findUnique({
      where: { id: sessionId },
      include: {
        report: true,
      },
    });

    if (!session || session.deletedAt) {
      throw new TRPCError({ code: 'NOT_FOUND', message: '会话不存在。' });
    }

    if (userId && session.userId !== userId) {
      throw new TRPCError({ code: 'FORBIDDEN', message: '无权访问该会话。' });
    }

    const [messages, evidenceItems, objections] = await Promise.all([
      this.getSessionMessages(sessionId),
      this.getSessionEvidence(sessionId),
      this.getSessionObjections(sessionId),
    ]);

    // Check for pending AI objection
    const hasPendingObjection = objections.some(
      (o) => o.raisedBy === 'OPPOSING_COUNSEL' && o.ruling === 'PENDING',
    );

    return {
      id: session.id,
      userId: session.userId,
      status: session.status,
      currentPhase: session.currentPhase,
      caseType: session.caseType,
      caseDescription: session.caseDescription,
      jurisdiction: session.jurisdiction,
      userRole: session.userRole,
      difficulty: session.difficulty,
      supplementary: (session.supplementary as Record<string, unknown>) ?? undefined,
      messages,
      evidenceItems,
      objections,
      report: session.report
        ? {
            id: session.report.id,
            sessionId: session.report.sessionId,
            dimensions: [
              { dimension: 'LEGAL_ARGUMENT' as const, score: session.report.legalArgumentScore, comment: '', strengths: [], weaknesses: [] },
              { dimension: 'EVIDENCE_USE' as const, score: session.report.evidenceUseScore, comment: '', strengths: [], weaknesses: [] },
              { dimension: 'PROCEDURE' as const, score: session.report.procedureScore, comment: '', strengths: [], weaknesses: [] },
              { dimension: 'ADAPTABILITY' as const, score: session.report.adaptabilityScore, comment: '', strengths: [], weaknesses: [] },
              { dimension: 'EXPRESSION' as const, score: session.report.expressionScore, comment: '', strengths: [], weaknesses: [] },
            ],
            overallScore: session.report.overallScore,
            overallComment: session.report.overallComment,
            improvements: session.report.improvements as { suggestion: string; exampleQuote: string }[],
            legalCitations: session.report.legalCitations as { citation: string; isAccurate: boolean; correction?: string }[],
            verdictSummary: session.report.verdictSummary,
          }
        : undefined,
      hasPendingObjection,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  /**
   * Convert a Prisma CourtMessage to CourtMessageData.
   */
  private toMessageData(msg: {
    id: string;
    phase: string;
    senderRole: string;
    content: string;
    metadata?: unknown;
    createdAt: Date;
  }): CourtMessageData {
    return {
      id: msg.id,
      phase: msg.phase as CourtMessageData['phase'],
      senderRole: msg.senderRole,
      content: msg.content,
      metadata: (msg.metadata as Record<string, unknown>) ?? undefined,
      createdAt: msg.createdAt,
    };
  }

  /**
   * Record usage for mock court session creation.
   */
  private async recordUsage(userId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.usageRecord.upsert({
      where: {
        userId_date: { userId, date: today },
      },
      update: {
        monthlyCount: { increment: 1 },
      },
      create: {
        userId,
        date: today,
        dailyCount: 0,
        monthlyCount: 1,
      },
    });
  }

  /**
   * Detect if an AI opposing counsel response contains an objection.
   * Simple heuristic: check for objection-related keywords.
   */
  private detectObjectionInResponse(content: string): boolean {
    const objectionKeywords = ['提出异议', '我方异议', '异议！', 'Objection', 'I object', 'ข้อโต้แย้ง'];
    return objectionKeywords.some((kw) => content.includes(kw));
  }

  /**
   * Create an AI-raised objection record and set pending state.
   */
  private async createAIObjection(sessionId: string, relatedMessageId: string): Promise<void> {
    await prisma.courtObjection.create({
      data: {
        sessionId,
        objectionType: 'OTHER',
        raisedBy: 'OPPOSING_COUNSEL',
        reason: 'AI 对方律师在发言中提出异议',
        relatedMessageId,
        ruling: 'PENDING',
      },
    });
  }

  /**
   * Check if the current phase should transition to the next.
   * Uses a simple heuristic based on message count per phase.
   */
  private async checkPhaseTransition(
    session: { id: string; currentPhase: CourtPhase },
    messages: CourtMessageData[],
    _evidenceItems: CourtEvidenceData[],
  ): Promise<{ from: CourtPhase; to: CourtPhase } | null> {
    const currentPhase = session.currentPhase;

    if (!this.phaseManager.canTransition(currentPhase)) {
      return null;
    }

    // Count messages in current phase
    const phaseMessages = messages.filter((m) => m.phase === currentPhase && m.senderRole !== 'SYSTEM');
    const userMessages = phaseMessages.filter((m) => m.senderRole === 'USER');

    // Phase transition thresholds (minimum user messages before transition is considered)
    const thresholds: Record<string, number> = {
      OPENING: 1,   // After user's opening statement
      EVIDENCE: 2,  // After at least 2 evidence-related interactions
      DEBATE: 3,    // After at least 3 rounds of debate
      CLOSING: 1,   // After user's closing statement
    };

    const threshold = thresholds[currentPhase] ?? 2;
    if (userMessages.length >= threshold) {
      const nextPhase = this.phaseManager.transition(currentPhase);
      return { from: currentPhase, to: nextPhase };
    }

    return null;
  }

  /**
   * Parse evidence admission decision from judge response content.
   */
  private parseEvidenceAdmission(content: string): { status: 'ADMITTED' | 'PARTIALLY_ADMITTED' | 'REJECTED'; reason: string } {
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('不予采纳') || lowerContent.includes('rejected') || lowerContent.includes('不予认定')) {
      return { status: 'REJECTED', reason: content };
    }
    if (lowerContent.includes('部分采纳') || lowerContent.includes('partially') || lowerContent.includes('部分认定')) {
      return { status: 'PARTIALLY_ADMITTED', reason: content };
    }
    // Default to admitted
    return { status: 'ADMITTED', reason: content };
  }

  /**
   * Parse objection ruling from judge response content.
   */
  private parseObjectionRuling(content: string): { ruling: 'SUSTAINED' | 'OVERRULED'; reason: string } {
    const lowerContent = content.toLowerCase();

    if (
      lowerContent.includes('异议成立') ||
      lowerContent.includes('sustained') ||
      lowerContent.includes('支持异议') ||
      lowerContent.includes('异议有理')
    ) {
      return { ruling: 'SUSTAINED', reason: content };
    }
    // Default to overruled
    return { ruling: 'OVERRULED', reason: content };
  }
}

