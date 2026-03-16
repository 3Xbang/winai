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

export const VISA_RECOMMEND_SYSTEM_PROMPT = `你是一位精通泰国签证政策和移民法的资深签证顾问。你的任务是根据用户的个人情况，推荐最适合的泰国签证类型。

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
- 必须说明非法逾期滞留和未经许可工作的法律后果（在 avoidanceAdvice 中体现）`;

export const VISA_RECOMMEND_USER_PROMPT_TEMPLATE = `请根据以下用户情况，推荐适合的泰国签证类型：

国籍：{{nationality}}
目的：{{purpose}}
{{duration}}
{{occupation}}
{{age}}
{{financialStatus}}
{{currentLocation}}

请严格按照 JSON 格式输出签证推荐结果。`;

export const VISA_RENEWAL_SYSTEM_PROMPT = `你是一位精通泰国签证政策和移民法的资深签证顾问。你的任务是提供签证续签信息。

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
- penalties 应说明逾期滞留的法律后果`;

export const VISA_RENEWAL_USER_PROMPT_TEMPLATE = `请提供以下签证的续签信息：

签证类型：{{visaType}}
{{expiryDate}}
{{entryType}}

请严格按照 JSON 格式输出续签信息。`;

export const VISA_CONVERSION_SYSTEM_PROMPT = `你是一位精通泰国签证政策和移民法的资深签证顾问。你的任务是分析签证类型转换的可行路径。

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
- notes 必须非空`;

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
