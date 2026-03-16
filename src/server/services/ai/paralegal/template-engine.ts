/**
 * Template Engine — Smart legal document template system
 * Provides template management, AI-powered variable extraction, and template filling.
 * Requirements: 22.2
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { DocumentType, Jurisdiction } from './document-drafter';

// ─── Types ──────────────────────────────────────────────────

export interface TemplateVariable {
  name: string;
  description: string;
  required: boolean;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  documentType: DocumentType;
  jurisdiction: Jurisdiction;
  content: string; // template with {{variable}} placeholders
  variables: TemplateVariable[];
}

// ─── Template Seed Data ─────────────────────────────────────

export const TEMPLATES: DocumentTemplate[] = [
  {
    id: 'complaint-china',
    name: '中国民事起诉状模板',
    documentType: 'complaint',
    jurisdiction: 'china',
    content: `民事起诉状

原告：{{plaintiffName}}，{{plaintiffIdType}}：{{plaintiffId}}，住所地：{{plaintiffAddress}}
被告：{{defendantName}}，{{defendantIdType}}：{{defendantId}}，住所地：{{defendantAddress}}

诉讼请求：
{{claims}}

事实与理由：
{{factsAndReasons}}

证据清单：
{{evidenceList}}

此致
{{courtName}}

原告：{{plaintiffName}}
日期：{{filingDate}}`,
    variables: [
      { name: 'plaintiffName', description: '原告姓名/名称', required: true },
      { name: 'plaintiffIdType', description: '原告证件类型', required: true },
      { name: 'plaintiffId', description: '原告证件号码', required: true },
      { name: 'plaintiffAddress', description: '原告住所地', required: true },
      { name: 'defendantName', description: '被告姓名/名称', required: true },
      { name: 'defendantIdType', description: '被告证件类型', required: true },
      { name: 'defendantId', description: '被告证件号码', required: true },
      { name: 'defendantAddress', description: '被告住所地', required: true },
      { name: 'claims', description: '诉讼请求', required: true },
      { name: 'factsAndReasons', description: '事实与理由', required: true },
      { name: 'evidenceList', description: '证据清单', required: false },
      { name: 'courtName', description: '受诉法院名称', required: true },
      { name: 'filingDate', description: '起诉日期', required: false },
    ],
  },
  {
    id: 'complaint-thailand',
    name: 'Thailand Civil Plaint Template',
    documentType: 'complaint',
    jurisdiction: 'thailand',
    content: `PLAINT (คำฟ้อง)

Court: {{courtName}}
Case No.: {{caseNumber}}

Plaintiff: {{plaintiffName}}, ID: {{plaintiffId}}, Address: {{plaintiffAddress}}
Defendant: {{defendantName}}, ID: {{defendantId}}, Address: {{defendantAddress}}

CAUSE OF ACTION:
{{causeOfAction}}

RELIEF SOUGHT:
{{reliefSought}}

EVIDENCE:
{{evidenceList}}

Filed on: {{filingDate}}
Plaintiff: {{plaintiffName}}`,
    variables: [
      { name: 'courtName', description: 'Name of the court', required: true },
      { name: 'caseNumber', description: 'Case number', required: false },
      { name: 'plaintiffName', description: 'Plaintiff name', required: true },
      { name: 'plaintiffId', description: 'Plaintiff ID number', required: true },
      { name: 'plaintiffAddress', description: 'Plaintiff address', required: true },
      { name: 'defendantName', description: 'Defendant name', required: true },
      { name: 'defendantId', description: 'Defendant ID number', required: true },
      { name: 'defendantAddress', description: 'Defendant address', required: true },
      { name: 'causeOfAction', description: 'Cause of action', required: true },
      { name: 'reliefSought', description: 'Relief sought', required: true },
      { name: 'evidenceList', description: 'List of evidence', required: false },
      { name: 'filingDate', description: 'Filing date', required: false },
    ],
  },
  {
    id: 'defense-china',
    name: '中国民事答辩状模板',
    documentType: 'defense',
    jurisdiction: 'china',
    content: `民事答辩状

答辩人：{{defendantName}}，{{defendantIdType}}：{{defendantId}}
原告：{{plaintiffName}}

针对原告{{plaintiffName}}诉答辩人{{defendantName}}一案，答辩人提出如下答辩意见：

答辩请求：
{{defenseRequests}}

答辩理由：
{{defenseReasons}}

证据清单：
{{evidenceList}}

此致
{{courtName}}

答辩人：{{defendantName}}
日期：{{filingDate}}`,
    variables: [
      { name: 'defendantName', description: '答辩人姓名/名称', required: true },
      { name: 'defendantIdType', description: '答辩人证件类型', required: true },
      { name: 'defendantId', description: '答辩人证件号码', required: true },
      { name: 'plaintiffName', description: '原告姓名/名称', required: true },
      { name: 'defenseRequests', description: '答辩请求', required: true },
      { name: 'defenseReasons', description: '答辩理由', required: true },
      { name: 'evidenceList', description: '证据清单', required: false },
      { name: 'courtName', description: '法院名称', required: true },
      { name: 'filingDate', description: '答辩日期', required: false },
    ],
  },
  {
    id: 'defense-thailand',
    name: 'Thailand Answer Template',
    documentType: 'defense',
    jurisdiction: 'thailand',
    content: `ANSWER (คำให้การ)

Court: {{courtName}}
Case No.: {{caseNumber}}

Defendant: {{defendantName}}, Address: {{defendantAddress}}
Plaintiff: {{plaintiffName}}

DEFENSE:
{{defenseStatement}}

COUNTERCLAIM (if any):
{{counterclaim}}

EVIDENCE:
{{evidenceList}}

Filed on: {{filingDate}}
Defendant: {{defendantName}}`,
    variables: [
      { name: 'courtName', description: 'Name of the court', required: true },
      { name: 'caseNumber', description: 'Case number', required: true },
      { name: 'defendantName', description: 'Defendant name', required: true },
      { name: 'defendantAddress', description: 'Defendant address', required: true },
      { name: 'plaintiffName', description: 'Plaintiff name', required: true },
      { name: 'defenseStatement', description: 'Defense statement', required: true },
      { name: 'counterclaim', description: 'Counterclaim details', required: false },
      { name: 'evidenceList', description: 'List of evidence', required: false },
      { name: 'filingDate', description: 'Filing date', required: false },
    ],
  },
  {
    id: 'appeal-china',
    name: '中国上诉状模板',
    documentType: 'appeal',
    jurisdiction: 'china',
    content: `民事上诉状

上诉人：{{appellantName}}，住所地：{{appellantAddress}}
被上诉人：{{appelleeName}}，住所地：{{appelleeAddress}}

原审法院：{{originalCourt}}
原审案号：{{originalCaseNumber}}

上诉请求：
{{appealRequests}}

上诉理由：
{{appealReasons}}

此致
{{appealCourt}}

上诉人：{{appellantName}}
日期：{{filingDate}}`,
    variables: [
      { name: 'appellantName', description: '上诉人姓名/名称', required: true },
      { name: 'appellantAddress', description: '上诉人住所地', required: true },
      { name: 'appelleeName', description: '被上诉人姓名/名称', required: true },
      { name: 'appelleeAddress', description: '被上诉人住所地', required: true },
      { name: 'originalCourt', description: '原审法院', required: true },
      { name: 'originalCaseNumber', description: '原审案号', required: true },
      { name: 'appealRequests', description: '上诉请求', required: true },
      { name: 'appealReasons', description: '上诉理由', required: true },
      { name: 'appealCourt', description: '上诉法院', required: true },
      { name: 'filingDate', description: '上诉日期', required: false },
    ],
  },
  {
    id: 'appeal-thailand',
    name: 'Thailand Appeal Template',
    documentType: 'appeal',
    jurisdiction: 'thailand',
    content: `APPEAL (อุทธรณ์)

Appeal Court: {{appealCourt}}
Original Court: {{originalCourt}}
Original Case No.: {{originalCaseNumber}}

Appellant: {{appellantName}}, Address: {{appellantAddress}}
Appellee: {{appelleeName}}, Address: {{appelleeAddress}}

GROUNDS OF APPEAL:
{{appealGrounds}}

RELIEF SOUGHT:
{{reliefSought}}

Filed on: {{filingDate}}
Appellant: {{appellantName}}`,
    variables: [
      { name: 'appealCourt', description: 'Appeal court name', required: true },
      { name: 'originalCourt', description: 'Original court name', required: true },
      { name: 'originalCaseNumber', description: 'Original case number', required: true },
      { name: 'appellantName', description: 'Appellant name', required: true },
      { name: 'appellantAddress', description: 'Appellant address', required: true },
      { name: 'appelleeName', description: 'Appellee name', required: true },
      { name: 'appelleeAddress', description: 'Appellee address', required: true },
      { name: 'appealGrounds', description: 'Grounds of appeal', required: true },
      { name: 'reliefSought', description: 'Relief sought on appeal', required: true },
      { name: 'filingDate', description: 'Filing date', required: false },
    ],
  },
  {
    id: 'lawyer-letter-china',
    name: '中国律师函模板',
    documentType: 'lawyer-letter',
    jurisdiction: 'china',
    content: `律师函

致：{{recipientName}}
地址：{{recipientAddress}}

受{{clientName}}委托，{{lawFirmName}}就以下事宜致函贵方：

事实陈述：
{{factStatement}}

法律依据：
{{legalBasis}}

要求事项：
{{demands}}

请贵方在收到本函之日起{{responseDeadline}}内书面回复。逾期未回复，我方将依法采取进一步法律措施。

{{lawFirmName}}
律师：{{lawyerName}}
日期：{{letterDate}}`,
    variables: [
      { name: 'recipientName', description: '收函人姓名/名称', required: true },
      { name: 'recipientAddress', description: '收函人地址', required: true },
      { name: 'clientName', description: '委托人姓名/名称', required: true },
      { name: 'lawFirmName', description: '律师事务所名称', required: true },
      { name: 'factStatement', description: '事实陈述', required: true },
      { name: 'legalBasis', description: '法律依据', required: true },
      { name: 'demands', description: '要求事项', required: true },
      { name: 'responseDeadline', description: '回复期限', required: true },
      { name: 'lawyerName', description: '律师姓名', required: true },
      { name: 'letterDate', description: '函件日期', required: false },
    ],
  },
  {
    id: 'lawyer-letter-thailand',
    name: 'Thailand Lawyer Letter Template',
    documentType: 'lawyer-letter',
    jurisdiction: 'thailand',
    content: `LAWYER'S LETTER

To: {{recipientName}}
Address: {{recipientAddress}}

On behalf of our client, {{clientName}}, {{lawFirmName}} hereby notifies you of the following:

FACTS:
{{factStatement}}

LEGAL BASIS:
{{legalBasis}}

DEMANDS:
{{demands}}

Please respond within {{responseDeadline}} days from receipt of this letter. Failure to respond may result in further legal action.

{{lawFirmName}}
Attorney: {{lawyerName}}
Date: {{letterDate}}`,
    variables: [
      { name: 'recipientName', description: 'Recipient name', required: true },
      { name: 'recipientAddress', description: 'Recipient address', required: true },
      { name: 'clientName', description: 'Client name', required: true },
      { name: 'lawFirmName', description: 'Law firm name', required: true },
      { name: 'factStatement', description: 'Statement of facts', required: true },
      { name: 'legalBasis', description: 'Legal basis', required: true },
      { name: 'demands', description: 'Demands', required: true },
      { name: 'responseDeadline', description: 'Response deadline in days', required: true },
      { name: 'lawyerName', description: 'Attorney name', required: true },
      { name: 'letterDate', description: 'Letter date', required: false },
    ],
  },
  {
    id: 'legal-opinion-china',
    name: '中国法律意见书模板',
    documentType: 'legal-opinion',
    jurisdiction: 'china',
    content: `法律意见书

委托人：{{clientName}}
委托事项：{{subject}}

一、事实概述
{{factSummary}}

二、法律分析
{{legalAnalysis}}

三、法律意见
{{legalOpinion}}

四、风险提示
{{riskWarnings}}

五、建议措施
{{recommendations}}

{{lawFirmName}}
律师：{{lawyerName}}
日期：{{opinionDate}}`,
    variables: [
      { name: 'clientName', description: '委托人姓名/名称', required: true },
      { name: 'subject', description: '委托事项', required: true },
      { name: 'factSummary', description: '事实概述', required: true },
      { name: 'legalAnalysis', description: '法律分析', required: true },
      { name: 'legalOpinion', description: '法律意见', required: true },
      { name: 'riskWarnings', description: '风险提示', required: true },
      { name: 'recommendations', description: '建议措施', required: true },
      { name: 'lawFirmName', description: '律师事务所名称', required: true },
      { name: 'lawyerName', description: '律师姓名', required: true },
      { name: 'opinionDate', description: '意见书日期', required: false },
    ],
  },
  {
    id: 'legal-opinion-thailand',
    name: 'Thailand Legal Opinion Template',
    documentType: 'legal-opinion',
    jurisdiction: 'thailand',
    content: `LEGAL OPINION

Client: {{clientName}}
Subject: {{subject}}

1. FACTUAL BACKGROUND
{{factSummary}}

2. LEGAL ANALYSIS
{{legalAnalysis}}

3. OPINION
{{legalOpinion}}

4. RISK ASSESSMENT
{{riskWarnings}}

5. RECOMMENDATIONS
{{recommendations}}

{{lawFirmName}}
Attorney: {{lawyerName}}
Date: {{opinionDate}}`,
    variables: [
      { name: 'clientName', description: 'Client name', required: true },
      { name: 'subject', description: 'Subject matter', required: true },
      { name: 'factSummary', description: 'Factual background', required: true },
      { name: 'legalAnalysis', description: 'Legal analysis', required: true },
      { name: 'legalOpinion', description: 'Legal opinion', required: true },
      { name: 'riskWarnings', description: 'Risk assessment', required: true },
      { name: 'recommendations', description: 'Recommendations', required: true },
      { name: 'lawFirmName', description: 'Law firm name', required: true },
      { name: 'lawyerName', description: 'Attorney name', required: true },
      { name: 'opinionDate', description: 'Opinion date', required: false },
    ],
  },
  {
    id: 'due-diligence-china',
    name: '中国尽职调查报告模板',
    documentType: 'due-diligence',
    jurisdiction: 'china',
    content: `尽职调查报告

目标公司：{{targetCompany}}
委托方：{{clientName}}
调查范围：{{scope}}

一、公司基本情况
{{companyOverview}}

二、股权结构
{{shareholdingStructure}}

三、重大合同
{{materialContracts}}

四、诉讼与仲裁
{{litigation}}

五、合规情况
{{compliance}}

六、风险评估
{{riskAssessment}}

七、结论与建议
{{conclusions}}

{{lawFirmName}}
日期：{{reportDate}}`,
    variables: [
      { name: 'targetCompany', description: '目标公司名称', required: true },
      { name: 'clientName', description: '委托方名称', required: true },
      { name: 'scope', description: '调查范围', required: true },
      { name: 'companyOverview', description: '公司基本情况', required: true },
      { name: 'shareholdingStructure', description: '股权结构', required: true },
      { name: 'materialContracts', description: '重大合同', required: true },
      { name: 'litigation', description: '诉讼与仲裁', required: true },
      { name: 'compliance', description: '合规情况', required: true },
      { name: 'riskAssessment', description: '风险评估', required: true },
      { name: 'conclusions', description: '结论与建议', required: true },
      { name: 'lawFirmName', description: '律师事务所名称', required: true },
      { name: 'reportDate', description: '报告日期', required: false },
    ],
  },
  {
    id: 'due-diligence-thailand',
    name: 'Thailand Due Diligence Report Template',
    documentType: 'due-diligence',
    jurisdiction: 'thailand',
    content: `DUE DILIGENCE REPORT

Target Company: {{targetCompany}}
Client: {{clientName}}
Scope: {{scope}}

1. CORPORATE OVERVIEW
{{companyOverview}}

2. SHAREHOLDING STRUCTURE
{{shareholdingStructure}}

3. MATERIAL CONTRACTS
{{materialContracts}}

4. LITIGATION AND DISPUTES
{{litigation}}

5. REGULATORY COMPLIANCE
{{compliance}}

6. RISK ASSESSMENT
{{riskAssessment}}

7. CONCLUSIONS AND RECOMMENDATIONS
{{conclusions}}

{{lawFirmName}}
Date: {{reportDate}}`,
    variables: [
      { name: 'targetCompany', description: 'Target company name', required: true },
      { name: 'clientName', description: 'Client name', required: true },
      { name: 'scope', description: 'Scope of investigation', required: true },
      { name: 'companyOverview', description: 'Corporate overview', required: true },
      { name: 'shareholdingStructure', description: 'Shareholding structure', required: true },
      { name: 'materialContracts', description: 'Material contracts', required: true },
      { name: 'litigation', description: 'Litigation and disputes', required: true },
      { name: 'compliance', description: 'Regulatory compliance', required: true },
      { name: 'riskAssessment', description: 'Risk assessment', required: true },
      { name: 'conclusions', description: 'Conclusions and recommendations', required: true },
      { name: 'lawFirmName', description: 'Law firm name', required: true },
      { name: 'reportDate', description: 'Report date', required: false },
    ],
  },
];

// ─── Template Functions ─────────────────────────────────────

/** Returns all available templates. */
export function getTemplates(): DocumentTemplate[] {
  return TEMPLATES;
}

/** Returns a specific template by ID. */
export function getTemplate(templateId: string): DocumentTemplate | undefined {
  return TEMPLATES.find((t) => t.id === templateId);
}

/**
 * Pure function: replaces {{var}} placeholders with provided values.
 * Leaves unreplaced placeholders if the variable is not provided.
 */
export function replaceVariables(templateContent: string, variables: Record<string, string>): string {
  let result = templateContent;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Uses LLM to extract variable values from user input text.
 * Returns a Record mapping variable names to extracted values.
 */
export async function extractVariables(
  template: DocumentTemplate,
  userInput: string,
): Promise<Record<string, string>> {
  const variableDescriptions = template.variables
    .map((v) => `- "${v.name}": ${v.description} (${v.required ? '必填/required' : '选填/optional'})`)
    .join('\n');

  const systemPrompt = `你是一个法律文书变量提取助手。请从用户输入中提取以下变量的值，以 JSON 格式输出。
如果某个变量在用户输入中找不到对应信息，请省略该字段。

需要提取的变量：
${variableDescriptions}

请严格以 JSON 对象格式输出，键为变量名，值为提取的文本。不要输出任何其他内容。`;

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userInput },
  ];

  const gateway = getLLMGateway();
  const response = await gateway.chat(messages, {
    temperature: 0.1,
    responseFormat: 'json_object',
  });

  return gateway.parseJSON<Record<string, string>>(response);
}

/**
 * Orchestrates template filling: get template → extract variables via LLM → replace placeholders.
 * Throws an error if any required variable is missing after extraction.
 */
export async function fillTemplate(templateId: string, userInput: string): Promise<string> {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const variables = await extractVariables(template, userInput);

  // Check required variables
  const missingRequired = template.variables
    .filter((v) => v.required && (!variables[v.name] || (variables[v.name] ?? '').trim() === ''))
    .map((v) => v.name);

  if (missingRequired.length > 0) {
    throw new Error(`Missing required variables: ${missingRequired.join(', ')}`);
  }

  return replaceVariables(template.content, variables);
}
