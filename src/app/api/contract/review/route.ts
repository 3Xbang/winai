import { NextRequest, NextResponse } from 'next/server';
import { getLLMGateway } from '@/server/services/llm';

const REVIEW_PROMPT_BASE = `你是专业的中泰跨境合同法律顾问。你的任务是站在【委托人】的角度，对合同进行逐条风险分析，重点识别对委托人不利的条款，并提出有利于委托人的修改建议。

分析要求：
1. 识别合同中对委托人不利的风险条款
2. 对每个风险条款给出风险等级（HIGH/MEDIUM/LOW）
3. 引用具体法律依据（中国法律或泰国法律）
4. suggestedRevision 字段必须包含两部分：
   - 第一部分：说明为什么要修改（对委托人的风险）
   - 第二部分：给出具体的修改后条款文字，格式为"建议修改为：「...具体条款文字...」"
5. 整体评估报告须说明合同对委托人的总体利弊

重要：只返回 JSON，不要有任何其他文字、解释或 markdown 代码块。

返回格式：
{
  "overallRiskLevel": "HIGH|MEDIUM|LOW",
  "reviewReport": "整体评估报告（说明合同对委托人的总体利弊）",
  "risks": [
    {
      "clauseIndex": 1,
      "clauseText": "原文条款内容",
      "riskLevel": "HIGH|MEDIUM|LOW",
      "riskDescription": "该条款对委托人的风险描述",
      "legalBasis": [
        {
          "lawName": "法律名称",
          "articleNumber": "条款编号",
          "description": "条款说明"
        }
      ],
      "suggestedRevision": "风险说明。建议修改为：「具体的修改后条款文字」"
    }
  ]
}`;

function buildReviewPrompt(clientRole: string, clientName: string): string {
  const roleLabel = clientRole === 'PARTY_A' ? '甲方' : clientRole === 'PARTY_B' ? '乙方' : '其他方';
  const nameStr = clientName?.trim() ? `（${clientName.trim()}）` : '';
  return `${REVIEW_PROMPT_BASE}\n\n【委托人身份】：合同中的${roleLabel}${nameStr}。请站在${roleLabel}${nameStr}的立场审查合同，重点保护${roleLabel}的权益。`;
}

export async function POST(req: NextRequest) {
  try {
    const { contractText, clientRole = 'PARTY_A', clientName = '' } = await req.json();

    if (!contractText?.trim()) {
      return NextResponse.json({ error: '合同内容不能为空' }, { status: 400 });
    }

    const gateway = getLLMGateway();
    if (!gateway.isAvailable()) {
      return NextResponse.json({ error: 'AI 服务暂不可用' }, { status: 503 });
    }

    const systemPrompt = buildReviewPrompt(clientRole, clientName);

    const response = await gateway.chat(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请审查以下合同：\n\n${contractText}` },
      ],
      { provider: 'glm', temperature: 0.3, maxTokens: 4096 },
    );

    // Parse JSON from AI response (handle markdown code blocks)
    let content = response.content.trim();
    // Strip markdown code fences if present
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('AI raw response:', content.slice(0, 500));
      throw new Error('AI 返回格式异常');
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      console.error('JSON parse failed:', jsonMatch[0].slice(0, 500));
      throw new Error('AI 返回格式异常');
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Contract review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '审查失败，请重试' },
      { status: 500 },
    );
  }
}
