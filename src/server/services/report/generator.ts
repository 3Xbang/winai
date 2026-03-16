/**
 * Report Generator (报告生成器)
 * Generates standardized six-section legal analysis reports.
 * Uses LLM Prompt engineering with structured JSON output.
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

import { getLLMGateway } from '@/server/services/llm/gateway';
import type { LLMMessage } from '@/server/services/llm/types';

// ─── Types ──────────────────────────────────────────────────

export interface AnalysisResult {
  jurisdiction: 'CHINA' | 'THAILAND' | 'DUAL';
  query: string;
  iracAnalysis?: string;
  caseAnalysis?: string;
  contractReview?: string;
  evidenceAssessment?: string;
  complianceAnnotation?: string;
}

export type ReportFormat = 'STANDARD' | 'DETAILED' | 'EXECUTIVE';

export interface LegalReport {
  id: string;
  title: string;
  summary: string;           // 核心结论摘要
  legalAnalysis: string;     // 法律依据分析
  strategyAdvice: string;    // 深度策略建议
  actionPlan: string[];      // 行动方案 (ordered array)
  caseReferences: string[];  // 类似案例参考
  disclaimer: string;        // 免责声明
  jurisdiction: 'CHINA' | 'THAILAND' | 'DUAL';
  generatedAt: Date;
  format: ReportFormat;
}

// ─── Constants ──────────────────────────────────────────────

const DEFAULT_DISCLAIMER = '本报告由AI法律专家系统自动生成，仅供参考，不构成正式法律意见。具体法律事务请咨询持牌律师。法律法规可能已发生变更，请核实最新规定。';

const FORMAT_INSTRUCTIONS: Record<ReportFormat, string> = {
  STANDARD: '请以标准详细程度生成报告，每个部分提供适中的分析深度（每部分200-400字）。',
  DETAILED: '请以最详细的程度生成报告，每个部分提供深入全面的分析（每部分400-800字），包含更多法条引用和案例分析。',
  EXECUTIVE: '请以精简摘要形式生成报告，每个部分提供核心要点（每部分100-200字），适合高管快速阅读。',
};

export const REPORT_SYSTEM_PROMPT = `你是一位精通中国法律和泰国法律的资深法律分析师，负责生成专业的法律分析报告。

## 你的任务
根据提供的法律分析结果，生成一份结构化的法律分析报告，包含六个核心部分。

## 报告结构要求

### 1. 核心结论摘要 (summary)
- 概括法律问题的核心结论
- 明确指出适用的法律管辖区
- 简要说明主要法律风险和建议方向

### 2. 法律依据分析 (legalAnalysis)
- 分别列出中国法和泰国法的具体法条引用（如适用）
- 引用格式：法律名称 + 条款编号 + 关键内容
- 分析法条对当前问题的适用性

### 3. 深度策略建议 (strategyAdvice)
- 提供针对性的法律策略建议
- 分析不同策略的利弊
- 给出推荐的最优策略

### 4. 行动方案 (actionPlan)
- 提供分步骤的具体操作指引
- 每个步骤必须清晰、可执行
- 按优先级和时间顺序排列
- 至少提供3个步骤

### 5. 类似案例参考 (caseReferences)
- 引用相关的类似案例
- 说明案例的裁判结果和参考价值
- 至少提供1个案例参考

### 6. 免责声明 (disclaimer)
- 说明报告仅供参考，不构成正式法律意见
- 建议咨询专业律师
- 提示法律法规可能已变更

## 输出格式（严格 JSON）
{
  "title": "报告标题",
  "summary": "核心结论摘要",
  "legalAnalysis": "法律依据分析",
  "strategyAdvice": "深度策略建议",
  "actionPlan": ["步骤1", "步骤2", "步骤3"],
  "caseReferences": ["案例1描述", "案例2描述"],
  "disclaimer": "免责声明"
}

## 重要规则
- 所有六个部分必须非空
- actionPlan 必须是有序数组，至少包含1个步骤
- disclaimer 必须始终包含"不构成正式法律意见"的表述
- 使用中文输出
- 根据管辖区标注适用的法律体系`;

export const REPORT_USER_PROMPT_TEMPLATE = `请根据以下法律分析结果生成专业法律报告。

{{formatInstruction}}

管辖区：{{jurisdiction}}

用户咨询：
{{query}}

{{analysisDetails}}

请严格按照 JSON 格式输出报告。`;

// ─── Report Generator ───────────────────────────────────────

export class ReportGenerator {
  private llm = getLLMGateway();

  /**
   * Generate a structured legal report from analysis results.
   */
  async generate(analysisResult: AnalysisResult, format: ReportFormat = 'STANDARD'): Promise<LegalReport> {
    const formatInstruction = FORMAT_INSTRUCTIONS[format] || FORMAT_INSTRUCTIONS.STANDARD;

    const analysisDetails = this.buildAnalysisDetails(analysisResult);

    const userPrompt = REPORT_USER_PROMPT_TEMPLATE
      .replace('{{formatInstruction}}', formatInstruction)
      .replace('{{jurisdiction}}', analysisResult.jurisdiction)
      .replace('{{query}}', analysisResult.query)
      .replace('{{analysisDetails}}', analysisDetails);

    const messages: LLMMessage[] = [
      { role: 'system', content: REPORT_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ];

    const response = await this.llm.chat(messages, {
      temperature: 0.3,
      responseFormat: 'json_object',
      maxTokens: 4000,
    });

    // Handle degraded response
    if (response.provider === 'fallback') {
      return this.buildDegradedReport(analysisResult, format);
    }

    const parsed = this.llm.parseJSON<RawReportResponse>(response);
    return this.normalizeReport(parsed, analysisResult, format);
  }

  /**
   * Export a report to PDF format.
   * Stub implementation — generates a simple HTML-based Buffer.
   */
  async exportPDF(report: LegalReport): Promise<Buffer> {
    const html = this.buildReportHTML(report);
    return Buffer.from(html, 'utf-8');
  }

  // ─── Private Helpers ────────────────────────────────────────

  private buildAnalysisDetails(result: AnalysisResult): string {
    const sections: string[] = [];

    if (result.iracAnalysis) {
      sections.push(`IRAC分析结果：\n${result.iracAnalysis}`);
    }
    if (result.caseAnalysis) {
      sections.push(`案件分析结果：\n${result.caseAnalysis}`);
    }
    if (result.contractReview) {
      sections.push(`合同审查结果：\n${result.contractReview}`);
    }
    if (result.evidenceAssessment) {
      sections.push(`证据评估结果：\n${result.evidenceAssessment}`);
    }
    if (result.complianceAnnotation) {
      sections.push(`合规标注：\n${result.complianceAnnotation}`);
    }

    return sections.length > 0
      ? `分析详情：\n${sections.join('\n\n')}`
      : '（无额外分析详情）';
  }

  private buildDegradedReport(analysisResult: AnalysisResult, format: ReportFormat): LegalReport {
    return {
      id: this.generateId(),
      title: '法律分析报告（降级模式）',
      summary: 'AI服务暂时不可用，无法生成完整分析。请稍后重试。',
      legalAnalysis: '法律依据分析暂不可用。',
      strategyAdvice: '策略建议暂不可用。',
      actionPlan: ['请稍后重试以获取完整的行动方案。'],
      caseReferences: ['暂无案例参考。'],
      disclaimer: DEFAULT_DISCLAIMER,
      jurisdiction: analysisResult.jurisdiction,
      generatedAt: new Date(),
      format,
    };
  }

  private normalizeReport(raw: RawReportResponse, analysisResult: AnalysisResult, format: ReportFormat): LegalReport {
    const summary = this.normalizeString(raw.summary, '核心结论摘要暂不可用。');
    const legalAnalysis = this.normalizeString(raw.legalAnalysis, '法律依据分析暂不可用。');
    const strategyAdvice = this.normalizeString(raw.strategyAdvice, '策略建议暂不可用。');
    const actionPlan = this.normalizeStringArray(raw.actionPlan, ['请咨询专业律师获取具体行动方案。']);
    const caseReferences = this.normalizeStringArray(raw.caseReferences, ['暂无相关案例参考。']);
    const disclaimer = this.normalizeString(raw.disclaimer, DEFAULT_DISCLAIMER);
    const title = this.normalizeString(raw.title, '法律分析报告');

    return {
      id: this.generateId(),
      title,
      summary,
      legalAnalysis,
      strategyAdvice,
      actionPlan,
      caseReferences,
      disclaimer,
      jurisdiction: analysisResult.jurisdiction,
      generatedAt: new Date(),
      format,
    };
  }

  private normalizeString(value: unknown, fallback: string): string {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    return fallback;
  }

  private normalizeStringArray(value: unknown, fallback: string[]): string[] {
    if (Array.isArray(value)) {
      const filtered = value
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim());
      if (filtered.length > 0) return filtered;
    }
    return fallback;
  }

  private generateId(): string {
    return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private buildReportHTML(report: LegalReport): string {
    const actionPlanItems = report.actionPlan
      .map((step, i) => `<li>${i + 1}. ${step}</li>`)
      .join('\n');

    const caseRefItems = report.caseReferences
      .map((ref) => `<li>${ref}</li>`)
      .join('\n');

    return `<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8"><title>${report.title}</title></head>
<body>
<h1>${report.title}</h1>
<p><strong>管辖区：</strong>${report.jurisdiction}</p>
<p><strong>生成时间：</strong>${report.generatedAt.toISOString()}</p>
<p><strong>报告格式：</strong>${report.format}</p>
<h2>一、核心结论摘要</h2><p>${report.summary}</p>
<h2>二、法律依据分析</h2><p>${report.legalAnalysis}</p>
<h2>三、深度策略建议</h2><p>${report.strategyAdvice}</p>
<h2>四、行动方案</h2><ol>${actionPlanItems}</ol>
<h2>五、类似案例参考</h2><ul>${caseRefItems}</ul>
<h2>六、免责声明</h2><p>${report.disclaimer}</p>
</body>
</html>`;
  }
}

/** Raw response shape from LLM (before normalization) */
interface RawReportResponse {
  title?: string;
  summary?: string;
  legalAnalysis?: string;
  strategyAdvice?: string;
  actionPlan?: string[];
  caseReferences?: string[];
  disclaimer?: string;
}

// ─── Singleton ──────────────────────────────────────────────

let generatorInstance: ReportGenerator | null = null;

export function getReportGenerator(): ReportGenerator {
  if (!generatorInstance) {
    generatorInstance = new ReportGenerator();
  }
  return generatorInstance;
}

export function resetReportGenerator(): void {
  generatorInstance = null;
}
