import { beforeEach, describe, expect, it } from 'vitest';

import type { SmusDatasetLink } from '../../../types/smus';
import { catalogEntry, useTestCatalog } from '../../../utils/testUtils/testCatalog';
import { defaultAthenaDataSource, listDataSourceUsage } from '../dataSourceUsage';

const { seed } = useTestCatalog();

const source = (assetId: string, assetName: string, metadata: Record<string, unknown>) =>
  catalogEntry('datasource', assetId, { assetName, metadata });
const dataset = (assetId: string, datasourceIds: string[]) =>
  catalogEntry('dataset', assetId, { metadata: { lineageData: { datasourceIds } } });

const linked = (ids: string[]): Map<string, SmusDatasetLink> =>
  new Map(ids.map((id) => [id, { datasetId: id, linked: true }]));

describe('dataSourceUsage', () => {
  beforeEach(() =>
    seed([
      source('athena-old', 'Athena (old)', { sourceType: 'ATHENA', workGroup: 'legacy' }),
      source('athena-1', 'Athena', { sourceType: 'ATHENA', workGroup: 'primary' }),
      source('rs', 'Redshift', { sourceType: 'REDSHIFT' }),
      dataset('governed', ['athena-1']),
      dataset('adhoc-1', ['athena-old']),
      dataset('adhoc-2', ['athena-old']),
      dataset('warehouse', ['rs']),
    ])
  );

  it('ranks governed use first, then overall use, and carries the engine and workgroup', async () => {
    const usage = await listDataSourceUsage(linked(['governed']));
    expect(usage).toEqual([
      expect.objectContaining({
        id: 'athena-1',
        type: 'ATHENA',
        workGroup: 'primary',
        datasets: 1,
        governedDatasets: 1,
      }),
      expect.objectContaining({ id: 'athena-old', datasets: 2, governedDatasets: 0 }),
      expect.objectContaining({ id: 'rs', type: 'REDSHIFT', datasets: 1, governedDatasets: 0 }),
    ]);
    expect(defaultAthenaDataSource(usage)).toMatchObject({
      dataSource: { id: 'athena-1' },
      reason: 'used by 1 dataset linked to SMUS listings',
    });
  });

  it('falls back to overall use without SMUS, and says when there is no Athena source', async () => {
    const usage = await listDataSourceUsage(new Map());
    expect(usage.map((d) => d.id)).toEqual(['athena-old', 'athena-1', 'rs']);
    expect(defaultAthenaDataSource(usage)?.reason).toBe(
      'the Athena data source most datasets read through (2); no SMUS-linked dataset reads one yet'
    );
    expect(defaultAthenaDataSource(usage.filter((d) => d.type !== 'ATHENA'))).toBeNull();
  });
});
