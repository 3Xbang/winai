/**
 * Unit tests for AI Lawyer Team — Role Definitions
 * Requirements: 23.1, 23.2
 */

import { describe, it, expect } from 'vitest';
import {
  LAWYER_AGENTS,
  ALL_ROLES,
  getAgent,
  getAllAgents,
  getRolePromptTemplates,
  type LawyerRole,
} from '@/server/services/ai/lawyer-team/roles';

describe('AI Lawyer Team — Roles', () => {
  it('defines exactly 4 roles', () => {
    expect(ALL_ROLES).toHaveLength(4);
    expect(ALL_ROLES).toContain('PLAINTIFF_LAWYER');
    expect(ALL_ROLES).toContain('DEFENDANT_LAWYER');
    expect(ALL_ROLES).toContain('JUDGE');
    expect(ALL_ROLES).toContain('LEGAL_ADVISOR');
  });

  it('each role has complete LawyerAgent config', () => {
    for (const role of ALL_ROLES) {
      const agent = LAWYER_AGENTS[role];
      expect(agent.role).toBe(role);
      expect(agent.name).toBeTruthy();
      expect(agent.systemPrompt).toBeTruthy();
      expect(agent.analysisStyle).toBeTruthy();
    }
  });

  it('PLAINTIFF_LAWYER prompt focuses on evidence attack and damages', () => {
    const agent = getAgent('PLAINTIFF_LAWYER');
    expect(agent.systemPrompt).toContain('证据攻击力');
    expect(agent.systemPrompt).toContain('损害赔偿');
    expect(agent.systemPrompt).toContain('原告');
    expect(agent.analysisStyle).toContain('证据攻击力');
  });

  it('DEFENDANT_LAWYER prompt focuses on procedural flaws and evidence defects', () => {
    const agent = getAgent('DEFENDANT_LAWYER');
    expect(agent.systemPrompt).toContain('程序瑕疵');
    expect(agent.systemPrompt).toContain('证据缺陷');
    expect(agent.systemPrompt).toContain('逻辑漏洞');
    expect(agent.analysisStyle).toContain('程序瑕疵');
  });

  it('JUDGE prompt focuses on legal application and consistency', () => {
    const agent = getAgent('JUDGE');
    expect(agent.systemPrompt).toContain('法律条文');
    expect(agent.systemPrompt).toContain('裁判一致性');
    expect(agent.systemPrompt).toContain('客观中立');
    expect(agent.analysisStyle).toContain('法律条文适用');
  });

  it('LEGAL_ADVISOR prompt focuses on cost-benefit and alternatives', () => {
    const agent = getAgent('LEGAL_ADVISOR');
    expect(agent.systemPrompt).toContain('成本效益');
    expect(agent.systemPrompt).toContain('替代');
    expect(agent.systemPrompt).toContain('和解');
    expect(agent.analysisStyle).toContain('成本效益');
  });

  it('all prompts require JSON output format', () => {
    for (const role of ALL_ROLES) {
      const agent = getAgent(role);
      expect(agent.systemPrompt).toContain('JSON');
      expect(agent.systemPrompt).toContain('argument');
      expect(agent.systemPrompt).toContain('rebuttal');
    }
  });

  it('all prompts require citing specific legal articles', () => {
    for (const role of ALL_ROLES) {
      const agent = getAgent(role);
      expect(agent.systemPrompt).toContain('法条');
    }
  });

  it('getAgent returns correct agent for each role', () => {
    const roles: LawyerRole[] = ['PLAINTIFF_LAWYER', 'DEFENDANT_LAWYER', 'JUDGE', 'LEGAL_ADVISOR'];
    for (const role of roles) {
      expect(getAgent(role).role).toBe(role);
    }
  });

  it('getAllAgents returns all 4 agents', () => {
    const agents = getAllAgents();
    expect(agents).toHaveLength(4);
    const roles = agents.map((a) => a.role);
    expect(roles).toContain('PLAINTIFF_LAWYER');
    expect(roles).toContain('DEFENDANT_LAWYER');
    expect(roles).toContain('JUDGE');
    expect(roles).toContain('LEGAL_ADVISOR');
  });

  it('getRolePromptTemplates returns DB-compatible templates', () => {
    const templates = getRolePromptTemplates();
    expect(templates).toHaveLength(4);
    for (const t of templates) {
      expect(t.name).toMatch(/^lawyer-team-/);
      expect(t.category).toBe('lawyer-team');
      expect(t.systemPrompt).toBeTruthy();
      expect(t.variables).toBeNull();
      expect(t.version).toBe(1);
      expect(t.isActive).toBe(true);
    }
  });

  it('each role has a unique name and system prompt', () => {
    const agents = getAllAgents();
    const names = agents.map((a) => a.name);
    const prompts = agents.map((a) => a.systemPrompt);
    expect(new Set(names).size).toBe(4);
    expect(new Set(prompts).size).toBe(4);
  });
});
