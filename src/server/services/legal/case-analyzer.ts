/**
 * Case Analyzer (案件分析器)
 * Handles case fact organization, legal issue identification, and multi-perspective litigation strategy generation.
 * Provides timeline extraction, dispute focus identification, and three-perspective (plaintiff/defendant/judge) strategy analysis.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';
import type { LawReference } from './jurisdiction';

// ─── Types ──────────────────────────────────────────────────

export interface CaseSubmission {
  description: string;
  parties: CaseParty[];
  keyFacts: string[];
  jurisdiction: 'CHINA' | 'THAILAND' | 'DUAL';
  caseType?: 'CIVIL' | 'CRIMINAL' | 'ADMINISTRATIVE' | 'OTHER';
  context?: string;
}

export interface CaseParty {
  name: string;
  role: 'PLAINTIFF' | 'DEFENDANT' | 'THIRD_PARTY' | 'OTHER';
  description?: string;
}

export interface TimelineEvent {
  date: string;
  event: string;
  legalSignificance: string;
}

export interface LegalIssue {
  issue: string;
  legalBasis: LawReference[];
  analysis: string;
}

export interface StrategyAnalysis {
  perspective: 'PLAINTIFF' | 'DEFENDANT' | 'JUDGE';
  keyArguments: string[];
  legalBasis: LawReference[];
  riskAssessment: string;
}

export interface JudgePerspective extends StrategyAnalysis {
  perspective: 'JUDGE';
  likelyRuling: string;
  keyConsiderations: string[];
}

export interface OverallStrategy {
  recommendation: string;
  riskLevel: string;
  nextSteps: string[];
}

export interface CaseAnalysisResult {
  timeline: TimelineEvent[];
  issues: LegalIssue[];
  strategies: {
    plaintiff: StrategyAnalysis;
    defendant: StrategyAnalysis;
    judge: JudgePerspective;
    overall: OverallStrategy;
  };
}

export interface LitigationStrategy {
  strategies: StrategyAnalysis[];
  recommendation: string;
  estimatedOutcome: string;
}

// ─── Constants ──────────────────────────────────────────────

export const CASE_ANALYSIS_SYSTEM_PROMPT = `你是一位中泰跨境案件分析专家。你的任务是对案件进行全面分析，包括时间线梳理、争议焦点识别和多视角诉讼策略生成。

## 专业领域与法律依据

### 中国法律渊源
- 《民法典》、《民事诉讼法》、《刑法》、《公司法》
- 相关司法解释及最高人民法院指导性案例

### 泰国法律渊源
- Civil and Commercial Code, Criminal Code, Civil Procedure Code, Foreign Business Act
- Relevant Supreme Court precedents and regulatory guidelines

## 分析步骤

### 1. 时间线梳理
- 从案件描述中提取所有关键时间节点
- 按时间先后顺序排列
- 标注每个事件的法律意义

### 2. 争议焦点识别
- 识别案件中的核心法律争议焦点
- 每个争议焦点必须引用适用的法律条文
- 提供详细的法律分析

### 3. 三视角策略分析
- **原告视角**：起诉方向、论证要点、证据攻击力、损害赔偿论证
- **被告视角**：抗辩方向、反驳要点、程序瑕疵、证据缺陷
- **法官视角**：可能的裁判倾向、关注重点、法律适用分析、裁判一致性

### 4. 综合策略建议
- 综合三个视角生成整体诉讼策略建议
- 评估风险等级
- 提供具体的下一步行动建议

## 跨境程序要求
- **跨境送达**：分析中国和泰国之间的司法文书送达途径（外交途径、司法协助、公告送达等），评估送达时间和有效性
- **域外证据**：评估域外取证的可行性，包括公证认证程序、证据合法化要求及跨境证据的可采性
- **判决承认与执行**：分析中国法院判决在泰国的承认与执行可能性，以及泰国法院判决在中国的承认与执行条件

## 管辖区特定风险评估
- 针对中国管辖区：评估诉讼时效、管辖法院选择、执行难度等风险因素
- 针对泰国管辖区：评估诉讼时效（Prescription）、法院管辖权、外国当事人诉讼资格等风险因素
- 针对双重管辖区：评估平行诉讼风险、管辖权冲突、判决矛盾等跨境特有风险

## 刑事案件特别要求
- 分析可能的罪名构成要件
- 分析量刑范围
- 评估证据链完整性

## 民事案件特别要求
- 分析诉讼请求的法律依据
- 评估胜诉可能性
- 分析损害赔偿计算依据

## 输出格式（严格 JSON）
{
  "timeline": [
    { "date": "YYYY-MM-DD 或描述性日期", "event": "事件描述", "legalSignificance": "法律意义" }
  ],
  "issues": [
    {
      "issue": "争议焦点描述",
      "legalBasis": [
        { "lawName": "法律名称", "articleNumber": "条款编号", "description": "法条内容摘要" }
      ],
      "analysis": "法律分析"
    }
  ],
  "strategies": {
    "plaintiff": {
      "perspective": "PLAINTIFF",
      "keyArguments": ["论证要点1", "论证要点2"],
      "legalBasis": [{ "lawName": "法律名称", "articleNumber": "条款编号", "description": "说明" }],
      "riskAssessment": "原告风险评估"
    },
    "defendant": {
      "perspective": "DEFENDANT",
      "keyArguments": ["抗辩要点1", "抗辩要点2"],
      "legalBasis": [{ "lawName": "法律名称", "articleNumber": "条款编号", "description": "说明" }],
      "riskAssessment": "被告风险评估"
    },
    "judge": {
      "perspective": "JUDGE",
      "keyArguments": ["裁判关注点1", "裁判关注点2"],
      "legalBasis": [{ "lawName": "法律名称", "articleNumber": "条款编号", "description": "说明" }],
      "riskAssessment": "裁判风险评估",
      "likelyRuling": "可能的裁判倾向",
      "keyConsiderations": ["关键考量因素1", "关键考量因素2"]
    },
    "overall": {
      "recommendation": "综合策略建议",
      "riskLevel": "HIGH/MEDIUM/LOW",
      "nextSteps": ["下一步行动1", "下一步行动2"]
    }
  }
}

## 重要规则
- timeline 必须按时间先后顺序排列
- 每个 issue 的 legalBasis 必须至少包含一条法律引用
- plaintiff/defendant/judge 三个视角的 keyArguments 必须非空
- overall 的 nextSteps 必须至少包含一条建议
- 始终返回有效的 JSON 格式

## 免责声明
- 在分析结果末尾必须附加免责声明：本分析仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。`;

export const CASE_ANALYSIS_USER_PROMPT_TEMPLATE = `请分析以下案件信息：

案件描述：
{{description}}

当事人信息：
{{parties}}

关键事实：
{{keyFacts}}

管辖区：{{jurisdiction}}
案件类型：{{caseType}}
{{context}}

请严格按照 JSON 格式输出完整的案件分析结果。`;

export const LITIGATION_STRATEGY_SYSTEM_PROMPT = `你是一位中泰跨境诉讼策略专家。基于已有的案件分析结果，生成详细的诉讼策略方案。

## 专业领域与法律依据

### 中国法律渊源
- 《民法典》、《民事诉讼法》、《刑法》、《公司法》
- 相关司法解释及最高人民法院指导性案例

### 泰国法律渊源
- Civil and Commercial Code, Criminal Code, Civil Procedure Code, Foreign Business Act
- Relevant Supreme Court precedents and regulatory guidelines

## 跨境争议解决策略

### 诉讼 vs. 仲裁 vs. 调解
- **诉讼**：评估在中国法院或泰国法院提起诉讼的优劣势，考虑管辖权确定、判决执行可行性及诉讼成本
- **仲裁**：评估国际商事仲裁（如 CIETAC、TAI、ICC、SIAC）的适用性，分析仲裁条款效力、仲裁地选择及裁决执行便利性
- **调解**：评估跨境调解的可行性，包括调解协议的法律效力及司法确认程序

### 适用条约与国际协定
- 海牙送达公约（Hague Service Convention）的适用性分析
- 中泰双边司法协助条约及相关安排
- 《纽约公约》（New York Convention）下仲裁裁决的承认与执行
- 其他适用的多边或双边协定

### 各管辖区成本效益分析
- **中国管辖区**：诉讼/仲裁费用估算、律师费用范围、预计时间周期、执行成本
- **泰国管辖区**：诉讼/仲裁费用估算、律师费用范围、预计时间周期、执行成本
- **综合比较**：根据案件具体情况推荐最优争议解决路径

## 输出格式（严格 JSON）
{
  "strategies": [
    {
      "perspective": "PLAINTIFF" | "DEFENDANT" | "JUDGE",
      "keyArguments": ["论证要点"],
      "legalBasis": [{ "lawName": "法律名称", "articleNumber": "条款编号", "description": "说明" }],
      "riskAssessment": "风险评估"
    }
  ],
  "recommendation": "综合诉讼策略建议",
  "estimatedOutcome": "预估案件结果"
}

## 重要规则
- strategies 数组必须包含至少一个策略
- recommendation 和 estimatedOutcome 必须非空
- 每个策略的 keyArguments 必须非空

## 免责声明
- 在策略方案末尾必须附加免责声明：本策略方案仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。`;

export const LITIGATION_STRATEGY_USER_PROMPT_TEMPLATE = `基于以下案件分析结果，生成详细的诉讼策略方案：

时间线：
{{timeline}}

争议焦点：
{{issues}}

已有策略分析：
- 原告视角：{{plaintiffStrategy}}
- 被告视角：{{defendantStrategy}}
- 法官视角：{{judgeStrategy}}
- 综合建议：{{overallStrategy}}

请严格按照 JSON 格式输出诉讼策略方案。`;

// ─── Case Analyzer ──────────────────────────────────────────

export class CaseAnalyzer {
  private llm = getLLMGateway();

  /**
   * Analyze a case submission: extract timeline, identify legal issues,
   * and generate three-perspective strategy analysis.
   */
  async analyze(caseInfo: CaseSubmission): Promise<CaseAnalysisResult> {
    const partiesText = caseInfo.parties
      .map(p => `${p.name}（${p.role}${p.description ? `，${p.description}` : ''}）`)
      .join('\n');

    const keyFactsText = caseInfo.keyFacts.map((f, i) => `${i + 1}. ${f}`).join('\n');

    const jurisdictionLabels: Record<string, string> = {
      CHINA: '中国法',
      THAILAND: '泰国法',
      DUAL: '中国法与泰国法（双重管辖）',
    };

    const caseTypeLabels: Record<string, string> = {
      CIVIL: '民事案件',
      CRIMINAL: '刑事案件',
      ADMINISTRATIVE: '行政案件',
      OTHER: '其他',
    };

    const contextSection = caseInfo.context ? `补充信息：\n${caseInfo.context}` : '';

    const userPrompt = CASE_ANALYSIS_USER_PROMPT_TEMPLATE
      .replace('{{description}}', caseInfo.description)
      .replace('{{parties}}', partiesText)
      .replace('{{keyFacts}}', keyFactsText)
      .replace('{{jurisdiction}}', jurisdictionLabels[caseInfo.jurisdiction] || '双重管辖')
      .replace('{{caseType}}', caseTypeLabels[caseInfo.caseType || 'OTHER'] || '其他')
      .replace('{{context}}', contextSection);

    const messages: LLMMessage[] = [
      { role: 'system', content: CASE_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 6000,
    });

    // Handle degraded response
    if (response.provider === 'fallback') {
      return this.buildDegradedAnalysis(caseInfo);
    }

    try {
      const parsed = this.llm.parseJSON<RawCaseAnalysisResponse>(response);
      return this.normalizeAnalysisResult(parsed);
    } catch {
      return this.buildDegradedAnalysis(caseInfo);
    }
  }

  /**
   * Generate a litigation strategy based on a completed case analysis.
   */
  async generateStrategy(analysis: CaseAnalysisResult): Promise<LitigationStrategy> {
    const timelineText = analysis.timeline
      .map(t => `[${t.date}] ${t.event} — ${t.legalSignificance}`)
      .join('\n');

    const issuesText = analysis.issues
      .map(i => `争议焦点：${i.issue}\n法律依据：${i.legalBasis.map(l => l.lawName).join('、')}\n分析：${i.analysis}`)
      .join('\n\n');

    const userPrompt = LITIGATION_STRATEGY_USER_PROMPT_TEMPLATE
      .replace('{{timeline}}', timelineText)
      .replace('{{issues}}', issuesText)
      .replace('{{plaintiffStrategy}}', analysis.strategies.plaintiff.keyArguments.join('；'))
      .replace('{{defendantStrategy}}', analysis.strategies.defendant.keyArguments.join('；'))
      .replace('{{judgeStrategy}}', analysis.strategies.judge.keyArguments.join('；'))
      .replace('{{overallStrategy}}', analysis.strategies.overall.recommendation);

    const messages: LLMMessage[] = [
      { role: 'system', content: LITIGATION_STRATEGY_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 4000,
    });

    // Handle degraded response
    if (response.provider === 'fallback') {
      return this.buildDegradedStrategy(analysis);
    }

    try {
      const parsed = this.llm.parseJSON<RawLitigationStrategyResponse>(response);
      return this.normalizeStrategyResult(parsed);
    } catch {
      return this.buildDegradedStrategy(analysis);
    }
  }

  // ─── Normalization ──────────────────────────────────────

  private normalizeAnalysisResult(raw: RawCaseAnalysisResponse): CaseAnalysisResult {
    const timeline = this.normalizeTimeline(raw.timeline);
    const issues = this.normalizeIssues(raw.issues);
    const strategies = this.normalizeStrategies(raw.strategies);

    return { timeline, issues, strategies };
  }

  private normalizeTimeline(rawTimeline: unknown): TimelineEvent[] {
    if (!Array.isArray(rawTimeline) || rawTimeline.length === 0) {
      return [{ date: '未知日期', event: '案件事实待梳理', legalSignificance: '需要进一步分析' }];
    }

    const events = rawTimeline
      .filter((t): t is Record<string, unknown> => t !== null && typeof t === 'object')
      .map(t => ({
        date: typeof t.date === 'string' && t.date.trim() ? t.date.trim() : '未知日期',
        event: typeof t.event === 'string' && t.event.trim() ? t.event.trim() : '事件待确认',
        legalSignificance: typeof t.legalSignificance === 'string' && t.legalSignificance.trim()
          ? t.legalSignificance.trim() : '法律意义待分析',
      }));

    // Sort chronologically by date
    return events.sort((a, b) => {
      const dateA = this.parseDateForSort(a.date);
      const dateB = this.parseDateForSort(b.date);
      return dateA - dateB;
    });
  }

  /**
   * Parse a date string into a numeric value for sorting.
   * Handles various formats: YYYY-MM-DD, YYYY年MM月DD日, descriptive dates.
   */
  private parseDateForSort(dateStr: string): number {
    // Try ISO format first
    const isoDate = Date.parse(dateStr);
    if (!isNaN(isoDate)) return isoDate;

    // Try Chinese date format: YYYY年MM月DD日
    const chineseMatch = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
    if (chineseMatch && chineseMatch[1] && chineseMatch[2] && chineseMatch[3]) {
      return new Date(
        parseInt(chineseMatch[1]),
        parseInt(chineseMatch[2]) - 1,
        parseInt(chineseMatch[3]),
      ).getTime();
    }

    // Try extracting any year-month-day pattern
    const numericMatch = dateStr.match(/(\d{4})[^\d](\d{1,2})[^\d](\d{1,2})/);
    if (numericMatch && numericMatch[1] && numericMatch[2] && numericMatch[3]) {
      return new Date(
        parseInt(numericMatch[1]),
        parseInt(numericMatch[2]) - 1,
        parseInt(numericMatch[3]),
      ).getTime();
    }

    // Try extracting just a year
    const yearMatch = dateStr.match(/(\d{4})/);
    if (yearMatch && yearMatch[1]) {
      return new Date(parseInt(yearMatch[1]), 0, 1).getTime();
    }

    // Unknown date format — push to end
    return Number.MAX_SAFE_INTEGER;
  }

  private normalizeIssues(rawIssues: unknown): LegalIssue[] {
    if (!Array.isArray(rawIssues) || rawIssues.length === 0) {
      return [{
        issue: '争议焦点待识别',
        legalBasis: [{ lawName: '待确定', description: '需要进一步分析以确定具体适用的法律' }],
        analysis: '需要进一步分析案件事实以识别争议焦点。',
      }];
    }

    return rawIssues
      .filter((i): i is Record<string, unknown> => i !== null && typeof i === 'object')
      .map(i => {
        const legalBasis = this.normalizeLawReferences(i.legalBasis);

        // Enforce: every issue must have at least one legal basis
        if (legalBasis.length === 0) {
          legalBasis.push({
            lawName: '待确定',
            description: '需要进一步分析以确定具体适用的法律',
          });
        }

        return {
          issue: typeof i.issue === 'string' && i.issue.trim() ? i.issue.trim() : '争议焦点待确认',
          legalBasis,
          analysis: typeof i.analysis === 'string' && i.analysis.trim()
            ? i.analysis.trim() : '法律分析待补充',
        };
      });
  }

  private normalizeStrategies(rawStrategies: unknown): CaseAnalysisResult['strategies'] {
    const strategies = rawStrategies as RawStrategies | undefined;

    return {
      plaintiff: this.normalizeStrategyAnalysis(strategies?.plaintiff, 'PLAINTIFF'),
      defendant: this.normalizeStrategyAnalysis(strategies?.defendant, 'DEFENDANT'),
      judge: this.normalizeJudgePerspective(strategies?.judge),
      overall: this.normalizeOverallStrategy(strategies?.overall),
    };
  }

  private normalizeStrategyAnalysis(
    raw: RawStrategyAnalysis | undefined,
    perspective: 'PLAINTIFF' | 'DEFENDANT' | 'JUDGE',
  ): StrategyAnalysis {
    if (!raw || typeof raw !== 'object') {
      return this.buildDefaultStrategy(perspective);
    }

    const keyArguments = this.normalizeStringArray(raw.keyArguments);
    if (keyArguments.length === 0) {
      keyArguments.push(`${perspective === 'PLAINTIFF' ? '原告' : perspective === 'DEFENDANT' ? '被告' : '法官'}论证要点待分析`);
    }

    const legalBasis = this.normalizeLawReferences(raw.legalBasis);

    return {
      perspective,
      keyArguments,
      legalBasis,
      riskAssessment: typeof raw.riskAssessment === 'string' && raw.riskAssessment.trim()
        ? raw.riskAssessment.trim() : '风险评估待完成',
    };
  }

  private normalizeJudgePerspective(raw: RawJudgePerspective | undefined): JudgePerspective {
    const base = this.normalizeStrategyAnalysis(raw, 'JUDGE');

    const likelyRuling = raw && typeof raw.likelyRuling === 'string' && raw.likelyRuling.trim()
      ? raw.likelyRuling.trim() : '裁判倾向待分析';

    const keyConsiderations = raw ? this.normalizeStringArray(raw.keyConsiderations) : [];
    if (keyConsiderations.length === 0) {
      keyConsiderations.push('关键考量因素待分析');
    }

    return {
      ...base,
      perspective: 'JUDGE' as const,
      likelyRuling,
      keyConsiderations,
    };
  }

  private normalizeOverallStrategy(raw: RawOverallStrategy | undefined): OverallStrategy {
    if (!raw || typeof raw !== 'object') {
      return {
        recommendation: '综合策略建议待生成',
        riskLevel: 'MEDIUM',
        nextSteps: ['建议咨询专业律师进行详细分析'],
      };
    }

    const nextSteps = this.normalizeStringArray(raw.nextSteps);
    if (nextSteps.length === 0) {
      nextSteps.push('建议咨询专业律师进行详细分析');
    }

    return {
      recommendation: typeof raw.recommendation === 'string' && raw.recommendation.trim()
        ? raw.recommendation.trim() : '综合策略建议待生成',
      riskLevel: this.normalizeRiskLevel(raw.riskLevel),
      nextSteps,
    };
  }

  private normalizeStrategyResult(raw: RawLitigationStrategyResponse): LitigationStrategy {
    const strategies = this.normalizeStrategyArray(raw.strategies);

    return {
      strategies,
      recommendation: typeof raw.recommendation === 'string' && raw.recommendation.trim()
        ? raw.recommendation.trim() : '诉讼策略建议待生成',
      estimatedOutcome: typeof raw.estimatedOutcome === 'string' && raw.estimatedOutcome.trim()
        ? raw.estimatedOutcome.trim() : '案件结果预估待分析',
    };
  }

  private normalizeStrategyArray(rawStrategies: unknown): StrategyAnalysis[] {
    if (!Array.isArray(rawStrategies) || rawStrategies.length === 0) {
      return [this.buildDefaultStrategy('PLAINTIFF')];
    }

    return rawStrategies
      .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
      .map(s => {
        const perspective = this.normalizePerspective(s.perspective);
        const keyArguments = this.normalizeStringArray(s.keyArguments);
        if (keyArguments.length === 0) {
          keyArguments.push('论证要点待分析');
        }

        return {
          perspective,
          keyArguments,
          legalBasis: this.normalizeLawReferences(s.legalBasis),
          riskAssessment: typeof s.riskAssessment === 'string' && s.riskAssessment.trim()
            ? s.riskAssessment.trim() : '风险评估待完成',
        };
      });
  }

  // ─── Utility Helpers ────────────────────────────────────

  private normalizeLawReferences(refs: unknown): LawReference[] {
    if (!Array.isArray(refs)) return [];
    return refs
      .filter((ref): ref is Record<string, unknown> => ref !== null && typeof ref === 'object')
      .map(ref => ({
        lawName: typeof ref.lawName === 'string' && ref.lawName.trim()
          ? ref.lawName.trim() : '相关法律',
        articleNumber: typeof ref.articleNumber === 'string' && ref.articleNumber.trim()
          ? ref.articleNumber.trim() : undefined,
        description: typeof ref.description === 'string' ? ref.description.trim() : '',
      }));
  }

  private normalizeStringArray(arr: unknown): string[] {
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map(item => item.trim());
  }

  private normalizePerspective(value: unknown): 'PLAINTIFF' | 'DEFENDANT' | 'JUDGE' {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper === 'PLAINTIFF' || upper === 'DEFENDANT' || upper === 'JUDGE') {
        return upper;
      }
    }
    return 'PLAINTIFF';
  }

  private normalizeRiskLevel(value: unknown): string {
    if (typeof value === 'string') {
      const upper = value.toUpperCase();
      if (upper === 'HIGH' || upper === 'MEDIUM' || upper === 'LOW') {
        return upper;
      }
    }
    return 'MEDIUM';
  }

  private buildDefaultStrategy(perspective: 'PLAINTIFF' | 'DEFENDANT' | 'JUDGE'): StrategyAnalysis {
    const labels: Record<string, string> = {
      PLAINTIFF: '原告',
      DEFENDANT: '被告',
      JUDGE: '法官',
    };
    return {
      perspective,
      keyArguments: [`${labels[perspective]}策略分析待完成`],
      legalBasis: [],
      riskAssessment: '风险评估待完成',
    };
  }

  // ─── Degraded Responses ─────────────────────────────────

  private buildDegradedAnalysis(caseInfo: CaseSubmission): CaseAnalysisResult {
    return {
      timeline: [{ date: '未知日期', event: 'AI 服务暂时不可用，无法梳理案件时间线', legalSignificance: '请稍后重试' }],
      issues: [{
        issue: 'AI 服务暂时不可用，无法识别争议焦点',
        legalBasis: [{ lawName: '待确定', description: '请稍后重试以获取法律分析' }],
        analysis: '请稍后重试或咨询专业律师。',
      }],
      strategies: {
        plaintiff: { perspective: 'PLAINTIFF', keyArguments: ['AI 服务暂时不可用'], legalBasis: [], riskAssessment: '请稍后重试' },
        defendant: { perspective: 'DEFENDANT', keyArguments: ['AI 服务暂时不可用'], legalBasis: [], riskAssessment: '请稍后重试' },
        judge: { perspective: 'JUDGE', keyArguments: ['AI 服务暂时不可用'], legalBasis: [], riskAssessment: '请稍后重试', likelyRuling: '请稍后重试', keyConsiderations: ['请稍后重试'] },
        overall: { recommendation: 'AI 服务暂时不可用，建议咨询专业律师。', riskLevel: 'MEDIUM', nextSteps: ['请稍后重试', '建议咨询专业律师'] },
      },
    };
  }

  private buildDegradedStrategy(analysis: CaseAnalysisResult): LitigationStrategy {
    return {
      strategies: [
        analysis.strategies.plaintiff,
        analysis.strategies.defendant,
        { ...analysis.strategies.judge, perspective: 'JUDGE' as const },
      ],
      recommendation: 'AI 服务暂时不可用，建议咨询专业律师制定诉讼策略。',
      estimatedOutcome: '无法预估案件结果，请稍后重试。',
    };
  }
}

// ─── Raw Response Types ───────────────────────────────────

interface RawStrategyAnalysis {
  perspective?: string;
  keyArguments?: unknown;
  legalBasis?: unknown;
  riskAssessment?: string;
}

interface RawJudgePerspective extends RawStrategyAnalysis {
  likelyRuling?: string;
  keyConsiderations?: unknown;
}

interface RawOverallStrategy {
  recommendation?: string;
  riskLevel?: string;
  nextSteps?: unknown;
}

interface RawStrategies {
  plaintiff?: RawStrategyAnalysis;
  defendant?: RawStrategyAnalysis;
  judge?: RawJudgePerspective;
  overall?: RawOverallStrategy;
}

interface RawCaseAnalysisResponse {
  timeline?: unknown;
  issues?: unknown;
  strategies?: RawStrategies;
}

interface RawLitigationStrategyResponse {
  strategies?: unknown;
  recommendation?: string;
  estimatedOutcome?: string;
}

// ─── Singleton ──────────────────────────────────────────────

let analyzerInstance: CaseAnalyzer | null = null;

export function getCaseAnalyzer(): CaseAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new CaseAnalyzer();
  }
  return analyzerInstance;
}

export function resetCaseAnalyzer(): void {
  analyzerInstance = null;
}
