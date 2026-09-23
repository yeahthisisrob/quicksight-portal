import { describe, expect, it } from 'vitest';

import {
  DATASET_OWNER_ACTIONS,
  DATASET_VIEWER_ACTIONS,
  datasetPermissionsFor,
  normalizePermissionsArray,
} from '../permissions';

describe('normalizePermissionsArray', () => {
  it('unwraps a describe response and passes an array through', () => {
    const entries = [{ Principal: 'arn:user/rob', Actions: ['quicksight:DescribeDashboard'] }];
    expect(normalizePermissionsArray({ Permissions: entries })).toBe(entries);
    expect(normalizePermissionsArray(entries)).toBe(entries);
    expect(normalizePermissionsArray(undefined)).toEqual([]);
  });
});

describe('datasetPermissionsFor', () => {
  it('makes owners of the asset owners of the dataset and everyone else a reader', () => {
    const grants = datasetPermissionsFor({
      Permissions: [
        {
          Principal: 'arn:user/rob',
          Actions: ['quicksight:DescribeAnalysis', 'quicksight:UpdateAnalysis'],
        },
        { Principal: 'arn:group/readers', Actions: ['quicksight:DescribeAnalysis'] },
        { Principal: 'arn:user/janitor', Actions: ['quicksight:DeleteDashboard'] },
      ],
    });
    expect(grants).toEqual([
      { Principal: 'arn:user/rob', Actions: DATASET_OWNER_ACTIONS },
      { Principal: 'arn:group/readers', Actions: DATASET_VIEWER_ACTIONS },
      { Principal: 'arn:user/janitor', Actions: DATASET_OWNER_ACTIONS },
    ]);
    expect(DATASET_OWNER_ACTIONS).toEqual(expect.arrayContaining(DATASET_VIEWER_ACTIONS));
  });

  it('leaves out link sharing and malformed entries: a dataset has no public link', () => {
    expect(
      datasetPermissionsFor([
        { Principal: '*', Actions: ['quicksight:DescribeDashboard'] },
        { Actions: ['quicksight:DescribeDashboard'] },
        { Principal: '', Actions: [] },
        { Principal: 'arn:user/rob' },
      ])
    ).toEqual([{ Principal: 'arn:user/rob', Actions: DATASET_VIEWER_ACTIONS }]);
    expect(datasetPermissionsFor(undefined)).toEqual([]);
  });
});
