import { describe, expect, it } from 'vitest';

import {
  type AuthoringGuidance,
  guidanceSection,
  readAuthoringGuidance,
} from '../authoringGuidance';

const EMPTY: AuthoringGuidance = {
  fieldStrategy: 'none',
  architecture: '',
  datasets: '',
  explorations: '',
  visuals: '',
};

describe('authoring guidance', () => {
  it('says nothing when nothing is configured', () => {
    expect(guidanceSection(EMPTY, ['datasets'])).toBe('');
  });

  it('carries the calculated-field naming standard for both places a field can live', () => {
    const section = guidanceSection(
      { ...EMPTY, calcFieldPrefix: 'c_', datasetCalcFieldPrefix: 'c_ds_' },
      ['datasets']
    );
    expect(section).toContain('"c_" for calculated fields defined in an analysis or dashboard');
    expect(section).toContain('"c_ds_" for calculated fields defined in a dataset');
  });

  it('reads the prefixes from settings', () => {
    const values: Record<string, string> = {
      'guidance.calcFieldPrefix': 'c_',
      'guidance.datasetCalcFieldPrefix': ' c_ds_ ',
    };
    const guidance = readAuthoringGuidance((key) => values[key] ?? '');
    expect(guidance.calcFieldPrefix).toBe('c_');
    expect(guidance.datasetCalcFieldPrefix).toBe('c_ds_');
  });
});
