import { describe, expect, it } from 'vitest';

import type { SettingsSnapshot } from '@/shared/api/modules/settings';

import {
  changedKeys,
  displayValue,
  isDirty,
  settingsFormReducer,
  toUpdate,
  valuesEqual,
} from '../settingsForm';

const snapshot: SettingsSnapshot = {
  groups: [
    {
      id: 'smus',
      title: 'SMUS',
      description: '',
      settings: [
        {
          key: 'smus.domainId',
          label: 'Domain',
          description: '',
          type: 'string',
          value: 'dzd_stored',
          source: 'stored',
          envVar: 'SMUS_DOMAIN_ID',
          sensitive: false,
        },
        {
          key: 'smus.region',
          label: 'Region',
          description: '',
          type: 'string',
          value: 'us-east-1',
          source: 'env',
          envVar: 'SMUS_DOMAIN_REGION',
          sensitive: false,
        },
        {
          key: 'smus.projectIds',
          label: 'Projects',
          description: '',
          type: 'multiselect',
          value: ['p1', 'p2'],
          source: 'stored',
          sensitive: false,
        },
      ],
    },
  ],
};

const reduce = (
  draft: Parameters<typeof settingsFormReducer>[0],
  action: Parameters<typeof settingsFormReducer>[1]
) => settingsFormReducer(draft, action, snapshot);

describe('settingsFormReducer', () => {
  it('records a new value and counts it as a change', () => {
    const draft = reduce({}, { type: 'set', key: 'smus.domainId', value: 'dzd_new' });
    expect(draft).toEqual({ 'smus.domainId': 'dzd_new' });
    expect(isDirty(draft)).toBe(true);
    expect(changedKeys(draft)).toEqual(['smus.domainId']);
  });

  it('drops the key when a stored value is typed back to what the server has', () => {
    const draft = reduce(
      { 'smus.domainId': 'dzd_new' },
      { type: 'set', key: 'smus.domainId', value: 'dzd_stored' }
    );
    expect(draft).toEqual({});
  });

  it('treats the same value as a change when it currently comes from the environment', () => {
    // Storing it pins the value, which is a real change even if nothing looks different.
    const draft = reduce({}, { type: 'set', key: 'smus.region', value: 'us-east-1' });
    expect(draft).toEqual({ 'smus.region': 'us-east-1' });
  });

  it('compares lists regardless of order', () => {
    expect(valuesEqual(['a', 'b'], ['b', 'a'])).toBe(true);
    const draft = reduce({}, { type: 'set', key: 'smus.projectIds', value: ['p2', 'p1'] });
    expect(draft).toEqual({});
  });

  it('reset clears a stored value with null, and is a no-op for env-sourced ones', () => {
    expect(reduce({}, { type: 'reset', key: 'smus.domainId' })).toEqual({ 'smus.domainId': null });
    expect(reduce({ 'smus.region': 'x' }, { type: 'reset', key: 'smus.region' })).toEqual({});
  });

  it('revert and discard forget draft entries', () => {
    const draft = { 'smus.domainId': 'a', 'smus.region': 'b' };
    expect(reduce(draft, { type: 'revert', key: 'smus.domainId' })).toEqual({ 'smus.region': 'b' });
    expect(reduce(draft, { type: 'discard' })).toEqual({});
  });
});

describe('displayValue and toUpdate', () => {
  it('shows the draft when touched, the server value otherwise', () => {
    const definition = snapshot.groups[0]!.settings[0]!;
    expect(displayValue(definition, {})).toBe('dzd_stored');
    expect(displayValue(definition, { 'smus.domainId': 'dzd_new' })).toBe('dzd_new');
    expect(displayValue(definition, { 'smus.domainId': null })).toBeNull();
  });

  it('sends exactly the draft, nulls included', () => {
    expect(toUpdate({ 'smus.domainId': null, 'smus.projectIds': ['p1'] })).toEqual({
      values: { 'smus.domainId': null, 'smus.projectIds': ['p1'] },
    });
  });
});
