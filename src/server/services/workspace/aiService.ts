import { LLMGateway } from '../llm/gateway';
import { prisma } from '@/lib/prisma';

export interface ClassificationResult {
  category: 'VALID' | 'INVALID' | 'NEEDS_SUPPLEMENT';
  proofPurpose: string;
  legalBasis: string[];
  strength: 'STRONG' | 'MEDIUM' | 'WEAK';
  similarCase: string;
}

export interface EvidenceInput {
  fileName: string;
  mimeType: string;
  description?: string;
  caseContext?: string;
  // 图片/视频类证据可传入 base64 内容
  fileBase64?: string;
}

// 模型选择策略：
// - 证据分类（法律推理）→ glm-4.1v-thinking-flash（深度思考，推理更准确）
// - 图片/视频类证据 → glm-4.6v-flash（多模态，支持图片+文档）
// - 会见摘要生成（文本摘要）→ glm-4-flash-250414（速度优先）
const MODELS = {
  evidenceClassify: 'glm-4.1v-thinking-flash',
  evidenceMultimodal: 'glm-4.6v-flash',
  visitSummary: 'glm-4-flash-250414',
} as const;

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
const VIDEO_MIME_TYPES = ['video/mp4', 'video/avi', 'video/mov', 'video/mkv'];

function isMultimodalEvidence(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType) || VIDEO_MIME_TYPES.includes(mimeType);
}

const gateway = new LLMGateway();

export const aiService = {
  /**
   * 对证据进行 AI 分类
   * - 图片/视频类证据：使用 glm-4.6v-flash（多模态）
   * - 文本/文档类证据：使用 glm-4.1v-thinking-flash（深度法律推理）
   */
  async classifyEvidence(evidence: EvidenceInput): Promise<ClassificationResult> {
    const useMultimodal = isMultimodalEvidence(evidence.mimeType) && !!evidence.fileBase64;
    const model = useMultimodal ? MODELS.evidenceMultimodal : MODELS.evidenceClassify;

    const textPrompt = `你是一位专业的法律证据分析师。请对以下证据进行分析和分类。

证据信息：
- 文件名：${evidence.fileName}
- 文件类型：${evidence.mimeType}
${evidence.description ? `- 描述：${evidence.description}` : ''}
${evidence.caseContext ? `- 案件背景：${evidence.caseContext}` : ''}

请以 JSON 格式返回分析结果，格式如下：
{
  "category": "VALID" | "INVALID" | "NEEDS_SUPPLEMENT",
  "proofPurpose": "该证据的证明目的（一句话）",
  "legalBasis": ["相关法律条文1", "相关法律条文2"],
  "strength": "STRONG" | "MEDIUM" | "WEAK",
  "similarCase": "类似案例参考（一句话）"
}

category 说明：
- VALID：证据有效，可直接使用
- INVALID：证据无效或不可采信
- NEEDS_SUPPLEMENT：证据需要补充或完善

只返回 JSON，不要其他内容。`;

    // 多模态消息（图片证据）
    const messages = useMultimodal
      ? [
          {
            role: 'user' as const,
            content: [
              {
                type: 'image_url' as const,
                image_url: { url: `data:${evidence.mimeType};base64,${evidence.fileBase64}` },
              },
              { type: 'text' as const, text: textPrompt },
            ] as unknown as string,
          },
        ]
      : [{ role: 'user' as const, content: textPrompt }];

    const response = await gateway.chat(messages, {
      provider: 'glm',
      model,
      temperature: 0.1,
      maxTokens: 1000,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found');

      const result = JSON.parse(jsonMatch[0]) as ClassificationResult;

      const validCategories = ['VALID', 'INVALID', 'NEEDS_SUPPLEMENT'] as const;
      if (!validCategories.includes(result.category)) {
        result.category = 'NEEDS_SUPPLEMENT';
      }

      const validStrengths = ['STRONG', 'MEDIUM', 'WEAK'] as const;
      if (!validStrengths.includes(result.strength)) {
        result.strength = 'MEDIUM';
      }

      return result;
    } catch {
      return {
        category: 'NEEDS_SUPPLEMENT',
        proofPurpose: '待人工审核',
        legalBasis: [],
        strength: 'MEDIUM',
        similarCase: '暂无类似案例',
      };
    }
  },

  /**
   * 生成会见前摘要（基于案件时间线和历史会见记录）
   * 使用 glm-4-flash-250414（速度优先，摘要生成无需深度推理）
   */
  async generateVisitSummary(caseId: string, lawyerId: string): Promise<string> {
    const [case_, visitRecords] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        include: {
          timeline: { orderBy: { occurredAt: 'desc' }, take: 10 },
        },
      }),
      prisma.visitRecord.findMany({
        where: { caseId },
        orderBy: { visitedAt: 'desc' },
        take: 3,
      }),
    ]);

    if (!case_) return '案件信息不存在';

    const timelineText = case_.timeline
      .map((e: { occurredAt: Date; description: string }) => `[${e.occurredAt.toLocaleDateString('zh-CN')}] ${e.description}`)
      .join('\n');

    const visitText =
      visitRecords.length > 0
        ? visitRecords
            .map(
              (v: { visitedAt: Date; outcome: string; nextSteps: string }) =>
                `[${v.visitedAt.toLocaleDateString('zh-CN')}] 结果：${v.outcome} | 下一步：${v.nextSteps}`,
            )
            .join('\n')
        : '暂无历史会见记录';

    const prompt = `你是一位律师助理，请为律师生成一份简洁的会见前摘要，帮助律师快速回顾案件进展。

案件信息：
- 案件名称：${case_.title}
- 当事人：${case_.clientName}
- 案件类型：${case_.caseType}
- 当前状态：${case_.status}

近期时间线：
${timelineText || '暂无时间线记录'}

历史会见记录：
${visitText}

请生成一份不超过 500 字的会见前摘要，包含：
1. 案件当前进展
2. 上次会见的主要结论
3. 本次会见需要重点关注的事项

直接输出摘要内容，不要标题和格式符号。`;

    const response = await gateway.chat([{ role: 'user', content: prompt }], {
      provider: 'glm',
      model: MODELS.visitSummary,
      temperature: 0.3,
      maxTokens: 800,
    });

    const summary = response.content.trim();
    return summary.length > 500 ? summary.slice(0, 497) + '...' : summary;
  },
};
