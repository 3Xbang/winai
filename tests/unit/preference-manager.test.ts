/**
 * Tests for User Preference Manager
 * Task 33.1 — 用户偏好管理与术语适配
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getUserPreferences,
  updatePreferences,
  getTerminologyLevel,
  buildPreferencePromptInjection,
  clearPreferences,
} from '@/server/services/ai/personalization/preference-manager';

beforeEach(() => {
  clearPreferences();
});

describe('getUserPreferences', () => {
  it('returns defaults for unknown user', () => {
    const prefs = getUserPreferences('user-new');
    expect(prefs.userId).toBe('user-new');
    expect(prefs.terminologyLevel).toBe('LAYPERSON');
    expect(prefs.responseStyle).toBe('detailed');
  });
});

describe('updatePreferences', () => {
  it('updates and persists preferences', () => {
    updatePreferences('user-1', { terminologyLevel: 'EXPERT', preferredLanguage: 'en' });
    const prefs = getUserPreferences('user-1');
    expect(prefs.terminologyLevel).toBe('EXPERT');
    expect(prefs.preferredLanguage).toBe('en');
    expect(prefs.responseStyle).toBe('detailed'); // unchanged
  });

  it('returns updated preferences', () => {
    const result = updatePreferences('user-2', { responseStyle: 'concise' });
    expect(result.responseStyle).toBe('concise');
    expect(result.userId).toBe('user-2');
  });
});

describe('getTerminologyLevel', () => {
  it('returns default LAYPERSON', () => {
    expect(getTerminologyLevel('unknown')).toBe('LAYPERSON');
  });

  it('returns updated level', () => {
    updatePreferences('user-3', { terminologyLevel: 'PROFESSIONAL' });
    expect(getTerminologyLevel('user-3')).toBe('PROFESSIONAL');
  });
});

describe('buildPreferencePromptInjection', () => {
  it('generates layperson prompt', () => {
    const injection = buildPreferencePromptInjection('new-user');
    expect(injection).toContain('通俗易懂');
  });

  it('generates expert prompt', () => {
    updatePreferences('expert', { terminologyLevel: 'EXPERT', responseStyle: 'concise' });
    const injection = buildPreferencePromptInjection('expert');
    expect(injection).toContain('专业法律术语');
    expect(injection).toContain('简洁');
  });

  it('includes language preference', () => {
    updatePreferences('en-user', { preferredLanguage: 'en' });
    const injection = buildPreferencePromptInjection('en-user');
    expect(injection).toContain('English');
  });
});
