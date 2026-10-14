import { describe, expect, it } from 'vitest';

import { catalogEntry } from '../../../utils/testUtils/testCatalog';
import { similarDatasets, tablesRead } from '../similarDatasets';

const dataset = (assetId: string, assetName: string, physicalTables: any[]) =>
  catalogEntry('dataset', assetId, { assetName, metadata: { lineageData: { physicalTables } } });

const DATASETS = [
  dataset('ds-orders', 'Orders', [{ type: 'RELATIONAL', schema: 'gold', name: 'orders' }]),
  dataset('ds-orders-sql', 'Orders by region', [
    { type: 'CUSTOM_SQL', name: 'q', sqlTables: ['gold.orders', 'gold.regions'] },
  ]),
  dataset('ds-customers', 'Customers', [{ type: 'RELATIONAL', schema: 'gold', name: 'customers' }]),
  dataset('ds-upload', 'Upload', [{ type: 'S3' }]),
];

describe('similarDatasets', () => {
  it('reads a relational table as schema.table and a query as the tables it names', () => {
    expect(tablesRead({ kind: 'RELATIONAL', schema: 'Gold', name: 'Orders' })).toEqual([
      'gold.orders',
    ]);
    expect(
      tablesRead({
        kind: 'CUSTOM_SQL',
        name: 'q',
        sql: 'select * from "awsdatacatalog"."gold"."orders" o join gold.regions r on 1=1',
      })
    ).toEqual(['gold.orders', 'gold.regions']);
  });

  it('finds the datasets reading the same table, as a table or inside a query', () => {
    expect(similarDatasets(DATASETS, ['gold.orders'])).toEqual([
      { dataSetId: 'ds-orders', name: 'Orders', table: 'gold.orders', how: 'table' },
      { dataSetId: 'ds-orders-sql', name: 'Orders by region', table: 'gold.orders', how: 'sql' },
    ]);
  });

  it('matches through a catalog prefix and ignores other tables', () => {
    expect(
      similarDatasets(DATASETS, ['awsdatacatalog.gold.customers']).map((d) => d.dataSetId)
    ).toEqual(['ds-customers']);
    expect(similarDatasets(DATASETS, ['gold.nothing'])).toEqual([]);
    expect(similarDatasets(DATASETS, [])).toEqual([]);
  });
});
