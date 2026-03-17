import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getLLMGateway } from '@/server/services/llm/gateway';
import { CourtAIService } from '@/server/services/mock-court/court-ai';
import prisma from '@/lib/prisma';
import type { CourtContext, CourtMessageData, CourtEvidenceData } from '@/types/mock-court';

const STREAM_TIMEOUT_MS = 30_000;

let _courtAI: CourtAIService | null = null;
function getCourtAI(): CourtAIService {
  if (!_courtAI) _courtAI = new CourtAIService(getLLMGateway());
  return _courtAI;
}

/**
 * POST /api/mock-court/stream
 *
 * SSE streaming endpoint for mock court AI responses.
 * Authenticates the user, validates the session, saves the user message,
 * then streams AI role responses back as Server-Sent Events.
 *
 * Request body: { sessionId: string, content: string }
 * SSE format:   data: { role: AI_Role, content: string, phase: Court_Phase, done: boolean }
 */
export async function POST(req: NextRequest) {
  // 1. Authenticate
  const token = await getToken({
    req: req as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token?.userId) {
    return NextResponse.json({ error: '请先登录' }, { status: 401 });
  }

  const userId = token.userId as string;

  // 2. Parse request body
  let sessionId: string;
  let content: string;
  try {
    const body = await req.json();
    sessionId = body.sessionId;
    content = body.content;

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: '缺少 sessionId' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: '消息内容不能为空' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  // 3. Validate session ownership and status
  const session = await prisma.mockCourtSession.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.deletedAt) {
    return NextResponse.json({ error: '会话不存在' }, { status: 404 });
  }

  if (session.userId !== userId) {
    return NextResponse.json({ error: '无权访问该会话' }, { status: 403 });
  }

  if (session.status !== 'ACTIVE') {
    return NextResponse.json({ error: '该会话已结束' }, { status: 400 });
  }

  // 4. Check AI service availability
  const gateway = getLLMGateway();
  if (!gateway.isAvailable()) {
    return NextResponse.json(
      { error: 'AI 服务暂不可用，请稍后重试' },
      { status: 503 },
    );
  }

  // 5. Save user message to DB
  await prisma.courtMessage.create({
    data: {
      sessionId,
      phase: session.currentPhase,
      senderRole: 'USER',
      content,
    },
  });

  // 6. Load conversation history and build context
  const [messages, evidenceItems] = await Promise.all([
    prisma.courtMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.courtEvidence.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const messageData: CourtMessageData[] = messages.map((m) => ({
    id: m.id,
    phase: m.phase,
    senderRole: m.senderRole,
    content: m.content,
    metadata: (m.metadata as Record<string, unknown>) ?? undefined,
    createdAt: m.createdAt,
  }));

  const evidenceData: CourtEvidenceData[] = evidenceItems.map((e) => ({
    id: e.id,
    name: e.name,
    evidenceType: e.evidenceType,
    description: e.description,
    proofPurpose: e.proofPurpose,
    submittedBy: e.submittedBy,
    admission: e.admission,
    admissionReason: e.admissionReason ?? undefined,
  }));

  const context: CourtContext = {
    sessionId,
    caseConfig: {
      caseType: session.caseType,
      caseDescription: session.caseDescription,
      jurisdiction: session.jurisdiction,
      userRole: session.userRole,
      difficulty: session.difficulty,
      supplementary: (session.supplementary as Record<string, unknown>) ?? undefined,
    },
    currentPhase: session.currentPhase,
    messages: messageData,
    evidenceItems: evidenceData,
    locale: 'zh',
  };

  // 7. Stream AI response via SSE
  const courtAI = getCourtAI();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        const errorEvent = `data: ${JSON.stringify({
          role: 'SYSTEM',
          content: 'AI 响应超时，请重试。',
          phase: session.currentPhase,
          done: true,
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }, STREAM_TIMEOUT_MS);

      try {
        let fullContent = '';
        const role = 'OPPOSING_COUNSEL' as const;

        for await (const chunk of courtAI.streamResponse(role, context)) {
          if (timedOut) break;

          const sseData = `data: ${JSON.stringify({
            role: chunk.role,
            content: chunk.content,
            phase: chunk.phase,
            done: chunk.done,
          })}\n\n`;

          controller.enqueue(encoder.encode(sseData));
          fullContent += chunk.content;

          if (chunk.done) break;
        }

        if (!timedOut) {
          clearTimeout(timeout);

          // Save the complete AI response to DB
          if (fullContent) {
            await prisma.courtMessage.create({
              data: {
                sessionId,
                phase: session.currentPhase,
                senderRole: role,
                content: fullContent,
              },
            });
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      } catch (error) {
        clearTimeout(timeout);
        if (!timedOut) {
          console.error('Mock court SSE stream error:', error);
          const errorEvent = `data: ${JSON.stringify({
            role: 'SYSTEM',
            content: 'AI 服务异常，请稍后重试。',
            phase: session.currentPhase,
            done: true,
          })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
