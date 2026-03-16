import { NextRequest, NextResponse } from 'next/server';
import { getContractAnalyzer } from '@/server/services/legal/contract';
import { getLLMGateway } from '@/server/services/llm';
import type { ContractDraftRequest } from '@/server/services/legal/contract';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      contractType,
      partyAName,
      partyARole,
      partyANationality,
      partyAAddress,
      partyBName,
      partyBRole,
      partyBNationality,
      partyBAddress,
      governingLaw,
      disputeResolution,
      languages,
      specialClauses,
    } = body;

    if (!contractType || !partyAName || !partyBName) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 });
    }

    const gateway = getLLMGateway();
    if (!gateway.isAvailable()) {
      return NextResponse.json(
        { error: 'AI 服务暂不可用，请检查 GLM_API_KEY 配置' },
        { status: 503 },
      );
    }

    // Determine jurisdiction from governing law input
    const isChina = governingLaw?.includes('中国') || governingLaw?.includes('China');
    const isThailand = governingLaw?.includes('泰国') || governingLaw?.includes('Thai');
    const jurisdiction = isChina && isThailand ? 'DUAL' : isThailand ? 'THAILAND' : 'CHINA';

    const draftRequest: ContractDraftRequest = {
      contractType: contractType as ContractDraftRequest['contractType'],
      parties: [
        {
          name: partyAName,
          role: partyARole || '甲方',
          nationality: partyANationality,
          address: partyAAddress,
        },
        {
          name: partyBName,
          role: partyBRole || '乙方',
          nationality: partyBNationality,
          address: partyBAddress,
        },
      ],
      keyTerms: {
        governingLaw: governingLaw || '中华人民共和国法律',
        disputeResolution: disputeResolution || '协商解决，协商不成提交仲裁',
        ...(specialClauses ? { specialClauses } : {}),
      },
      languages: languages || ['zh'],
      jurisdiction: {
        jurisdiction,
        confidence: 0.9,
        applicableLaws: [],
        reasoning: '',
      },
    };

    const analyzer = getContractAnalyzer();
    const content = await analyzer.draft(draftRequest);

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Contract draft API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '合同生成失败' },
      { status: 500 },
    );
  }
}
