import { describe, expect, it, vi } from 'vitest';

const values = new Map<string, string>();
vi.mock('../SettingsStore', () => ({
  settingsStore: { get: (key: string) => values.get(key) },
}));

import { defaultApplyMode, defaultImportMode } from '../authoringDefaults';

describe('authoring defaults', () => {
  it('make changes on a copy and hold data in SPICE unless an admin chose otherwise', () => {
    expect(defaultApplyMode()).toBe('clone');
    expect(defaultImportMode()).toBe('SPICE');
    values.set('authoring.editMode', 'inPlace');
    values.set('authoring.datasetImportMode', 'DIRECT_QUERY');
    expect(defaultApplyMode()).toBe('update');
    expect(defaultImportMode()).toBe('DIRECT_QUERY');
    values.set('authoring.editMode', 'nonsense');
    expect(defaultApplyMode()).toBe('clone');
  });
});
