/**
 * Jurisdiction Identifier (管辖权识别器)
 * Analyzes consultation content to determine the applicable legal jurisdiction.
 * Uses LLM Prompt engineering with Chinese-Thai legal keyword mapping.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import { getPromptEngine } from '@/server/services/llm/prompt-engine';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface ConsultationRequest {
  query: string;
  userId?: string;
  language?: 'zh' | 'th' | 'en';
  context?: string;
}

export interface LawReference {
  lawName: string;
  articleNumber?: string;
  description: string;
}

export interface JurisdictionResult {
  jurisdiction: 'CHINA' | 'THAILAND' | 'DUAL';
  confidence: number; // 0-1
  chinaLaws?: LawReference[];
  thailandLaws?: LawReference[];
  needsMoreInfo?: string[];
}

// ─── Constants ──────────────────────────────────────────────

/** Confidence threshold — below this, needsMoreInfo is populated */
export const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Detailed system prompt for jurisdiction identification.
 * Contains Chinese-Thai legal keyword mapping and determination rules.
 */
export const JURISDICTION_SYSTEM_PROMPT = `你是一位精通中泰跨境法律事务的资深法律专家，专门负责管辖权识别与跨境管辖权冲突解决。

## 你的任务
根据用户的咨询内容，判断适用的法律管辖区（CHINA、THAILAND 或 DUAL），并给出置信度评分。

## 适用法律渊源

### 中国法律渊源
- 《民法典》、《民事诉讼法》、《刑事诉讼法》、《合同法》、《公司法》、《劳动法》、《劳动合同法》、《外商投资法》
- 最高人民法院关于涉外民事关系法律适用的司法解释
- 《涉外民事关系法律适用法》

### 泰国法律渊源
- Civil and Commercial Code, Criminal Code, Civil Procedure Code
- Foreign Business Act, Labor Protection Act, Immigration Act, Land Code
- BOI Investment Promotion Act, Arbitration Act
- Conflict of Laws Act (พ.ร.บ.ว่าด้วยการขัดกันแห่งกฎหมาย)

## 中泰法律关键词映射表

### 中国法律关键词
- 法律法规：民法典、刑法、公司法、劳动法、劳动合同法、外商投资法、民事诉讼法、刑事诉讼法、合同法、婚姻法、继承法、知识产权法、商标法、专利法、著作权法
- 机构：人民法院、人民检察院、公安局、工商局、市场监督管理局、税务局、商务部、发改委
- 制度：户籍、社保、公积金、营业执照、统一社会信用代码、增值税、个人所得税、企业所得税
- 地名：中国、大陆、内地、北京、上海、广州、深圳、及其他中国城市/省份

### 泰国法律关键词
- 法律法规：民商法典（Civil and Commercial Code）、刑法典（Criminal Code）、外国人经商法（Foreign Business Act）、移民法（Immigration Act）、土地法（Land Code）、劳动保护法（Labor Protection Act）、投资促进法（BOI）
- 签证：工作签（Work Permit）、退休签（Retirement Visa）、精英签（Thailand Elite Visa）、商务签（Business Visa）、DTV数字游民签、学生签
- 机构：BOI（投资促进委员会）、DBD（商业发展厅）、Immigration Bureau、Labor Court、SET（泰国证券交易所）
- 制度：外资持股限制、工作许可证（Work Permit）、90天报到、TM30、泰国税号
- 地名：泰国、曼谷、清迈、普吉、芭提雅、及其他泰国城市/府

### 双重管辖关键词
- 跨境、中泰、双边、投资协定、避免双重征税、司法协助、跨国、两国

## 管辖权判定规则

1. **仅涉及中国法律关键词** → jurisdiction: "CHINA"
2. **仅涉及泰国法律关键词** → jurisdiction: "THAILAND"
3. **同时涉及中泰两国关键词或跨境事务** → jurisdiction: "DUAL"
4. **无法明确判定时** → 给出最可能的管辖区，降低 confidence，并在 needsMoreInfo 中列出需要补充的信息

## 跨境管辖权冲突解决指引
当判定为 DUAL 管辖时，应额外分析以下内容：
1. **管辖权冲突识别**：分析中泰两国法律对同一事项是否存在管辖权竞合或冲突
2. **连接点分析**：识别案件与各法域的连接点（合同签订地、履行地、侵权行为地、当事人住所地等）
3. **法律适用冲突**：分析《涉外民事关系法律适用法》与泰国 Conflict of Laws Act 的适用规则差异
4. **平行诉讼风险**：评估是否存在中泰两国同时受理的风险

## 法院选择建议
当涉及跨境争议时，应提供以下法院/仲裁选择建议：
1. **中国法院**：适用情形（被告住所地在中国、合同履行地在中国等）及管辖级别建议
2. **泰国法院**：适用情形（被告住所地在泰国、不动产所在地在泰国等）及专门法院建议（如 Labor Court、IP&IT Court）
3. **国际仲裁**：推荐仲裁机构（CIETAC、TAI、SIAC、ICC）及适用情形
4. **判决承认与执行**：分析中泰之间判决互认的可行性与限制

## 置信度评分规则
- 0.9-1.0：关键词明确，管辖区无歧义
- 0.7-0.89：有较强指向性，但存在少量不确定因素
- 0.5-0.69：信息不足，需要补充信息才能准确判定
- 0.0-0.49：信息严重不足，无法做出有意义的判定

## 输出格式（严格 JSON）
{
  "jurisdiction": "CHINA" | "THAILAND" | "DUAL",
  "confidence": 0.0-1.0,
  "chinaLaws": [{"lawName": "法律名称", "articleNumber": "条款编号（可选）", "description": "简要说明"}],
  "thailandLaws": [{"lawName": "法律名称", "articleNumber": "条款编号（可选）", "description": "简要说明"}],
  "needsMoreInfo": ["需要补充的信息1", "需要补充的信息2"],
  "reasoning": "判定理由简述"
}

## 重要规则
- jurisdiction 为 "DUAL" 时，chinaLaws 和 thailandLaws 都必须非空
- jurisdiction 为 "CHINA" 时，chinaLaws 必须非空
- jurisdiction 为 "THAILAND" 时，thailandLaws 必须非空
- confidence 低于 0.7 时，needsMoreInfo 必须非空，列出需要用户补充的具体信息
- 始终返回有效的 JSON 格式

## 免责声明指令
在输出的 reasoning 末尾，必须附加说明：本分析仅供参考，不构成正式法律意见。具体管辖权判定请咨询持牌律师。`;

export const JURISDICTION_USER_PROMPT_TEMPLATE = `请分析以下法律咨询内容，确定适用的法律管辖区。

咨询内容：
{{query}}

{{context}}

请严格按照 JSON 格式输出分析结果。`;

// ─── Jurisdiction Identifier ────────────────────────────────

export class JurisdictionIdentifier {
  private llm = getLLMGateway();
  private promptEngine = getPromptEngine();

  /**
   * Identify the applicable legal jurisdiction for a consultation request.
   * Uses LLM with structured JSON output for reliable parsing.
   */
  async identify(request: ConsultationRequest): Promise<JurisdictionResult> {
    const systemPrompt = JURISDICTION_SYSTEM_PROMPT;

    const contextSection = request.context
      ? `补充上下文：\n${request.context}`
      : '';

    const userPrompt = JURISDICTION_USER_PROMPT_TEMPLATE
      .replace('{{query}}', request.query)
      .replace('{{context}}', contextSection);

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 2000,
    });

    // Handle degraded response
    if (response.provider === 'fallback') {
      return {
        jurisdiction: 'DUAL',
        confidence: 0,
        needsMoreInfo: ['AI 服务暂时不可用，请稍后重试以获取准确的管辖权分析。'],
      };
    }

    const parsed = this.llm.parseJSON<RawJurisdictionResponse>(response);
    return this.normalizeResult(parsed);
  }

  /**
   * Normalize and validate the raw LLM response into a JurisdictionResult.
   * Ensures all business rules are enforced.
   */
  private normalizeResult(raw: RawJurisdictionResponse): JurisdictionResult {
    const jurisdiction = this.normalizeJurisdiction(raw.jurisdiction);
    const confidence = this.normalizeConfidence(raw.confidence);

    const chinaLaws = this.normalizeLawReferences(raw.chinaLaws);
    const thailandLaws = this.normalizeLawReferences(raw.thailandLaws);

    // Build needsMoreInfo
    let needsMoreInfo: string[] | undefined;
    if (confidence < CONFIDENCE_THRESHOLD) {
      needsMoreInfo = Array.isArray(raw.needsMoreInfo) && raw.needsMoreInfo.length > 0
        ? raw.needsMoreInfo.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : ['请提供更多关于您法律问题的详细信息，以便准确判定管辖区。'];

      if (needsMoreInfo.length === 0) {
        needsMoreInfo = ['请提供更多关于您法律问题的详细信息，以便准确判定管辖区。'];
      }
    }

    const result: JurisdictionResult = {
      jurisdiction,
      confidence,
    };

    // Enforce law reference rules based on jurisdiction
    if (jurisdiction === 'CHINA' || jurisdiction === 'DUAL') {
      result.chinaLaws = chinaLaws.length > 0 ? chinaLaws : [{ lawName: '待确定', description: '需要进一步分析以确定具体适用的中国法律' }];
    }
    if (jurisdiction === 'THAILAND' || jurisdiction === 'DUAL') {
      result.thailandLaws = thailandLaws.length > 0 ? thailandLaws : [{ lawName: '待确定', description: '需要进一步分析以确定具体适用的泰国法律' }];
    }

    if (needsMoreInfo) {
      result.needsMoreInfo = needsMoreInfo;
    }

    return result;
  }

  private normalizeJurisdiction(value: unknown): 'CHINA' | 'THAILAND' | 'DUAL' {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper === 'CHINA' || upper === 'THAILAND' || upper === 'DUAL') {
        return upper;
      }
    }
    return 'DUAL'; // Default to DUAL when uncertain
  }

  private normalizeConfidence(value: unknown): number {
    if (typeof value === 'number' && !isNaN(value)) {
      return Math.max(0, Math.min(1, value));
    }
    return 0.5; // Default to medium confidence
  }

  private normalizeLawReferences(refs: unknown): LawReference[] {
    if (!Array.isArray(refs)) return [];
    return refs
      .filter((ref): ref is Record<string, unknown> => ref !== null && typeof ref === 'object')
      .map((ref) => ({
        lawName: typeof ref.lawName === 'string' ? ref.lawName : '未知法律',
        articleNumber: typeof ref.articleNumber === 'string' ? ref.articleNumber : undefined,
        description: typeof ref.description === 'string' ? ref.description : '',
      }));
  }
}

/** Raw response shape from LLM (before normalization) */
interface RawJurisdictionResponse {
  jurisdiction: string;
  confidence: number;
  chinaLaws?: Array<{ lawName?: string; articleNumber?: string; description?: string }>;
  thailandLaws?: Array<{ lawName?: string; articleNumber?: string; description?: string }>;
  needsMoreInfo?: string[];
  reasoning?: string;
}

// ─── Singleton ──────────────────────────────────────────────

let identifierInstance: JurisdictionIdentifier | null = null;

export function getJurisdictionIdentifier(): JurisdictionIdentifier {
  if (!identifierInstance) {
    identifierInstance = new JurisdictionIdentifier();
  }
  return identifierInstance;
}

export function resetJurisdictionIdentifier(): void {
  identifierInstance = null;
}
