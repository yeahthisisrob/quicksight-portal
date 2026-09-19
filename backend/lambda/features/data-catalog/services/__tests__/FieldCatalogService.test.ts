import { beforeEach, describe, expect, it, vi } from 'vitest';

import { calculatedFieldKey, FieldCatalogService } from '../FieldCatalogService';

const field = (over: Record<string, unknown>) => ({
  fieldId: 'x',
  fieldName: 'f',
  dataType: 'STRING',
  isCalculated: false,
  sourceAssetType: 'dataset',
  sourceAssetId: 'ds-1',
  sourceAssetName: 'Orders (gold)',
  usageCount: 0,
  analysisCount: 0,
  dashboardCount: 0,
  lastUpdated: '',
  ...over,
});

// Dataset ds-1: revenue, cost, status, margin = revenue - cost, margin_pct.
// Dashboard d-1 reads revenue and margin (same expression) and defines its own
// margin_pct differently (a conflict). Analysis a-1 defines margin with spaces
// (same canonical expression) and a brand-new field nobody else has.
const DS1 = [
  field({ fieldName: 'revenue', dataType: 'DECIMAL', columnName: 'revenue' }),
  field({ fieldName: 'cost', dataType: 'DECIMAL', columnName: 'cost' }),
  field({ fieldName: 'status', columnName: 'status' }),
  field({
    fieldName: 'margin',
    dataType: 'DECIMAL',
    isCalculated: true,
    expression: '{revenue} - {cost}',
  }),
  field({
    fieldName: 'margin_pct',
    dataType: 'DECIMAL',
    isCalculated: true,
    expression: '{margin} / {revenue}',
  }),
];
const D1 = (over: Record<string, unknown>) =>
  field({
    sourceAssetType: 'dashboard',
    sourceAssetId: 'd-1',
    sourceAssetName: 'Sales',
    datasetId: 'ds-1',
    ...over,
  });
const A1 = (over: Record<string, unknown>) =>
  field({
    sourceAssetType: 'analysis',
    sourceAssetId: 'a-1',
    sourceAssetName: 'Draft',
    datasetId: 'ds-1',
    ...over,
  });

const USERS = {
  'ds-1::revenue': [
    D1({
      fieldName: 'revenue',
      visuals: [
        {
          visualId: 'v1',
          visualType: 'BarChartVisual',
          title: 'Revenue',
          sheetId: 's',
          sheetName: 'Overview',
        },
      ],
    }),
  ],
  'ds-1::margin': [
    D1({ fieldName: 'margin', isCalculated: true, expression: '{revenue} - {cost}' }),
    A1({ fieldName: 'margin', isCalculated: true, expression: '{revenue}-{cost}' }),
  ],
  'ds-1::margin_pct': [
    D1({
      fieldName: 'margin_pct',
      isCalculated: true,
      expression: 'ifelse({revenue} = 0, 0, {margin} / {revenue})',
    }),
  ],
  'ds-1::runway': [A1({ fieldName: 'runway', isCalculated: true, expression: '{cost} * 12' })],
};

const INDEX = {
  byDataset: new Map([['ds-1', DS1]]),
  usersOf: new Map(Object.entries(USERS)),
  visualsOf: new Map([
    [
      'ds-1::revenue',
      [
        {
          assetType: 'dashboard',
          assetId: 'd-1',
          assetName: 'Sales',
          sheetName: 'Overview',
          visualId: 'v1',
          visualName: 'Revenue',
        },
      ],
    ],
  ]),
  notes: new Map([
    [
      'ds-1::margin',
      {
        sourceType: 'dataset',
        sourceId: 'ds-1',
        fieldName: 'margin',
        description: 'Gross margin before returns',
      },
    ],
  ]),
  templates: new Map([['{revenue}-{cost}', 't-margin']]),
};

const ASSETS = [
  {
    listingId: 'l-orders',
    assetId: 'a-orders',
    name: 'orders_gold',
    projectId: 'p-prod',
    projectName: 'analytics_prod',
    url: 'https://smus/catalog/assets/l-orders',
    columns: [
      { name: 'revenue', type: 'decimal', description: 'Recognised revenue' },
      { name: 'cost', type: 'decimal' },
      { name: 'status', type: 'string' },
    ],
    glossaryTerms: [{ name: 'Revenue' }],
    forms: [],
    datasets: [{ id: 'ds-1', name: 'Orders (gold)', matchType: 'source-table' }],
  },
];

describe('FieldCatalogService', () => {
  const smus = { listAssets: vi.fn() };
  const catalog = { getFieldIndex: vi.fn() };
  const service = () => new FieldCatalogService(smus as any, catalog as any);

  beforeEach(() => {
    vi.clearAllMocks();
    smus.listAssets.mockResolvedValue({
      configured: true,
      projectFilter: ['p-prod'],
      assets: ASSETS,
      exportedAt: '2026-09-19T00:00:00Z',
    });
    catalog.getFieldIndex.mockResolvedValue(INDEX);
  });

  it('lists every calculated field once per distinct expression, with definers, usage, conflicts and templates', async () => {
    const result = await service().calculatedFields();

    expect(result.counts).toEqual({
      fields: 4,
      names: 3,
      conflicts: 1,
      templated: 1,
      unused: 0,
      datasets: 1,
    });
    const byName = Object.fromEntries(result.items.map((i) => [`${i.name}:${i.expression}`, i]));

    const margin = byName['margin:{revenue} - {cost}']!;
    expect(margin.definedIn.map((d) => `${d.type}:${d.id}`).sort()).toEqual([
      'analysis:a-1',
      'dashboard:d-1',
      'dataset:ds-1',
    ]);
    expect(margin.datasets[0]).toMatchObject({
      id: 'ds-1',
      name: 'Orders (gold)',
      listing: { listingId: 'l-orders', projectName: 'analytics_prod' },
    });
    expect(margin.usedBy).toEqual({ dashboards: 1, analyses: 1, visuals: 0 });
    expect(margin.template).toEqual({ id: 't-margin' });
    expect(margin.hasNote).toBe(true);
    expect(margin.conflict).toBeUndefined();

    const pct = result.items.filter((i) => i.name === 'margin_pct');
    expect(pct).toHaveLength(2);
    expect(pct.every((i) => i.conflict?.variants === 1)).toBe(true);

    const runway = byName['runway:{cost} * 12']!;
    expect(runway.usedBy).toEqual({ dashboards: 0, analyses: 1, visuals: 0 });
    expect(runway.definedIn).toEqual([{ type: 'analysis', id: 'a-1', name: 'Draft' }]);
  });

  it('filters by conflicts, search, dataset and project', async () => {
    expect(
      (await service().calculatedFields({ conflictsOnly: true })).items.every(
        (i) => i.name === 'margin_pct'
      )
    ).toBe(true);
    expect(
      (await service().calculatedFields({ search: 'ifelse' })).items.map((i) => i.name)
    ).toEqual(['margin_pct']);
    expect((await service().calculatedFields({ datasetId: 'ds-9' })).items).toEqual([]);
    expect((await service().calculatedFields({ projectId: 'p-dev' })).items).toEqual([]);
    expect((await service().calculatedFields({ projectId: 'p-prod' })).items.length).toBe(4);
  });

  it('describes one field: lineage both ways, variants side by side, SMUS tie-back on the columns it reads', async () => {
    const key = calculatedFieldKey('margin_pct', '{margin} / {revenue}');
    const detail = (await service().calculatedField(key))!;

    expect(detail.name).toBe('margin_pct');
    expect(detail.variants.map((v) => v.expression)).toEqual(
      expect.arrayContaining([
        '{margin} / {revenue}',
        'ifelse({revenue} = 0, 0, {margin} / {revenue})',
      ])
    );
    expect(detail.reads).toEqual([
      expect.objectContaining({
        name: 'margin',
        kind: 'calculated',
        key: calculatedFieldKey('margin', '{revenue} - {cost}'),
      }),
      expect.objectContaining({
        name: 'revenue',
        kind: 'column',
        smus: expect.objectContaining({
          listingId: 'l-orders',
          columnName: 'revenue',
          description: 'Recognised revenue',
          glossaryTerms: ['Revenue'],
        }),
      }),
    ]);
    expect(detail.readBy).toEqual([]);

    const margin = (await service().calculatedField(
      calculatedFieldKey('margin', '{revenue}-{cost}')
    ))!;
    expect(margin.readBy.map((r) => r.name).sort()).toEqual(['margin_pct', 'margin_pct']);
    expect(margin.portal).toMatchObject({ description: 'Gross margin before returns' });
    expect(await service().calculatedField('cf_nope')).toBeNull();
  });

  it('lists columns across datasets with their SMUS column and the calculated fields that read them', async () => {
    const result = await service().columns();
    expect(result.counts).toEqual({
      columns: 3,
      datasets: 1,
      withSmus: 3,
      withSmusColumn: 3,
    });
    const revenue = result.items.find((c) => c.name === 'revenue')!;
    expect(revenue.smus).toMatchObject({
      columnName: 'revenue',
      columnType: 'decimal',
      match: 'exact',
      listingColumnCount: 3,
      description: 'Recognised revenue',
    });
    expect(revenue.usedBy).toEqual({ dashboards: 1, analyses: 0, visuals: 1 });
    expect(revenue.usedByCalculated.map((c) => c.name).sort()).toEqual([
      'margin',
      'margin_pct',
      'margin_pct',
    ]);
    expect((await service().columns({ search: 'cos' })).items.map((c) => c.name)).toEqual(['cost']);
  });

  it('ties a renamed column back to its listing column, and a column the listing does not name back to the listing', async () => {
    catalog.getFieldIndex.mockResolvedValue({
      ...INDEX,
      byDataset: new Map([
        [
          'ds-1',
          [
            // The dataset renamed it for readability; Glue still says customer_id.
            field({ fieldName: 'Customer ID', dataType: 'STRING' }),
            // Computed in the dataset, so the Glue table never had it.
            field({ fieldName: 'tenure_days', dataType: 'INTEGER' }),
          ],
        ],
      ]),
    });
    smus.listAssets.mockResolvedValue({
      configured: true,
      projectFilter: ['p-prod'],
      assets: [
        {
          ...ASSETS[0],
          columns: [{ name: 'customer_id', type: 'bigint', description: 'Surrogate key' }],
        },
      ],
      exportedAt: '2026-09-19T00:00:00Z',
    });

    const items = (await service().columns()).items;
    expect(items.find((c) => c.name === 'Customer ID')?.smus).toMatchObject({
      columnName: 'customer_id',
      match: 'normalized',
      description: 'Surrogate key',
      name: 'orders_gold',
    });
    expect(items.find((c) => c.name === 'tenure_days')?.smus).toMatchObject({
      match: 'listing-only',
      name: 'orders_gold',
    });
    expect(items.find((c) => c.name === 'tenure_days')?.smus?.columnName).toBeUndefined();
    expect((await service().columns()).counts).toMatchObject({ withSmus: 2, withSmusColumn: 1 });
  });

  it('takes the best tie-back when a column sits in several datasets, whatever order they come in', async () => {
    // order_id is in both datasets. ds-2's listing names it; ds-1's does not.
    const orderId = { fieldName: 'order_id', dataType: 'STRING' };
    catalog.getFieldIndex.mockResolvedValue({
      ...INDEX,
      byDataset: new Map([
        ['ds-1', [field(orderId)]],
        ['ds-2', [field({ ...orderId, sourceAssetId: 'ds-2' })]],
      ]),
    });
    smus.listAssets.mockResolvedValue({
      configured: true,
      projectFilter: ['p-prod'],
      assets: [
        // No column list at all: the reason a tie-back is unnamed matters.
        { ...ASSETS[0], columns: [], datasets: [{ id: 'ds-1', name: 'One' }] },
        {
          ...ASSETS[0],
          listingId: 'l-orders-2',
          name: 'orders_silver',
          columns: [{ name: 'order_id', type: 'varchar' }],
          datasets: [{ id: 'ds-2', name: 'Two' }],
        },
      ],
      exportedAt: '2026-09-19T00:00:00Z',
    });

    const tie = (await service().columns()).items[0]?.smus;
    expect(tie).toMatchObject({
      columnName: 'order_id',
      columnType: 'varchar',
      match: 'exact',
      name: 'orders_silver',
    });
  });

  it('separates a listing that does not have the column from one with no column list', async () => {
    catalog.getFieldIndex.mockResolvedValue({
      ...INDEX,
      byDataset: new Map([['ds-1', [field({ fieldName: 'tenure_days' })]]]),
    });
    smus.listAssets.mockResolvedValue({
      configured: true,
      projectFilter: ['p-prod'],
      assets: [{ ...ASSETS[0], columns: [] }],
      exportedAt: '2026-09-19T00:00:00Z',
    });
    expect((await service().columns()).items[0]?.smus).toMatchObject({
      match: 'no-schema',
      listingColumnCount: 0,
    });

    smus.listAssets.mockResolvedValue({
      configured: true,
      projectFilter: ['p-prod'],
      assets: [ASSETS[0]],
      exportedAt: '2026-09-19T00:00:00Z',
    });
    expect((await service().columns()).items[0]?.smus).toMatchObject({
      match: 'listing-only',
      listingColumnCount: 3,
    });
  });

  it('survives an export that left a column without a type, a field without a name, or a SMUS column without one', async () => {
    catalog.getFieldIndex.mockResolvedValue({
      ...INDEX,
      byDataset: new Map([
        [
          'ds-1',
          [
            field({ fieldName: 'geo_point', dataType: undefined, columnName: 'geo_point' }),
            field({ fieldName: undefined, dataType: 'STRING' }),
            field({ fieldName: 'stub', isCalculated: true, expression: undefined }),
            field({ fieldName: undefined, isCalculated: true, expression: '{a}' }),
          ],
        ],
      ]),
    });
    smus.listAssets.mockResolvedValue({
      configured: true,
      projectFilter: ['p-prod'],
      assets: [{ ...ASSETS[0], columns: [{ name: undefined, type: 'x' }, { name: 'GEO_POINT' }] }],
      exportedAt: '2026-09-19T00:00:00Z',
    });

    const columns = await service().columns({ search: 'geo' });
    expect(columns.items.map((c) => c.name)).toEqual(['geo_point']);
    expect(columns.items[0]?.dataType).toBeUndefined();
    expect(columns.items[0]?.smus?.columnName).toBe('GEO_POINT');
    expect((await service().calculatedFields({ search: 'stub' })).items).toEqual([]);
    expect((await service().calculatedFields({ search: '{a}' })).items).toEqual([]);
  });
});
