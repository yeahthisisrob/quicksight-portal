import { describe, expect, it, vi } from 'vitest';

vi.mock('../../services/settings/SettingsStore', () => ({
  settingsStore: { getString: () => '' },
}));

import {
  mergeTags,
  parseTagPairs,
  parseTagStandards,
  readDefaultTags,
  tagStandardsSection,
} from '../tagStandards';

describe('tag standards', () => {
  it('reads "key: values" lines, skipping blanks and comments', () => {
    expect(
      parseTagStandards(
        'environment: dev, test, prod\n\n# owners are free text\nowner:\nlifecycle: draft,active'
      )
    ).toEqual([
      { key: 'environment', values: ['dev', 'test', 'prod'] },
      { key: 'owner', values: [] },
      { key: 'lifecycle', values: ['draft', 'active'] },
    ]);
  });

  it('reads "key=value" lines; a value may itself hold "="', () => {
    expect(parseTagPairs('lifecycle=draft\nquery=a=b\n=nokey')).toEqual([
      { key: 'lifecycle', value: 'draft' },
      { key: 'query', value: 'a=b' },
    ]);
    expect(
      readDefaultTags((k) => (k === 'authoring.defaultTags' ? 'lifecycle=draft' : ''))
    ).toEqual([{ key: 'lifecycle', value: 'draft' }]);
  });

  it('merges lists with the later winning on a key', () => {
    expect(
      mergeTags([{ key: 'lifecycle', value: 'draft' }], undefined, [
        { key: 'lifecycle', value: 'active' },
      ])
    ).toEqual([{ key: 'lifecycle', value: 'active' }]);
  });

  it('tells a model the keys and values, and to ask when nothing fits', () => {
    const text = tagStandardsSection(parseTagStandards('environment: dev, prod\nowner:'));
    expect(text).toContain('environment: one of dev, prod');
    expect(text).toContain('owner: any value');
    expect(text).toContain('ask which to use');
    expect(tagStandardsSection([])).toBe('');
  });
});
