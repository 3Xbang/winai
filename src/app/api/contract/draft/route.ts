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

    // Map governing law key to readable text and jurisdiction
    const governingLawMap: Record<string, { text: string; jurisdiction: 'CHINA' | 'THAILAND' | 'DUAL' }> = {
      CN_LAW: { text: '中华人民共和国法律', jurisdiction: 'CHINA' },
      TH_LAW: { text: '泰王国法律', jurisdiction: 'THAILAND' },
      DUAL_LAW: { text: '中国法律与泰国法律（双重适用）', jurisdiction: 'DUAL' },
    };

    const disputeResolutionMap: Record<string, string> = {
      NEGOTIATION: '友好协商解决',
      CIETAC_ARBITRATION: '提交中国国际经济贸易仲裁委员会仲裁',
      TAI_ARBITRATION: '提交泰国仲裁院仲裁',
      CN_COURT: '向中国有管辖权的人民法院提起诉讼',
      TH_COURT: '向泰国有管辖权的法院提起诉讼',
    };

    const lawInfo = governingLawMap[governingLaw] || { text: governingLaw || '中华人民共和国法律', jurisdiction: 'CHINA' as const };
    const resolvedDisputeResolution = disputeResolutionMap[disputeResolution] || disputeResolution || '协商解决，协商不成提交仲裁';
    const jurisdiction = lawInfo.jurisdiction;

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
        governingLaw: lawInfo.text,
        disputeResolution: resolvedDisputeResolution,
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
