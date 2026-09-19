import { describe, expect, it } from 'vitest';

import { crossDatasetFilterColumns, crossDatasetFilterWarnings } from '../crossDatasetFilters';
import { sampleDefinition } from './fixtures';

describe('cross-dataset filters', () => {
  it('finds the columns of ALL_DATASETS filter groups only', () => {
    const definition = sampleDefinition();
    expect(crossDatasetFilterColumns(definition)).toEqual([
      { groupId: 'fg1', identifier: 'orders', columnName: 'status' },
    ]);
    definition.FilterGroups[0].CrossDataset = 'SINGLE_DATASET';
    expect(crossDatasetFilterColumns(definition)).toEqual([]);
  });

  it('warns for every dataset the filter cannot reach, and stays quiet when all have the column', () => {
    const definition = sampleDefinition();
    expect(
      crossDatasetFilterWarnings(
        definition,
        new Map([
          ['orders', new Set(['status', 'revenue'])],
          ['regions', new Set(['region_name'])],
        ])
      )
    ).toEqual([
      "The filter on status (orders) applies to every dataset by column name, but 'regions' has no column 'status', so it will not be filtered.",
    ]);
    expect(
      crossDatasetFilterWarnings(
        definition,
        new Map([
          ['orders', new Set(['status'])],
          ['regions', new Set(['status', 'region_name'])],
        ])
      )
    ).toEqual([]);
  });
});
