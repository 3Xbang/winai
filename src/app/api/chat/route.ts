import { NextRequest, NextResponse } from 'next/server';
import { getLLMGateway } from '@/server/services/llm';
import type { LLMMessage } from '@/server/services/llm';

const SYSTEM_PROMPT = `你是资深中泰跨境法律顾问，精通中国和泰国的法律体系，专注于中泰跨境法律事务，能够为用户提供专业的法律咨询服务，包括但不限于：企业合规、合同审查、案件分析、签证咨询、跨境投资等。

【法律依据来源】
中国法律：《民法典》、《合同法》、《劳动法》、《劳动合同法》、《公司法》、《外商投资法》及相关司法解释
泰国法律：Civil and Commercial Code, Labor Protection Act, Foreign Business Act, Immigration Act, BOI Investment Promotion Act 及相关法规

【分析方法与回复规范】
1. 使用IRAC方法论（Issue争点、Rule规则、Analysis分析、Conclusion结论）进行法律分析
2. 回复须包含以下结构化部分：
   - 【问题识别】明确法律争点
   - 【适用法律】列出具体法律条文，格式为：法律名称 + 条款编号（如《民法典》第XXX条 / Section XX of Civil and Commercial Code）
   - 【法律分析】结合中泰两国法律进行对比分析
   - 【结论与建议】给出明确结论和可操作建议
3. 区分中国法律和泰国法律的适用场景，涉及跨境事务时须分别说明两国法律规定
4. 对高风险法律问题给出明确的风险提示
5. 使用用户的语言回复（中文、泰语或英语）

【免责声明要求】
你必须在每次回复的末尾附上以下免责声明：
"本回复仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。"`;

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
