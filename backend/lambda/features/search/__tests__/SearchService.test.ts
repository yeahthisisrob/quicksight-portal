import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { SearchService } from '../services/SearchService';

const entries = {
  dashboard: [
    {
      assetId: 'd-1',
      assetName: 'Sales overview',
      arn: 'arn:d1',
      tags: [{ key: 'team', value: 'sales' }],
      lastUpdatedTime: new Date('2026-09-01T00:00:00Z'),
      metadata: {
        sheetCount: 1,
        visualCount: 2,
        datasetCount: 1,
        viewStats: { totalViews: 120, uniqueViewers: 9 },
        folderPath: ['arn:folder:sales'],
        lineageData: { datasetIds: ['ds-1'] },
        fields: [{ fieldName: 'revenue' }, { fieldName: 'region' }],
        calculatedFields: [{ fieldName: 'margin' }],
      },
    },
  ],
  analysis: [],
  dataset: [
    {
      assetId: 'ds-1',
      assetName: 'orders_gold',
      arn: 'arn:ds1',
      tags: [],
      metadata: {
        importMode: 'SPICE',
        sourceType: 'ATHENA',
        fields: [{ fieldName: 'revenue' }, { fieldName: 'region' }],
        calculatedFields: [],
      },
    },
  ],
  datasource: [],
  folder: [{ assetId: 'f-1', assetName: 'Sales', arn: 'arn:folder:sales', tags: [], metadata: {} }],
};

const fields = [
  {
    fieldId: 'margin',
    fieldName: 'margin',
    dataType: 'DECIMAL',
    isCalculated: true,
    expression: "ifelse({status} = 'closed', {revenue} - {cost}, 0)",
    sourceAssetType: 'dashboard',
    sourceAssetId: 'd-1',
    sourceAssetName: 'Sales overview',
    datasetId: 'ds-1',
    usageCount: 0,
    analysisCount: 0,
    dashboardCount: 0,
    lastUpdated: '',
  },
  {
    fieldId: 'margin',
    fieldName: 'margin',
    dataType: 'DECIMAL',
    isCalculated: true,
    expression: "ifelse( {status}='closed', {revenue}-{cost}, 0 )",
    sourceAssetType: 'analysis',
    sourceAssetId: 'a-1',
    sourceAssetName: 'Sales draft',
    usageCount: 0,
    analysisCount: 0,
    dashboardCount: 0,
    lastUpdated: '',
  },
  {
    fieldId: 'revenue',
    fieldName: 'revenue',
    dataType: 'DECIMAL',
    isCalculated: false,
    sourceAssetType: 'dashboard',
    sourceAssetId: 'd-1',
    sourceAssetName: 'Sales overview',
    datasetId: 'ds-1',
    usageCount: 0,
    analysisCount: 0,
    dashboardCount: 0,
    lastUpdated: '',
    visuals: [
      {
        visualId: 'v-bar',
        visualType: 'BarChartVisual',
        title: 'Revenue by region',
        sheetId: 's1',
        sheetName: 'Overview',
      },
    ],
  },
  {
    fieldId: 'region',
    fieldName: 'region',
    dataType: 'STRING',
    isCalculated: false,
    sourceAssetType: 'dashboard',
    sourceAssetId: 'd-1',
    sourceAssetName: 'Sales overview',
    datasetId: 'ds-1',
    usageCount: 0,
    analysisCount: 0,
    dashboardCount: 0,
    lastUpdated: '',
    visuals: [
      {
        visualId: 'v-bar',
        visualType: 'BarChartVisual',
        title: 'Revenue by region',
        sheetId: 's1',
        sheetName: 'Overview',
      },
    ],
  },
];

describe('SearchService', () => {
  const cache = {
    getMasterCacheWithVersion: vi.fn(),
    searchFields: vi.fn(),
  };
  const smus = { getSnapshot: vi.fn(), listAssets: vi.fn() };
  const templates = { list: vi.fn() };
  const service = () => new SearchService(cache as any, smus as any, templates as any);

  beforeEach(() => {
    vi.clearAllMocks();
    SearchService.invalidate();
    cache.getMasterCacheWithVersion.mockResolvedValue({ cache: { entries }, version: 'v1' });
    cache.searchFields.mockResolvedValue(fields);
    smus.getSnapshot.mockResolvedValue({
      exportedAt: '2026-09-18T00:00:00Z',
      projects: [{ id: 'p-1', name: 'sales_prod' }],
    });
    smus.listAssets.mockResolvedValue({
      configured: true,
      assets: [
        {
          listingId: 'lst-1',
          name: 'dim_customer',
          projectId: 'p-1',
          table: { database: 'published_prod', name: 'dim_customer' },
          columns: [
            { name: 'customer_id', type: 'bigint', description: 'The customer key' },
            { name: 'revenue', type: 'decimal(18,2)', description: 'Net revenue in USD' },
          ],
          glossaryTerms: [{ name: 'PII' }],
          datasets: [{ id: 'ds-1', name: 'orders_gold', matchType: 'table' }],
        },
      ],
    });
    templates.list.mockResolvedValue([
      { id: 't-1', name: 'net_margin', expression: '{revenue} - {cost}', tags: ['finance'] },
    ]);
  });

  it('indexes assets, one document per distinct calculated field expression, visuals, listings and templates', async () => {
    const result = await service().search({ q: 'closed margin' });

    expect(result.indexed).toMatchObject({
      dashboard: 1,
      dataset: 1,
      folder: 1,
      'calculated-field': 1,
      visual: 1,
      'smus-listing': 1,
      template: 1,
    });
    const margin = result.hits.find((h) => h.type === 'calculated-field')!;
    expect(margin.name).toBe('margin');
    expect(margin.definedIn?.map((d) => d.name)).toEqual(['Sales overview', 'Sales draft']);
    expect(margin.summary).toContain('in 2 assets');
    expect(margin.why).toEqual(expect.arrayContaining(['expression: closed']));
  });

  it('finds a visual by what it shows and links to its asset in Author', async () => {
    const result = await service().search({ q: 'bar chart revenue by region', types: ['visual'] });
    expect(result.hits[0]).toMatchObject({
      type: 'visual',
      name: 'Revenue by region',
      parent: { type: 'dashboard', id: 'd-1' },
    });
    expect(result.hits[0]!.path).toContain('/author?type=dashboard&id=d-1');
    expect(result.hits[0]!.summary).toContain('bar chart');
  });

  it('puts folder names and view counts in an asset summary and finds SMUS listings by table', async () => {
    const sales = (await service().search({ q: 'sales overview' })).hits[0]!;
    expect(sales.summary).toBe(
      'dashboard: Sales overview (1 sheet, 2 visuals, 1 dataset, 120 views, in Sales)'
    );
    const listing = (await service().search({ q: 'published_prod dim customer' })).hits[0]!;
    expect(listing).toMatchObject({ type: 'smus-listing', id: 'lst-1' });
  });

  it('skips entries with no name instead of failing the whole index', async () => {
    cache.searchFields.mockResolvedValue([
      ...fields,
      {
        fieldId: 'ghost',
        isCalculated: true,
        expression: '{a}+{b}',
        sourceAssetType: 'dataset',
        sourceAssetId: 'ds-1',
        sourceAssetName: 'orders_gold',
      },
      {
        fieldId: 'nov',
        fieldName: 'novis',
        isCalculated: false,
        sourceAssetType: 'dashboard',
        sourceAssetId: 'd-1',
        sourceAssetName: 'Sales',
        datasetId: 'ds-1',
        visuals: [{ visualId: 'v-x', sheetId: 's1' }],
      },
    ]);
    smus.listAssets.mockResolvedValue({
      assets: [
        { listingId: 'lst-noname' },
        { listingId: 'lst-1', name: 'dim_customer', glossaryTerms: [] },
      ],
    });
    cache.getMasterCacheWithVersion.mockResolvedValue({
      cache: {
        entries: {
          ...entries,
          datasource: [{ assetId: 'src-1', arn: 'arn:src', tags: [], metadata: {} }],
        },
      },
      version: 'v9',
    });

    const result = await service().search({ q: 'novis untitled src-1 dim_customer' });

    expect(result.indexed['smus-listing']).toBe(1);
    expect(result.indexed.datasource).toBe(1);
    expect(result.hits.some((h) => h.type === 'visual' && h.name === 'Untitled Visual')).toBe(true);
    expect(result.hits.some((h) => h.type === 'datasource' && h.name === 'src-1')).toBe(true);
  });

  it('builds the index once per cache version and snapshot', async () => {
    await service().search({ q: 'sales' });
    await service().search({ q: 'orders' });
    expect(cache.searchFields).toHaveBeenCalledTimes(1);
    cache.getMasterCacheWithVersion.mockResolvedValue({ cache: { entries }, version: 'v2' });
    await service().search({ q: 'sales' });
    expect(cache.searchFields).toHaveBeenCalledTimes(2);
  });

  it('finds SMUS columns by description and keeps to a project', async () => {
    const hits = (await service().search({ q: 'net revenue usd', types: ['smus-column'] })).hits;
    expect(hits[0]).toMatchObject({ entityId: 'listing-column:lst-1/revenue', projectId: 'p-1' });
    expect(hits[0]!.summary).toBe(
      'SMUS column: dim_customer.revenue (decimal(18,2)) - Net revenue in USD'
    );
    expect((await service().search({ q: 'dim customer', projectId: 'p-other' })).hits).toEqual([]);
  });

  it('builds the context graph: project, listing, dataset and dashboard, with column types', async () => {
    const graph = await service().graph();
    const readers = graph.related('listing:lst-1', {
      relations: ['reads-listing'],
      direction: 'in',
    });
    expect(readers.map((h) => h.entity.id)).toEqual(['dataset:ds-1']);
    const exposed = graph.related('dataset:ds-1', { relations: ['exposes'], direction: 'out' });
    expect(exposed.map((h) => h.entity.id)).toEqual(['listing-column:lst-1/revenue']);
    expect(exposed[0]!.entity.attributes).toMatchObject({ type: 'decimal(18,2)' });
    const users = graph.related('dataset:ds-1', { relations: ['uses-dataset'], direction: 'in' });
    expect(users.map((h) => h.entity.id)).toContain('dashboard:d-1');
    const project = graph.related('listing:lst-1', { relations: ['in-project'] });
    expect(project.map((h) => h.entity.name)).toEqual(['sales_prod']);
    const twoHops = graph.related('listing:lst-1', {
      direction: 'in',
      depth: 2,
      types: ['dashboard'],
    });
    expect(twoHops.map((h) => h.entity.id)).toContain('dashboard:d-1');
  });
});
