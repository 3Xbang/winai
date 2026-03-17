/**
 * IRAC Analysis Engine (IRAC 分析引擎)
 * Performs structured legal analysis using the IRAC methodology:
 * Issue (争议焦点), Rule (法律规则), Analysis (法律分析), Conclusion (结论).
 *
 * For DUAL jurisdiction, two independent IRAC analyses are performed
 * (one for Chinese law, one for Thai law) plus a combined conclusion.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import { getPromptEngine } from '@/server/services/llm/prompt-engine';
import type { LLMMessage } from '@/server/services/llm/types';
import type { ConsultationRequest, LawReference, JurisdictionResult } from './jurisdiction';

// ─── Types ──────────────────────────────────────────────────

export interface IRACAnalysis {
  issue: string;           // 争议焦点
  rule: LawReference[];    // 适用法律条文
  analysis: string;        // 法律适用分析
  conclusion: string;      // 结论
}

export interface IRACResult {
  jurisdiction: JurisdictionResult;
  chinaAnalysis?: IRACAnalysis;
  thailandAnalysis?: IRACAnalysis;
  combinedConclusion?: string;
}

// ─── Constants ──────────────────────────────────────────────

export const IRAC_SYSTEM_PROMPT = `你是一位中泰跨境法律IRAC分析专家，严格采用 IRAC 法律分析方法论，专注于中国与泰国跨境法律事务的结构化分析。

## 适用法律渊源
- 中国法律：《民法典》、《合同法》、《劳动法》、《劳动合同法》、《公司法》、《外商投资法》、《民事诉讼法》、《涉外民事关系法律适用法》
- 泰国法律：Civil and Commercial Code, Labor Protection Act, Foreign Business Act, Immigration Act, BOI Investment Promotion Act, Civil Procedure Code, Conflict of Laws Act (พ.ร.บ.ว่าด้วยการขัดกันแห่งกฎหมาย)

## IRAC 方法论
你必须严格按照以下四个步骤进行法律分析：

1. **Issue（争议焦点）**：明确识别并陈述核心法律争议问题
2. **Rule（法律规则）**：引用具体的法律条文，必须包含法律名称和条款编号（如"《民法典》第XXX条"或"Civil and Commercial Code Section XXX"）
3. **Analysis（法律分析）**：将法律规则适用于用户提供的具体事实，进行详细的法律推理分析
4. **Conclusion（结论）**：基于分析给出明确的法律结论和建议

## 跨境法律冲突分析（法律冲突分析）
在涉及中泰跨境事务时，你必须额外分析：
- 法律适用冲突：根据中国《涉外民事关系法律适用法》和泰国 Conflict of Laws Act 确定准据法
- 管辖权冲突：分析中国法院与泰国法院的管辖权依据及冲突
- 法律规定差异：对比中泰两国在同一法律问题上的实体法差异
- 执行可行性：评估判决或仲裁裁决在对方法域的承认与执行可能性

## 输出格式（严格 JSON）
{
  "issue": "争议焦点的详细描述",
  "rule": [
    {
      "lawName": "法律名称（如《民法典》、Civil and Commercial Code）",
      "articleNumber": "具体条款编号（如第148条、Section 420）",
      "description": "该条款的核心内容摘要"
    }
  ],
  "analysis": "结合用户具体事实的法律适用分析",
  "conclusion": "明确的法律结论和建议"
}

## 重要规则
- issue 必须非空，清晰描述争议焦点
- rule 数组必须至少包含一条法律引用，每条必须包含 lawName 和 articleNumber
- analysis 必须结合用户提供的具体事实进行法律适用分析，不能泛泛而谈
- conclusion 必须给出明确的法律结论
- 所有字段不得为空字符串

## 免责声明
在每次分析结论中，你必须提醒用户：本分析仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。`;

export const IRAC_CHINA_JURISDICTION_HINT = `请基于中国法律体系进行 IRAC 分析。引用中国法律条文时使用中文法律名称和条款编号（如《民法典》第XXX条、《公司法》第XXX条）。`;

export const IRAC_THAILAND_JURISDICTION_HINT = `请基于泰国法律体系进行 IRAC 分析。引用泰国法律条文时使用法律名称和条款编号（如 Civil and Commercial Code Section XXX、Foreign Business Act Section XXX）。`;

export const IRAC_USER_PROMPT_TEMPLATE = `请对以下法律问题进行严格的 IRAC 分析。

管辖区：{{jurisdiction}}
{{jurisdictionHint}}

咨询内容：
{{query}}

{{context}}

请严格按照 JSON 格式输出 IRAC 分析结果。`;

export const COMBINED_CONCLUSION_SYSTEM_PROMPT = `你是一位中泰跨境法律综合结论专家。请根据中国法和泰国法的两份独立 IRAC 分析结果，生成一份综合结论。

## 适用法律渊源
- 中国法律：《民法典》、《合同法》、《劳动法》、《劳动合同法》、《公司法》、《外商投资法》、《民事诉讼法》、《涉外民事关系法律适用法》
- 泰国法律：Civil and Commercial Code, Labor Protection Act, Foreign Business Act, Immigration Act, BOI Investment Promotion Act, Civil Procedure Code, Conflict of Laws Act

## 综合结论要求
综合结论应当：
1. 对比两个法域的分析结果，调和中国法与泰国法的分析发现
2. 指出两个法域的共同点和差异，明确法律冲突点
3. 给出跨境法律事务的统一可执行建议，包括推荐的法律适用选择、管辖权建议和争议解决方式
4. 提醒需要特别注意的法律冲突点和跨境执行风险
5. 提供统一的行动建议清单，按优先级排列，明确每项建议适用的法域

请直接输出综合结论文本，不需要 JSON 格式。

## 免责声明
在综合结论末尾，你必须附加提醒：本分析仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。`;

// ─── IRAC Engine ────────────────────────────────────────────

export class IRACEngine {
  private llm = getLLMGateway();
  private promptEngine = getPromptEngine();

  /**
   * Perform IRAC analysis for a consultation request.
   * - CHINA: one analysis under Chinese law
   * - THAILAND: one analysis under Thai law
   * - DUAL: two independent analyses + combined conclusion
   */
  async analyze(request: ConsultationRequest, jurisdiction: JurisdictionResult): Promise<IRACResult> {
    const result: IRACResult = { jurisdiction };

    if (jurisdiction.jurisdiction === 'CHINA') {
      result.chinaAnalysis = await this.performSingleAnalysis(request, 'CHINA');
    } else if (jurisdiction.jurisdiction === 'THAILAND') {
      result.thailandAnalysis = await this.performSingleAnalysis(request, 'THAILAND');
    } else {
      // DUAL: two independent analyses
      const [chinaAnalysis, thailandAnalysis] = await Promise.all([
        this.performSingleAnalysis(request, 'CHINA'),
        this.performSingleAnalysis(request, 'THAILAND'),
      ]);
      result.chinaAnalysis = chinaAnalysis;
      result.thailandAnalysis = thailandAnalysis;
      result.combinedConclusion = await this.generateCombinedConclusion(
        request,
        chinaAnalysis,
        thailandAnalysis,
      );
    }

    return result;
  }

  /**
   * Perform a single IRAC analysis for a specific jurisdiction.
   */
  private async performSingleAnalysis(
    request: ConsultationRequest,
    targetJurisdiction: 'CHINA' | 'THAILAND',
  ): Promise<IRACAnalysis> {
    const jurisdictionLabel = targetJurisdiction === 'CHINA' ? '中国法' : '泰国法';
    const jurisdictionHint = targetJurisdiction === 'CHINA'
      ? IRAC_CHINA_JURISDICTION_HINT
      : IRAC_THAILAND_JURISDICTION_HINT;

    const contextSection = request.context
      ? `补充上下文：\n${request.context}`
      : '';

    const userPrompt = IRAC_USER_PROMPT_TEMPLATE
      .replace('{{jurisdiction}}', jurisdictionLabel)
      .replace('{{jurisdictionHint}}', jurisdictionHint)
      .replace('{{query}}', request.query)
      .replace('{{context}}', contextSection);

    const messages: LLMMessage[] = [
      { role: 'system', content: IRAC_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 3000,
    });

    // Handle degraded response
    if (response.provider === 'fallback') {
      return this.buildDegradedAnalysis(targetJurisdiction);
    }

    try {
      const parsed = this.llm.parseJSON<RawIRACResponse>(response);
      return this.normalizeAnalysis(parsed, targetJurisdiction);
    } catch {
      return this.buildDegradedAnalysis(targetJurisdiction);
    }
  }

  /**
   * Generate a combined conclusion for dual-jurisdiction analysis.
   */
  private async generateCombinedConclusion(
    request: ConsultationRequest,
    chinaAnalysis: IRACAnalysis,
    thailandAnalysis: IRACAnalysis,
  ): Promise<string> {
    const userPrompt = `以下是针对同一法律问题的中国法和泰国法两份独立 IRAC 分析结果：

## 中国法 IRAC 分析
- 争议焦点：${chinaAnalysis.issue}
- 适用法条：${chinaAnalysis.rule.map(r => `${r.lawName} ${r.articleNumber || ''}`).join('；')}
- 法律分析：${chinaAnalysis.analysis}
- 结论：${chinaAnalysis.conclusion}

## 泰国法 IRAC 分析
- 争议焦点：${thailandAnalysis.issue}
- 适用法条：${thailandAnalysis.rule.map(r => `${r.lawName} ${r.articleNumber || ''}`).join('；')}
- 法律分析：${thailandAnalysis.analysis}
- 结论：${thailandAnalysis.conclusion}

原始咨询内容：${request.query}

请生成综合结论。`;

    const messages: LLMMessage[] = [
      { role: 'system', content: COMBINED_CONCLUSION_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      maxTokens: 2000,
    });

    if (response.provider === 'fallback' || !response.content.trim()) {
      return '综合结论暂时无法生成，请分别参考中国法和泰国法的独立分析结果。';
    }

    return response.content.trim();
  }

  /**
   * Normalize and validate the raw LLM response into an IRACAnalysis.
   */
  private normalizeAnalysis(raw: RawIRACResponse, targetJurisdiction: 'CHINA' | 'THAILAND'): IRACAnalysis {
    const issue = typeof raw.issue === 'string' && raw.issue.trim()
      ? raw.issue.trim()
      : targetJurisdiction === 'CHINA'
        ? '待分析的中国法律争议焦点'
        : '待分析的泰国法律争议焦点';

    const rule = this.normalizeRules(raw.rule, targetJurisdiction);

    const analysis = typeof raw.analysis === 'string' && raw.analysis.trim()
      ? raw.analysis.trim()
      : '法律适用分析待补充，请提供更多案件事实信息。';

    const conclusion = typeof raw.conclusion === 'string' && raw.conclusion.trim()
      ? raw.conclusion.trim()
      : '结论待补充，请提供更多信息以获得完整的法律分析。';

    return { issue, rule, analysis, conclusion };
  }

  /**
   * Normalize law references, ensuring each has a lawName and articleNumber.
   */
  private normalizeRules(refs: unknown, targetJurisdiction: 'CHINA' | 'THAILAND'): LawReference[] {
    if (!Array.isArray(refs) || refs.length === 0) {
      return [this.buildFallbackRule(targetJurisdiction)];
    }

    const normalized = refs
      .filter((ref): ref is Record<string, unknown> => ref !== null && typeof ref === 'object')
      .map((ref) => ({
        lawName: typeof ref.lawName === 'string' && ref.lawName.trim()
          ? ref.lawName.trim()
          : (targetJurisdiction === 'CHINA' ? '中国相关法律' : 'Thai Relevant Law'),
        articleNumber: typeof ref.articleNumber === 'string' && ref.articleNumber.trim()
          ? ref.articleNumber.trim()
          : undefined,
        description: typeof ref.description === 'string' ? ref.description.trim() : '',
      }));

    // Ensure at least one rule with articleNumber
    if (normalized.length === 0) {
      return [this.buildFallbackRule(targetJurisdiction)];
    }

    // If no rule has an articleNumber, add a note to the first one
    const hasArticleNumber = normalized.some(r => r.articleNumber);
    if (!hasArticleNumber && normalized[0]) {
      normalized[0].articleNumber = targetJurisdiction === 'CHINA'
        ? '待确定具体条款'
        : 'Section TBD';
    }

    return normalized;
  }

  private buildFallbackRule(targetJurisdiction: 'CHINA' | 'THAILAND'): LawReference {
    if (targetJurisdiction === 'CHINA') {
      return {
        lawName: '中国相关法律',
        articleNumber: '待确定具体条款',
        description: '需要进一步分析以确定具体适用的法律条文',
      };
    }
    return {
      lawName: 'Thai Relevant Law',
      articleNumber: 'Section TBD',
      description: 'Further analysis needed to determine specific applicable provisions',
    };
  }

  private buildDegradedAnalysis(targetJurisdiction: 'CHINA' | 'THAILAND'): IRACAnalysis {
    const label = targetJurisdiction === 'CHINA' ? '中国法' : '泰国法';
    return {
      issue: `AI 服务暂时不可用，无法完成${label} IRAC 分析。`,
      rule: [this.buildFallbackRule(targetJurisdiction)],
      analysis: 'AI 服务暂时不可用，请稍后重试。',
      conclusion: '请稍后重试以获取完整的法律分析结论。',
    };
  }
}

/** Raw response shape from LLM (before normalization) */
interface RawIRACResponse {
  issue?: string;
  rule?: Array<{ lawName?: string; articleNumber?: string; description?: string }>;
  analysis?: string;
  conclusion?: string;
}

// ─── Singleton ──────────────────────────────────────────────

let engineInstance: IRACEngine | null = null;

export function getIRACEngine(): IRACEngine {
  if (!engineInstance) {
    engineInstance = new IRACEngine();
  }
  return engineInstance;
}

export function resetIRACEngine(): void {
  engineInstance = null;
}
