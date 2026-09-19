import { describe, expect, it } from 'vitest';

import {
  buildSnapshot,
  effectiveValue,
  resolveSetting,
  settingSpec,
  validateUpdate,
} from '../settingsCatalog';

describe('resolveSetting', () => {
  const projects = settingSpec('smus.projectIds')!;
  const provider = settingSpec('planner.provider')!;
  const apiKey = settingSpec('planner.apiKey')!;

  it('prefers a stored value, then env, then default, and says which won', () => {
    expect(
      resolveSetting(
        provider,
        { 'planner.provider': 'claude-cli' },
        { PLANNER_PROVIDER: 'bedrock' }
      )
    ).toMatchObject({ value: 'claude-cli', source: 'stored' });
    expect(resolveSetting(provider, {}, { PLANNER_PROVIDER: 'codex-cli' })).toMatchObject({
      value: 'codex-cli',
      source: 'env',
    });
    expect(resolveSetting(provider, {}, {})).toMatchObject({ value: 'bedrock', source: 'default' });
  });

  it('parses list env vars and ignores empty stored lists', () => {
    expect(
      resolveSetting(projects, { 'smus.projectIds': [] }, { SMUS_PROJECT_IDS: 'a, b,,c' })
    ).toMatchObject({ value: ['a', 'b', 'c'], source: 'env' });
  });

  it('never exposes a secret, only whether the env var is set', () => {
    expect(
      resolveSetting(apiKey, { 'planner.apiKey': 'leak' } as any, { PLANNER_API_KEY: 'k' })
    ).toMatchObject({
      value: true,
      source: 'env',
      sensitive: true,
    });
    expect(resolveSetting(apiKey, {}, {})).toMatchObject({ value: false, source: 'default' });
    expect(effectiveValue('planner.apiKey', {}, { PLANNER_API_KEY: 'k' })).toBeUndefined();
  });

  it('builds a grouped snapshot from the catalog', () => {
    const snapshot = buildSnapshot({}, {}, { updatedBy: 'rob' });
    expect(snapshot.groups.map((g) => g.id)).toEqual(['smus', 'planner']);
    expect(snapshot.updatedBy).toBe('rob');
    const spec = snapshot.groups[0]?.settings.find((s) => s.key === 'smus.projectIds');
    expect(spec?.optionsFrom).toBe('/api/settings/smus/projects');
    expect(spec).not.toHaveProperty('default');
  });
});

describe('validateUpdate', () => {
  it('normalises each type and passes null through as a clear', () => {
    expect(
      validateUpdate({
        'smus.domainId': ' dzd_1 ',
        'smus.projectIds': [' p1 ', '', 'p2'],
        'planner.provider': 'openai-compatible',
        'planner.modelId': null,
      })
    ).toEqual({
      'smus.domainId': 'dzd_1',
      'smus.projectIds': ['p1', 'p2'],
      'planner.provider': 'openai-compatible',
      'planner.modelId': null,
    });
  });

  it('rejects unknown keys, secrets, wrong types and bad choices', () => {
    expect(() => validateUpdate({ nope: 'x' })).toThrow("Unknown setting 'nope'");
    expect(() => validateUpdate({ 'planner.apiKey': 'k' })).toThrow('secret');
    expect(() => validateUpdate({ 'smus.projectIds': 'p1' })).toThrow('list of strings');
    expect(() => validateUpdate({ 'planner.provider': 'gemini' })).toThrow('must be one of');
    expect(() => validateUpdate({ 'smus.domainId': 5 })).toThrow('must be a string');
  });
});
