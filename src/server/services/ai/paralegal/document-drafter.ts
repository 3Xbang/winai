/**
 * Document Drafter — AI-powered legal document drafting
 * Uses LLM Gateway to generate legal documents based on document type and jurisdiction.
 * Requirements: 22.1
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export type DocumentType = 'complaint' | 'defense' | 'appeal' | 'lawyer-letter' | 'legal-opinion' | 'due-diligence';
export type Jurisdiction = 'china' | 'thailand';

export interface DocumentDraftRequest {
  documentType: DocumentType;
  jurisdiction: Jurisdiction;
  caseDescription: string;
  parties: {
    plaintiff?: string;
    defendant?: string;
    client?: string;
  };
  language: 'zh' | 'th' | 'en';
  additionalInstructions?: string;
}

// ─── System Prompts ─────────────────────────────────────────

export const DOCUMENT_PROMPTS: Record<DocumentType, string> = {
  complaint: `你是一位资深法律文书起草专家。请根据用户提供的案件信息起草一份起诉状。

格式规范：
- 中国法域：遵循《民事诉讼法》规定的起诉状格式，包含原告信息、被告信息、诉讼请求、事实与理由、证据清单、受诉法院
- 泰国法域：遵循泰国民事诉讼法规定的 Plaint（คำฟ้อง）格式，包含 Court name、Plaintiff/Defendant details、Cause of action、Relief sought

要求：
- 引用具体法律条文
- 诉讼请求明确具体
- 事实陈述客观清晰
- 法律论证逻辑严密`,

  defense: `你是一位资深法律文书起草专家。请根据用户提供的案件信息起草一份答辩状。

格式规范：
- 中国法域：遵循《民事诉讼法》规定的答辩状格式，包含答辩人信息、答辩请求、答辩理由、证据清单
- 泰国法域：遵循泰国民事诉讼法规定的 Answer（คำให้การ）格式

要求：
- 逐条回应原告诉讼请求
- 提出抗辩理由和法律依据
- 指出原告主张的事实和法律错误
- 引用具体法律条文支持答辩观点`,

  appeal: `你是一位资深法律文书起草专家。请根据用户提供的案件信息起草一份上诉状。

格式规范：
- 中国法域：遵循《民事诉讼法》规定的上诉状格式，包含上诉人信息、被上诉人信息、上诉请求、上诉理由、原审判决书编号
- 泰国法域：遵循泰国上诉程序规定的 Appeal（อุทธรณ์）格式

要求：
- 明确指出原审判决的错误
- 提供新的事实或法律依据
- 上诉请求具体明确
- 论证原审判决适用法律错误或认定事实不清`,

  'lawyer-letter': `你是一位资深法律文书起草专家。请根据用户提供的信息起草一份律师函。

格式规范：
- 中国法域：标准律师函格式，包含律师事务所信息、委托人信息、对方当事人信息、法律事实陈述、法律依据、要求事项、法律后果警告
- 泰国法域：标准 Lawyer's Letter 格式，包含 Law firm details、Client information、Legal demands、Consequences of non-compliance

要求：
- 语气专业严肃
- 法律依据充分
- 要求事项明确
- 设定合理的回复期限`,

  'legal-opinion': `你是一位资深法律文书起草专家。请根据用户提供的信息起草一份法律意见书。

格式规范：
- 中国法域：标准法律意见书格式，包含委托事项、事实概述、法律分析、法律意见、风险提示、建议措施
- 泰国法域：标准 Legal Opinion 格式，包含 Scope of opinion、Factual background、Legal analysis、Opinion、Risk assessment、Recommendations

要求：
- 分析全面深入
- 法律引用准确
- 意见明确具体
- 风险提示充分`,

  'due-diligence': `你是一位资深法律文书起草专家。请根据用户提供的信息起草一份尽职调查报告。

格式规范：
- 中国法域：标准尽职调查报告格式，包含调查范围、公司基本情况、股权结构、重大合同、诉讼仲裁、合规情况、风险评估、结论建议
- 泰国法域：标准 Due Diligence Report 格式，包含 Scope、Corporate structure、Material contracts、Litigation、Regulatory compliance、Risk assessment、Conclusions

要求：
- 调查范围明确
- 信息披露完整
- 风险评估客观
- 建议措施可行`,
};

// ─── Draft Document Function ────────────────────────────────

/**
 * Draft a legal document using LLM based on the request parameters.
 */
export async function draftDocument(request: DocumentDraftRequest): Promise<string> {
  const systemPrompt = DOCUMENT_PROMPTS[request.documentType];

  const partiesInfo = Object.entries(request.parties)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const languageInstruction = {
    zh: '请使用中文起草文书。',
    th: 'กรุณาร่างเอกสารเป็นภาษาไทย',
    en: 'Please draft the document in English.',
  }[request.language];

  const userContent = [
    `法域/Jurisdiction: ${request.jurisdiction === 'china' ? '中国' : '泰国/Thailand'}`,
    `当事人信息/Parties:\n${partiesInfo}`,
    `案件描述/Case Description:\n${request.caseDescription}`,
    languageInstruction,
    request.additionalInstructions ? `附加要求/Additional Instructions:\n${request.additionalInstructions}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const gateway = getLLMGateway();
  const response = await gateway.chat(messages, { temperature: 0.3 });
  return response.content;
}
