import { NextRequest, NextResponse } from 'next/server';
import { getLLMGateway } from '@/server/services/llm';

const REVIEW_PROMPT = `你是专业的中泰跨境合同法律顾问。请对以下合同文本进行逐条风险分析。

分析要求：
1. 识别合同中的风险条款
2. 对每个风险条款给出风险等级（HIGH/MEDIUM/LOW）
3. 引用具体法律依据
4. 提供修改建议

请严格按照以下 JSON 格式返回，不要有任何其他文字：
{
  "overallRiskLevel": "HIGH|MEDIUM|LOW",
  "reviewReport": "整体评估报告",
  "risks": [
    {
      "clauseIndex": 1,
      "clauseText": "原文条款内容",
      "riskLevel": "HIGH|MEDIUM|LOW",
      "riskDescription": "风险描述",
      "legalBasis": [
        {
          "lawName": "法律名称",
          "articleNumber": "条款编号",
          "description": "条款说明"
        }
      ],
      "suggestedRevision": "修改建议"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  try {
    const { contractText } = await req.json();

    if (!contractText?.trim()) {
      return NextResponse.json({ error: '合同内容不能为空' }, { status: 400 });
    }

    const gateway = getLLMGateway();
    if (!gateway.isAvailable()) {
      return NextResponse.json({ error: 'AI 服务暂不可用' }, { status: 503 });
    }

    const response = await gateway.chat(
      [
        { role: 'system', content: REVIEW_PROMPT },
        { role: 'user', content: `请审查以下合同：\n\n${contractText}` },
      ],
      { provider: 'glm', temperature: 0.3, maxTokens: 4096 },
    );

    // Parse JSON from AI response
    const content = response.content.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI 返回格式异常');
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Contract review error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '审查失败，请重试' },
      { status: 500 },
    );
  }
}
