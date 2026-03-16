/**
 * Prompt Template Engine
 * Manages prompt templates from the database with caching and variable substitution.
 * Falls back to hardcoded templates if the DB is unavailable.
 */

import prisma from '@/lib/prisma';
import type { PromptTemplateData } from './types';

/** In-memory cache for prompt templates */
const templateCache = new Map<string, { data: PromptTemplateData; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Hardcoded fallback templates for critical operations */
const FALLBACK_TEMPLATES: Record<string, PromptTemplateData> = {
  jurisdiction_identifier: {
    name: 'jurisdiction_identifier',
    category: 'legal_analysis',
    systemPrompt:
      '你是一位精通中国法律和泰国法律的资深法律专家。请根据用户的咨询内容，判断适用的法律管辖区。',
    userPromptTemplate:
      '请分析以下法律咨询内容，确定适用的法律管辖区（CHINA、THAILAND 或 DUAL）：\n\n{{query}}',
    variables: { query: '用户咨询内容' },
    version: 1,
    isActive: true,
  },
  irac_analysis: {
    name: 'irac_analysis',
    category: 'legal_analysis',
    systemPrompt:
      '你是一位采用 IRAC 方法论的法律分析专家。请严格按照 Issue（争议焦点）、Rule（法律规则）、Analysis（法律分析）、Conclusion（结论）四个步骤进行分析。在 Rule 步骤中必须引用具体的法律条文编号和名称。',
    userPromptTemplate:
      '请对以下法律问题进行 IRAC 分析：\n\n管辖区：{{jurisdiction}}\n\n问题描述：{{query}}',
    variables: { jurisdiction: '管辖区', query: '法律问题描述' },
    version: 1,
    isActive: true,
  },
  contract_draft: {
    name: 'contract_draft',
    category: 'contract',
    systemPrompt:
      '你是一位专业的合同起草律师，精通中国和泰国合同法。请根据用户提供的信息起草合同。',
    userPromptTemplate:
      '请起草以下类型的合同：\n\n合同类型：{{contractType}}\n当事人信息：{{parties}}\n关键条款：{{keyTerms}}\n语言：{{languages}}\n管辖区：{{jurisdiction}}',
    variables: {
      contractType: '合同类型',
      parties: '当事人信息',
      keyTerms: '关键条款',
      languages: '语言',
      jurisdiction: '管辖区',
    },
    version: 1,
    isActive: true,
  },
};

export class PromptEngine {
  /**
   * Get a template by name. Checks cache first, then DB, then fallback.
   */
  async getTemplate(name: string): Promise<PromptTemplateData | null> {
    // 1. Check cache
    const cached = templateCache.get(name);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    // 2. Try database
    try {
      const dbTemplate = await prisma.promptTemplate.findFirst({
        where: { name, isActive: true },
      });

      if (dbTemplate) {
        const data: PromptTemplateData = {
          name: dbTemplate.name,
          category: dbTemplate.category,
          systemPrompt: dbTemplate.systemPrompt,
          userPromptTemplate: dbTemplate.userPromptTemplate,
          variables: (dbTemplate.variables as Record<string, string>) ?? null,
          version: dbTemplate.version,
          isActive: dbTemplate.isActive,
        };
        templateCache.set(name, { data, cachedAt: Date.now() });
        return data;
      }
    } catch (error) {
      console.warn(`Failed to load template "${name}" from DB, using fallback:`, (error as Error).message);
    }

    // 3. Fallback to hardcoded templates
    const fallback = FALLBACK_TEMPLATES[name] ?? null;
    if (fallback) {
      templateCache.set(name, { data: fallback, cachedAt: Date.now() });
    }
    return fallback;
  }

  /**
   * Render a user prompt by substituting {{variableName}} placeholders.
   */
  async renderPrompt(templateName: string, variables: Record<string, string>): Promise<string> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Prompt template "${templateName}" not found`);
    }
    return this.substituteVariables(template.userPromptTemplate, variables);
  }

  /**
   * Render the system prompt by substituting {{variableName}} placeholders.
   */
  async renderSystemPrompt(templateName: string, variables: Record<string, string> = {}): Promise<string> {
    const template = await this.getTemplate(templateName);
    if (!template) {
      throw new Error(`Prompt template "${templateName}" not found`);
    }
    return this.substituteVariables(template.systemPrompt, variables);
  }

  /**
   * Replace all {{variableName}} occurrences in a template string.
   */
  private substituteVariables(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
      return variables[varName] !== undefined ? variables[varName] : match;
    });
  }

  /**
   * Clear the template cache (useful for testing or after admin updates).
   */
  clearCache(): void {
    templateCache.clear();
  }
}

/** Singleton instance */
let engineInstance: PromptEngine | null = null;

export function getPromptEngine(): PromptEngine {
  if (!engineInstance) {
    engineInstance = new PromptEngine();
  }
  return engineInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetPromptEngine(): void {
  engineInstance = null;
}
