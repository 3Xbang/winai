import { NextRequest, NextResponse } from 'next/server';
import { getLLMGateway } from '@/server/services/llm';

const SYSTEM_PROMPT = `你是专业的中泰跨境法律案件分析师。请根据用户提供的案件信息进行全面分析。

请严格按照以下 JSON 格式返回，不要有任何其他文字：
{
  "timeline": [
    {
      "date": "YYYY-MM-DD 或描述性日期",
      "event": "事件描述",
      "legalSignificance": "法律意义"
    }
  ],
  "issues": [
    {
      "issue": "争议焦点",
      "legalBasis": [
        {
          "lawName": "法律名称",
          "articleNumber": "条款编号（可选）",
          "description": "条款说明"
        }
      ],
      "analysis": "分析内容"
    }
  ],
  "strategies": {
    "plaintiff": {
      "perspective": "PLAINTIFF",
      "keyArguments": ["论点1", "论点2"],
      "legalBasis": [{"lawName": "法律", "articleNumber": "条款", "description": "说明"}],
      "riskAssessment": "风险评估"
    },
    "defendant": {
      "perspective": "DEFENDANT",
      "keyArguments": ["论点1", "论点2"],
      "legalBasis": [{"lawName": "法律", "articleNumber": "条款", "description": "说明"}],
      "riskAssessment": "风险评估"
    },
    "judge": {
      "perspective": "JUDGE",
      "keyArguments": ["考量1", "考量2"],
      "legalBasis": [{"lawName": "法律", "articleNumber": "条款", "description": "说明"}],
      "riskAssessment": "审判重点",
      "likelyRuling": "可能裁决",
      "keyConsiderations": ["考量1", "考量2"]
    },
    "overall": {
      "recommendation": "综合建议",
      "riskLevel": "HIGH|MEDIUM|LOW",
      "nextSteps": ["步骤1", "步骤2", "步骤3"]
    }
  },
  "strengthScore": {
    "overall": 75,
    "evidenceSufficiency": 70,
    "legalBasisStrength": 80,
    "similarCaseTrends": 65,
    "proceduralCompliance": 75
  }
}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { caseType, jurisdiction, description, partyName1, partyRole1, partyName2, partyRole2, keyFacts, keyDates, context } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: '案件描述不能为空' }, { status: 400 });
    }

    const gateway = getLLMGateway();
    if (!gateway.isAvailable()) {
      return NextResponse.json({ error: 'AI 服务暂不可用' }, { status: 503 });
    }

    const userContent = `
案件类型：${caseType || '未指定'}
管辖范围：${jurisdiction || '未指定'}
当事人1：${partyName1 || '未知'} (${partyRole1 || '未知'})
当事人2：${partyName2 || '未知'} (${partyRole2 || '未知'})
案件描述：${description}
关键事实：${keyFacts || '无'}
关键日期：${keyDates || '无'}
补充背景：${context || '无'}
    `.trim();

    const response = await gateway.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      { provider: 'glm', temperature: 0.3, maxTokens: 4096 },
    );

    let content = response.content.trim();
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
      throw new Error('AI 返回格式异常');
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Case analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '分析失败，请重试' },
      { status: 500 },
    );
  }
}
