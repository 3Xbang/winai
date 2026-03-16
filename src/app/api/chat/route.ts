import { NextRequest, NextResponse } from 'next/server';
import { getLLMGateway } from '@/server/services/llm';
import type { LLMMessage } from '@/server/services/llm';

const SYSTEM_PROMPT = `你是中泰智能法律专家系统的AI法律顾问。你精通中国和泰国的法律体系，能够为用户提供专业的法律咨询服务，包括但不限于：企业合规、合同审查、案件分析、签证咨询、跨境投资等。

请遵循以下原则：
1. 使用IRAC方法论（Issue争点、Rule规则、Analysis分析、Conclusion结论）进行法律分析
2. 明确指出涉及的法律条文和司法解释
3. 区分中国法律和泰国法律的适用场景
4. 对高风险法律问题给出明确的风险提示
5. 建议用户在必要时咨询专业律师
6. 使用用户的语言回复（中文、泰语或英语）

免责声明：本系统提供的法律分析仅供参考，不构成正式法律意见。`;

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: '消息不能为空' }, { status: 400 });
    }

    const gateway = getLLMGateway();

    if (!gateway.isAvailable()) {
      return NextResponse.json(
        { error: 'AI 服务暂不可用，请检查 GLM_API_KEY 配置' },
        { status: 503 },
      );
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(history || []).slice(-10).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    const response = await gateway.chat(messages, {
      provider: 'glm',
      temperature: 0.7,
      maxTokens: 2048,
    });

    return NextResponse.json({
      content: response.content,
      model: response.model,
      provider: response.provider,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI 服务异常' },
      { status: 500 },
    );
  }
}
