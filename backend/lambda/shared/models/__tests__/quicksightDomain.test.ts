import { describe, expect, it } from 'vitest';

import { getAssetId, getAssetName } from '../quicksight-domain.model';

const base = { arn: 'arn:x', createdTime: new Date(0), lastUpdatedTime: new Date(0) };

describe('asset summaries', () => {
  it('names and identifies every kind the export lists, themes included', () => {
    expect(getAssetId({ ...base, dashboardId: 'd1', name: 'Sales' } as any)).toBe('d1');
    expect(getAssetId({ ...base, analysisId: 'a1', name: 'Sales' } as any)).toBe('a1');
    expect(getAssetId({ ...base, dataSetId: 'ds1', name: 'Orders' } as any)).toBe('ds1');
    expect(getAssetId({ ...base, dataSourceId: 'src1', name: 'Athena' } as any)).toBe('src1');
    expect(getAssetId({ ...base, folderId: 'f1', name: 'Finance' } as any)).toBe('f1');
    expect(getAssetId({ ...base, themeId: 't1', name: 'Brand' } as any)).toBe('t1');
    expect(getAssetName({ ...base, themeId: 't1', name: 'Brand' } as any)).toBe('Brand');
    expect(getAssetId({ ...base, userName: 'pat', email: 'pat@example.com' } as any)).toBe('pat');
    expect(getAssetId({ ...base, groupName: 'finance' } as any)).toBe('finance');
  });

  it('says what it was given when it is none of them', () => {
    expect(() => getAssetId({ ...base, widgetId: 'w' } as any)).toThrow(
      'Unknown asset type: a summary with arn, createdTime, lastUpdatedTime, widgetId'
    );
  });
});
