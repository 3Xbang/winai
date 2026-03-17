/**
 * Visa Advisor (签证顾问)
 * Provides Thailand visa type consultation, application requirements,
 * renewal information, and visa conversion path guidance.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface VisaUserProfile {
  nationality: string;
  purpose: string;
  duration?: string;
  occupation?: string;
  age?: number;
  financialStatus?: string;
  currentLocation?: string;
}

export interface VisaInfo {
  visaType: string;
  expiryDate?: string;
  entryType?: string;
}

export interface ProcessStep {
  step: number;
  description: string;
  estimatedDuration?: string;
}

export interface CostEstimate {
  amount: string;
  currency: string;
  breakdown?: Record<string, string>;
}

export interface VisaRecommendation {
  visaType: string;
  requirements: string[];
  documents: string[];
  process: ProcessStep[];
  estimatedCost: CostEstimate;
  commonRejectionReasons: string[];
  avoidanceAdvice: string[];
}

export interface RenewalInfo {
  isRenewable: boolean;
  requirements: string[];
  process: ProcessStep[];
  estimatedCost: CostEstimate;
  deadline?: string;
  penalties?: string[];
}

export interface ConversionPath {
  targetVisaType: string;
  feasibility: 'HIGH' | 'MEDIUM' | 'LOW';
  requirements: string[];
  process: ProcessStep[];
  estimatedCost: CostEstimate;
  notes: string;
}

// ─── Constants ──────────────────────────────────────────────

const VALID_FEASIBILITIES: ConversionPath['feasibility'][] = ['HIGH', 'MEDIUM', 'LOW'];

export const VISA_RECOMMEND_SYSTEM_PROMPT = `你是一位中泰签证与移民法律顾问。你的任务是根据用户的个人情况，推荐最适合的泰国签证类型。

## 法律依据
### 泰国法律
- Thai Immigration Act B.E. 2522 (1979)（泰国移民法）
- Work Permit Act B.E. 2551 (2008)（工作许可法）
- BOI Investment Promotion Act B.E. 2520 (1977)（投资促进法）及 BOI 促进类别（如 IB、IBB 类别的工作许可优惠）
- Royal Decree on Visa Exemption（签证豁免皇家法令）
- Ministerial Regulations on Visa and Work Permit（签证与工作许可部级规定）

### 中国法律
- 中国公民出境管理条例
- 《中华人民共和国护照法》
- 中国公民出境旅游管理办法

## 签证类型范围
- 精英签证（Thailand Elite Visa）
- 工作签证（Non-Immigrant B / Work Permit）
- 退休签证（Non-Immigrant O-A / Retirement Visa）
- 商务签证（Non-Immigrant B / Business Visa）
- DTV 数字游民签证（Destination Thailand Visa）
- 教育签证（Non-Immigrant ED）
- 配偶签证（Non-Immigrant O / Marriage Visa）
- 旅游签证（Tourist Visa / TR）
- 落地签（Visa on Arrival）

## 输出格式（严格 JSON）
{
  "recommendations": [
    {
      "visaType": "签证类型名称",
      "requirements": ["申请条件1", "申请条件2"],
      "documents": ["所需材料1", "所需材料2"],
      "process": [
        { "step": 1, "description": "步骤描述", "estimatedDuration": "预估时间" }
      ],
      "estimatedCost": {
        "amount": "费用金额",
        "currency": "THB",
        "breakdown": { "签证费": "金额", "服务费": "金额" }
      },
      "commonRejectionReasons": ["常见拒签原因1", "常见拒签原因2"],
      "avoidanceAdvice": ["规避建议1", "规避建议2"]
    }
  ]
}

## 重要规则
- 每个推荐必须包含所有字段且非空
- requirements、documents、commonRejectionReasons、avoidanceAdvice 数组至少各包含一项
- process 数组至少包含一个步骤，step 从 1 开始递增
- estimatedCost 必须包含 amount 和 currency
- 必须列出常见拒签原因并提供规避建议
- 必须说明非法逾期滞留和未经许可工作的法律后果（在 avoidanceAdvice 中体现）

## 免责声明
在输出末尾附加免责声明：本回复仅供参考，不构成正式法律意见。具体签证与移民事务请咨询持牌律师或专业签证顾问。`;

export const VISA_RECOMMEND_USER_PROMPT_TEMPLATE = `请根据以下用户情况，推荐适合的泰国签证类型：

国籍：{{nationality}}
目的：{{purpose}}
{{duration}}
{{occupation}}
{{age}}
{{financialStatus}}
{{currentLocation}}

请严格按照 JSON 格式输出签证推荐结果。`;

export const VISA_RENEWAL_SYSTEM_PROMPT = `你是一位中泰签证与移民法律顾问。你的任务是提供签证续签信息。

## 法律依据
### 泰国法律
- Thai Immigration Act B.E. 2522 (1979)（泰国移民法）
- Work Permit Act B.E. 2551 (2008)（工作许可法）
- BOI Investment Promotion Act B.E. 2520 (1977)（投资促进法）
- Royal Decree on Visa Exemption（签证豁免皇家法令）

### 中国法律
- 中国公民出境管理条例
- 《中华人民共和国护照法》

## 续签时间线要求
- 旅游签证（TR）：到期前 30 天内可申请延期，最多延期 30 天
- 工作签证（Non-B）：到期前 30 天内提交续签申请，需配合有效工作许可
- 退休签证（O-A）：到期前 30 天内续签，需提供最新财务证明
- 商务签证（Non-B）：到期前 45 天内准备续签材料
- 教育签证（ED）：到期前 30 天内由学校协助提交续签
- 配偶签证（Non-O）：到期前 30 天内续签，需提供婚姻关系证明更新
- 精英签证（Elite）：到期前 90 天联系 Thailand Privilege Card 办理续期

## 文件准备清单
- 通用材料：护照原件（有效期6个月以上）、TM.7 续签申请表、4x6cm 照片、当前签证页复印件、TM.6 出入境卡
- 工作签证附加：有效工作许可原件及复印件、雇主担保信、公司营业执照复印件、最近个人所得税申报记录
- 退休签证附加：银行存款证明（不低于80万泰铢或月收入不低于6.5万泰铢）、银行流水、健康保险证明
- 配偶签证附加：结婚证原件及翻译件、配偶身份证明、共同居住证明

## 常见拒签原因与应对策略
- 材料不完整或过期 → 提前核对清单，确保所有文件在有效期内
- 财务证明不达标 → 提前3个月准备资金，确保存款满足最低要求
- 逾期滞留记录 → 如有逾期记录需提供说明信，严重者可能需出境重新申请
- 工作许可与签证不匹配 → 确保工作许可与签证类型、雇主信息一致
- 照片或表格不符合规格 → 严格按照移民局要求准备

## 输出格式（严格 JSON）
{
  "isRenewable": true,
  "requirements": ["续签条件1", "续签条件2"],
  "process": [
    { "step": 1, "description": "步骤描述", "estimatedDuration": "预估时间" }
  ],
  "estimatedCost": {
    "amount": "费用金额",
    "currency": "THB",
    "breakdown": {}
  },
  "deadline": "续签截止日期说明",
  "penalties": ["逾期处罚1", "逾期处罚2"]
}

## 重要规则
- isRenewable 必须为布尔值
- requirements 和 process 数组至少各包含一项
- estimatedCost 必须包含 amount 和 currency
- penalties 应说明逾期滞留的法律后果

## 免责声明
在输出末尾附加免责声明：本回复仅供参考，不构成正式法律意见。具体签证与移民事务请咨询持牌律师或专业签证顾问。`;

export const VISA_RENEWAL_USER_PROMPT_TEMPLATE = `请提供以下签证的续签信息：

签证类型：{{visaType}}
{{expiryDate}}
{{entryType}}

请严格按照 JSON 格式输出续签信息。`;

export const VISA_CONVERSION_SYSTEM_PROMPT = `你是一位中泰签证与移民法律顾问。你的任务是分析签证类型转换的可行路径。

## 法律依据
### 泰国法律
- Thai Immigration Act B.E. 2522 (1979)（泰国移民法）
- Work Permit Act B.E. 2551 (2008)（工作许可法）
- BOI Investment Promotion Act B.E. 2520 (1977)（投资促进法）
- Royal Decree on Visa Exemption（签证豁免皇家法令）

### 中国法律
- 中国公民出境管理条例
- 《中华人民共和国护照法》

## 转换资格规则
- 旅游签证 → 工作签证（Non-B）：需先获得雇主担保和工作许可批准，通常需出境至泰国领事馆重新申请
- 旅游签证 → 教育签证（ED）：需获得认可教育机构的录取通知，可在境内移民局申请转换
- 旅游签证 → 退休签证（O-A）：需满足年龄（50岁以上）和财务要求，通常需出境申请
- 工作签证 → 配偶签证（Non-O）：需提供婚姻证明，可在境内转换但需注意工作许可衔接
- 教育签证 → 工作签证（Non-B）：需先取消教育签证，获得雇主担保后重新申请
- 落地签/免签入境 → 任何长期签证：必须出境至泰国领事馆申请，不可境内转换
- BOI 促进企业员工：可通过 One Stop Service Center 快速办理签证和工作许可转换

## 各转换路径所需文件差异
- 转工作签证：雇主担保信、公司注册文件、工作许可申请表（WP.1）、学历认证
- 转退休签证：银行存款证明（80万泰铢）、无犯罪记录证明、健康体检报告
- 转配偶签证：结婚证公证翻译件、配偶身份证明、共同居住证明、经济担保证明
- 转教育签证：学校录取通知书、课程注册证明、学费缴纳凭证
- 转 BOI 签证：BOI 促进证书、公司 BOI 批准函、职位证明

## 办理时间预期
- 境内转换（如适用）：5-15 个工作日
- 出境重新申请：3-10 个工作日（不含出入境时间）
- BOI One Stop Service：1-3 个工作日
- 复杂转换（需多步骤）：2-8 周

## 可行性评估标准
- HIGH：转换路径明确，条件容易满足，成功率高
- MEDIUM：转换可行但有一定条件限制或需要额外步骤
- LOW：转换困难，条件严格或需要出境重新申请

## 输出格式（严格 JSON）
{
  "conversionPaths": [
    {
      "targetVisaType": "目标签证类型",
      "feasibility": "HIGH|MEDIUM|LOW",
      "requirements": ["转换条件1", "转换条件2"],
      "process": [
        { "step": 1, "description": "步骤描述", "estimatedDuration": "预估时间" }
      ],
      "estimatedCost": {
        "amount": "费用金额",
        "currency": "THB",
        "breakdown": {}
      },
      "notes": "注意事项和补充说明"
    }
  ]
}

## 重要规则
- feasibility 必须是 HIGH、MEDIUM 或 LOW 之一
- requirements 和 process 数组至少各包含一项
- estimatedCost 必须包含 amount 和 currency
- notes 必须非空

## 免责声明
在输出末尾附加免责声明：本回复仅供参考，不构成正式法律意见。具体签证与移民事务请咨询持牌律师或专业签证顾问。`;

export const VISA_CONVERSION_USER_PROMPT_TEMPLATE = `请分析以下签证类型转换的可行路径：

当前签证类型：{{currentVisaType}}
{{expiryDate}}
{{entryType}}
目标签证类型：{{targetType}}

请严格按照 JSON 格式输出转换路径分析结果。`;

// ─── Visa Advisor ───────────────────────────────────────────

export class VisaAdvisor {
  private llm = getLLMGateway();

  /**
   * Recommend suitable visa types based on user profile.
   * Returns recommendations with requirements, documents, process, costs,
   * common rejection reasons, and avoidance advice.
   */
  async recommend(userProfile: VisaUserProfile): Promise<VisaRecommendation[]> {
    const userPrompt = VISA_RECOMMEND_USER_PROMPT_TEMPLATE
      .replace('{{nationality}}', userProfile.nationality)
      .replace('{{purpose}}', userProfile.purpose)
      .replace('{{duration}}', userProfile.duration ? `预计停留时间：${userProfile.duration}` : '')
      .replace('{{occupation}}', userProfile.occupation ? `职业：${userProfile.occupation}` : '')
      .replace('{{age}}', userProfile.age !== undefined ? `年龄：${userProfile.age}` : '')
      .replace('{{financialStatus}}', userProfile.financialStatus ? `财务状况：${userProfile.financialStatus}` : '')
      .replace('{{currentLocation}}', userProfile.currentLocation ? `当前所在地：${userProfile.currentLocation}` : '');

    const messages: LLMMessage[] = [
      { role: 'system', content: VISA_RECOMMEND_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 4000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedRecommendations(userProfile);
    }

    try {
      const parsed = this.llm.parseJSON<RawRecommendResponse>(response);
      return this.normalizeRecommendations(parsed.recommendations);
    } catch {
      return this.buildDegradedRecommendations(userProfile);
    }
  }

  /**
   * Get renewal information for a current visa.
   */
  async getRenewalInfo(currentVisa: VisaInfo): Promise<RenewalInfo> {
    const userPrompt = VISA_RENEWAL_USER_PROMPT_TEMPLATE
      .replace('{{visaType}}', currentVisa.visaType)
      .replace('{{expiryDate}}', currentVisa.expiryDate ? `到期日期：${currentVisa.expiryDate}` : '')
      .replace('{{entryType}}', currentVisa.entryType ? `入境类型：${currentVisa.entryType}` : '');

    const messages: LLMMessage[] = [
      { role: 'system', content: VISA_RENEWAL_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 3000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedRenewalInfo(currentVisa);
    }

    try {
      const parsed = this.llm.parseJSON<RawRenewalResponse>(response);
      return this.normalizeRenewalInfo(parsed);
    } catch {
      return this.buildDegradedRenewalInfo(currentVisa);
    }
  }

  /**
   * Get conversion paths from current visa to target visa type.
   */
  async getConversionPaths(currentVisa: VisaInfo, targetType: string): Promise<ConversionPath[]> {
    const userPrompt = VISA_CONVERSION_USER_PROMPT_TEMPLATE
      .replace('{{currentVisaType}}', currentVisa.visaType)
      .replace('{{expiryDate}}', currentVisa.expiryDate ? `到期日期：${currentVisa.expiryDate}` : '')
      .replace('{{entryType}}', currentVisa.entryType ? `入境类型：${currentVisa.entryType}` : '')
      .replace('{{targetType}}', targetType);

    const messages: LLMMessage[] = [
      { role: 'system', content: VISA_CONVERSION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 3000,
    });

    if (response.provider === 'fallback') {
      return this.buildDegradedConversionPaths(targetType);
    }

    try {
      const parsed = this.llm.parseJSON<RawConversionResponse>(response);
      return this.normalizeConversionPaths(parsed.conversionPaths);
    } catch {
      return this.buildDegradedConversionPaths(targetType);
    }
  }

  // ─── Normalization ──────────────────────────────────────

  private normalizeRecommendations(rawRecs: unknown): VisaRecommendation[] {
    if (!Array.isArray(rawRecs) || rawRecs.length === 0) {
      return [{
        visaType: '旅游签证（Tourist Visa）',
        requirements: ['有效护照（有效期6个月以上）'],
        documents: ['护照原件及复印件'],
        process: [{ step: 1, description: '准备申请材料', estimatedDuration: '1-2天' }],
        estimatedCost: { amount: '2000', currency: 'THB' },
        commonRejectionReasons: ['材料不完整'],
        avoidanceAdvice: ['确保所有材料齐全并符合要求'],
      }];
    }

    return rawRecs
      .filter((r): r is Record<string, unknown> => r !== null && typeof r === 'object')
      .map(r => this.normalizeOneRecommendation(r));
  }

  private normalizeOneRecommendation(raw: Record<string, unknown>): VisaRecommendation {
    return {
      visaType: this.normalizeString(raw.visaType, '签证类型待确认'),
      requirements: this.normalizeStringArray(raw.requirements, '申请条件待确认'),
      documents: this.normalizeStringArray(raw.documents, '所需材料待确认'),
      process: this.normalizeProcessSteps(raw.process),
      estimatedCost: this.normalizeCostEstimate(raw.estimatedCost),
      commonRejectionReasons: this.normalizeStringArray(raw.commonRejectionReasons, '拒签原因待分析'),
      avoidanceAdvice: this.normalizeStringArray(raw.avoidanceAdvice, '请确保材料齐全，遵守泰国移民法规'),
    };
  }

  private normalizeRenewalInfo(raw: RawRenewalResponse): RenewalInfo {
    const result: RenewalInfo = {
      isRenewable: typeof raw.isRenewable === 'boolean' ? raw.isRenewable : true,
      requirements: this.normalizeStringArray(raw.requirements, '续签条件待确认'),
      process: this.normalizeProcessSteps(raw.process),
      estimatedCost: this.normalizeCostEstimate(raw.estimatedCost),
    };

    if (typeof raw.deadline === 'string' && raw.deadline.trim()) {
      result.deadline = raw.deadline.trim();
    }

    if (Array.isArray(raw.penalties) && raw.penalties.length > 0) {
      const penalties = raw.penalties
        .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
        .map(p => p.trim());
      if (penalties.length > 0) {
        result.penalties = penalties;
      }
    }

    return result;
  }

  private normalizeConversionPaths(rawPaths: unknown): ConversionPath[] {
    if (!Array.isArray(rawPaths) || rawPaths.length === 0) {
      return [{
        targetVisaType: '目标签证类型待确认',
        feasibility: 'MEDIUM',
        requirements: ['转换条件待确认'],
        process: [{ step: 1, description: '咨询移民局了解转换要求', estimatedDuration: '1天' }],
        estimatedCost: { amount: '待确认', currency: 'THB' },
        notes: '建议咨询专业签证顾问获取详细转换方案。',
      }];
    }

    return rawPaths
      .filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object')
      .map(p => this.normalizeOneConversionPath(p));
  }

  private normalizeOneConversionPath(raw: Record<string, unknown>): ConversionPath {
    return {
      targetVisaType: this.normalizeString(raw.targetVisaType, '目标签证类型待确认'),
      feasibility: this.normalizeFeasibility(raw.feasibility),
      requirements: this.normalizeStringArray(raw.requirements, '转换条件待确认'),
      process: this.normalizeProcessSteps(raw.process),
      estimatedCost: this.normalizeCostEstimate(raw.estimatedCost),
      notes: this.normalizeString(raw.notes, '建议咨询专业签证顾问获取详细信息。'),
    };
  }

  // ─── Utility Helpers ────────────────────────────────────

  private normalizeString(value: unknown, fallback: string): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private normalizeStringArray(arr: unknown, fallback: string): string[] {
    if (!Array.isArray(arr) || arr.length === 0) {
      return [fallback];
    }
    const filtered = arr
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map(s => s.trim());
    return filtered.length > 0 ? filtered : [fallback];
  }

  private normalizeProcessSteps(rawSteps: unknown): ProcessStep[] {
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      return [{ step: 1, description: '请咨询专业签证顾问了解详细流程', estimatedDuration: '待确认' }];
    }

    return rawSteps
      .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
      .map((s, i) => ({
        step: typeof s.step === 'number' ? s.step : i + 1,
        description: typeof s.description === 'string' && s.description.trim()
          ? s.description.trim() : `步骤 ${i + 1}`,
        ...(typeof s.estimatedDuration === 'string' && s.estimatedDuration.trim()
          ? { estimatedDuration: s.estimatedDuration.trim() }
          : {}),
      }));
  }

  private normalizeCostEstimate(raw: unknown): CostEstimate {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      const result: CostEstimate = {
        amount: typeof obj.amount === 'string' && obj.amount.trim()
          ? obj.amount.trim()
          : typeof obj.amount === 'number' ? String(obj.amount) : '待确认',
        currency: typeof obj.currency === 'string' && obj.currency.trim()
          ? obj.currency.trim() : 'THB',
      };
      if (obj.breakdown && typeof obj.breakdown === 'object' && !Array.isArray(obj.breakdown)) {
        result.breakdown = obj.breakdown as Record<string, string>;
      }
      return result;
    }
    return { amount: '待确认', currency: 'THB' };
  }

  private normalizeFeasibility(value: unknown): ConversionPath['feasibility'] {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (VALID_FEASIBILITIES.includes(upper as ConversionPath['feasibility'])) {
        return upper as ConversionPath['feasibility'];
      }
    }
    return 'MEDIUM';
  }

  // ─── Degraded Responses ─────────────────────────────────

  private buildDegradedRecommendations(userProfile: VisaUserProfile): VisaRecommendation[] {
    return [{
      visaType: '签证推荐（AI 服务暂时不可用）',
      requirements: [`针对${userProfile.nationality}公民的签证申请条件待查询`],
      documents: ['护照原件及复印件', '签证申请表'],
      process: [{ step: 1, description: 'AI 服务暂时不可用，请稍后重试', estimatedDuration: '待确认' }],
      estimatedCost: { amount: '待确认', currency: 'THB' },
      commonRejectionReasons: ['AI 服务暂时不可用，无法分析拒签原因'],
      avoidanceAdvice: ['请稍后重试或咨询专业签证顾问'],
    }];
  }

  private buildDegradedRenewalInfo(currentVisa: VisaInfo): RenewalInfo {
    return {
      isRenewable: true,
      requirements: [`${currentVisa.visaType}续签条件待查询（AI 服务暂时不可用）`],
      process: [{ step: 1, description: 'AI 服务暂时不可用，请稍后重试', estimatedDuration: '待确认' }],
      estimatedCost: { amount: '待确认', currency: 'THB' },
      penalties: ['逾期滞留将面临罚款和可能的拘留，请务必在签证到期前办理续签'],
    };
  }

  private buildDegradedConversionPaths(targetType: string): ConversionPath[] {
    return [{
      targetVisaType: targetType,
      feasibility: 'MEDIUM',
      requirements: ['AI 服务暂时不可用，转换条件待查询'],
      process: [{ step: 1, description: 'AI 服务暂时不可用，请稍后重试', estimatedDuration: '待确认' }],
      estimatedCost: { amount: '待确认', currency: 'THB' },
      notes: 'AI 服务暂时不可用，建议咨询专业签证顾问获取详细转换方案。',
    }];
  }
}

// ─── Raw Response Types ───────────────────────────────────

interface RawRecommendResponse {
  recommendations?: unknown;
}

interface RawRenewalResponse {
  isRenewable?: unknown;
  requirements?: unknown;
  process?: unknown;
  estimatedCost?: unknown;
  deadline?: unknown;
  penalties?: unknown;
}

interface RawConversionResponse {
  conversionPaths?: unknown;
}

// ─── Singleton ──────────────────────────────────────────────

let advisorInstance: VisaAdvisor | null = null;

export function getVisaAdvisor(): VisaAdvisor {
  if (!advisorInstance) {
    advisorInstance = new VisaAdvisor();
  }
  return advisorInstance;
}

export function resetVisaAdvisor(): void {
  advisorInstance = null;
}
