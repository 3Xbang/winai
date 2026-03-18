import { NextRequest, NextResponse } from 'next/server';
import { getLLMGateway } from '@/server/services/llm';

const SYSTEM_PROMPT = `你是专业的泰国签证顾问，专注于为中国公民提供泰国签证建议。

请根据用户情况推荐最合适的2-3种泰国签证类型，严格按照以下 JSON 格式返回，不要有任何其他文字：
[
  {
    "visaType": "签证类型名称（英文官方名称）",
    "matchScore": 85,
    "requirements": ["要求1", "要求2"],
    "documents": ["文件1", "文件2"],
    "process": [
      {
        "step": 1,
        "description": "步骤描述",
        "estimatedDuration": "预计时间"
      }
    ],
    "estimatedCost": {
      "amount": "金额范围",
      "currency": "THB",
      "breakdown": {
        "费用项目": "金额"
      }
    },
    "commonRejectionReasons": ["原因1", "原因2"],
    "avoidanceAdvice": ["建议1", "建议2"],
    "processingTime": "总处理时间"
  }
]`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nationality, currentVisaType, purpose, duration, occupation, budget } = body;

    if (!nationality?.trim() || !purpose) {
      return NextResponse.json({ error: '国籍和目的不能为空' }, { status: 400 });
    }

    const gateway = getLLMGateway();
    if (!gateway.isAvailable()) {
      return NextResponse.json({ error: 'AI 服务暂不可用' }, { status: 503 });
    }

    const userContent = `
国籍：${nationality}
当前签证类型：${currentVisaType || '无'}
赴泰目的：${purpose}
计划停留时长：${duration || '未指定'}
职业：${occupation || '未指定'}
预算范围：${budget || '未指定'}
    `.trim();

    const response = await gateway.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      { provider: 'glm', temperature: 0.3, maxTokens: 3000 },
    );

    const content = response.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('AI 返回格式异常');

    const results = JSON.parse(jsonMatch[0]);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Visa recommend error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '推荐失败，请重试' },
      { status: 500 },
    );
  }
}
