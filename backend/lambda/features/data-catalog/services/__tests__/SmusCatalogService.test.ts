import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SmusCatalogService } from '../SmusCatalogService';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const ASSET = {
  listingId: 'l-orders',
  assetId: 'a-orders',
  name: 'orders_gold',
  description: 'Curated orders',
  projectId: 'p-prod',
  projectName: 'analytics_prod',
  url: 'https://smus/catalog/assets/l-orders',
  table: { database: 'published_prod', name: 'orders_gold' },
  columns: [
    { name: 'revenue', type: 'decimal', description: 'Net revenue after returns' },
    { name: 'cost', type: 'decimal' },
    { name: 'status', type: 'string' },
  ],
  glossaryTerms: [{ name: 'Revenue', shortDescription: 'Recognised revenue' }],
  forms: [{ name: 'GlueTableForm', fields: [{ key: 'tableName', value: 'orders_gold' }] }],
  createdAt: '2026-09-01T00:00:00Z',
  datasets: [{ id: 'ds-1', name: 'Orders (gold)', matchType: 'source-table' as const }],
};
const OTHER = {
  ...ASSET,
  listingId: 'l-cust',
  assetId: 'a-cust',
  name: 'customers',
  projectId: 'p-dev',
  projectName: 'analytics_dev',
  glossaryTerms: [],
  datasets: [],
};

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

const FIELDS = [
  field({ fieldName: 'revenue', dataType: 'DECIMAL', columnName: 'revenue', dashboardCount: 1 }),
  field({ fieldName: 'cost', dataType: 'DECIMAL', columnName: 'cost' }),
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
  // A dashboard reading revenue and redefining margin differently
  field({
    fieldName: 'revenue',
    sourceAssetType: 'dashboard',
    sourceAssetId: 'd1',
    sourceAssetName: 'Sales',
    datasetId: 'ds-1',
    visuals: [
      {
        visualId: 'v1',
        visualType: 'bar',
        title: 'Revenue by month',
        sheetId: 's',
        sheetName: 'Overview',
      },
    ],
  }),
  field({
    fieldName: 'margin',
    sourceAssetType: 'dashboard',
    sourceAssetId: 'd1',
    sourceAssetName: 'Sales',
    datasetId: 'ds-1',
    isCalculated: true,
    expression: '{revenue}-{cost}',
  }),
  field({
    fieldName: 'margin',
    sourceAssetType: 'analysis',
    sourceAssetId: 'a1',
    sourceAssetName: 'Sales WIP',
    datasetId: 'ds-1',
    isCalculated: true,
    expression: '{revenue} - {cost} - {tax}',
  }),
];

describe('SmusCatalogService', () => {
  const smus = { listAssets: vi.fn() };
  const cache = { searchFields: vi.fn() };
  const notes = { getAllFieldMetadata: vi.fn() };
  const templates = { list: vi.fn() };
  let service: SmusCatalogService;

  beforeEach(() => {
    SmusCatalogService.invalidate();
    vi.clearAllMocks();
    smus.listAssets.mockResolvedValue({
      configured: true,
      projectFilter: ['p-prod', 'p-dev'],
      assets: [ASSET, OTHER],
    });
    cache.searchFields.mockResolvedValue(FIELDS);
    notes.getAllFieldMetadata.mockResolvedValue([
      {
        sourceType: 'dataset',
        sourceId: 'ds-1',
        fieldName: 'margin',
        description: 'Gross margin',
        tags: ['finance'],
      },
    ]);
    templates.list.mockResolvedValue([
      {
        id: 't-margin',
        name: 'margin',
        expression: '{revenue}-{cost}',
        createdAt: '',
        updatedAt: '',
      },
    ]);
    service = new SmusCatalogService(smus as any, cache as any, notes as any, templates as any);
  });

  it('lists assets with per-project and per-term counts and QuickSight rollups', async () => {
    const result = await service.list();
    expect(result.projects).toEqual([
      { id: 'p-dev', name: 'analytics_dev', count: 1 },
      { id: 'p-prod', name: 'analytics_prod', count: 1 },
    ]);
    expect(result.glossaryTerms).toEqual([
      { name: 'Revenue', shortDescription: 'Recognised revenue', count: 1 },
    ]);
    expect(result.assets.map((a) => a.name)).toEqual(['orders_gold', 'customers']);
    expect(result.assets[0]).toMatchObject({
      columnCount: 3,
      calculatedFieldCount: 2,
      usage: { dashboards: 1, analyses: 0 },
    });
  });

  it("answers the project list without touching the field index when scope is 'projects'", async () => {
    const result = await service.list({ scope: 'projects' });

    expect(result.projects.map((p) => p.id).sort()).toEqual(
      [...new Set([ASSET, OTHER].map((a) => a.projectId))].sort()
    );
    expect(result.assets).toEqual([]);
    expect(result.glossaryTerms).toEqual([]);
    expect(cache.searchFields).not.toHaveBeenCalled();
  });

  it('scopes to a project and a term', async () => {
    const byProject = await service.list({ projectId: 'p-dev' });
    expect(byProject.assets.map((a) => a.listingId)).toEqual(['l-cust']);
    expect(byProject.glossaryTerms).toEqual([]);
    const byTerm = await service.list({ term: 'Revenue' });
    expect(byTerm.assets.map((a) => a.listingId)).toEqual(['l-orders']);
  });

  it('describes a dataset: lineage both ways, usage down to visuals, conflicts, notes, templates, SMUS links', async () => {
    const asset = await service.get('l-orders');
    expect(asset.forms).toEqual(ASSET.forms);
    const [dataset] = asset.datasets;
    expect(dataset).toMatchObject({ id: 'ds-1', calculatedFieldCount: 2 });
    const byName = Object.fromEntries(dataset!.fields.map((f) => [f.name, f]));

    // Calculated fields first, then columns
    expect(dataset!.fields.map((f) => f.name)).toEqual(['margin', 'margin_pct', 'cost', 'revenue']);

    expect(byName.margin).toMatchObject({
      isCalculated: true,
      expression: '{revenue} - {cost}',
      references: ['revenue', 'cost'],
      usedBy: ['margin_pct'],
      usage: { dashboards: 1, analyses: 1 },
      portal: { description: 'Gross margin', tags: ['finance'] },
      template: { id: 't-margin' },
    });
    // The dashboard's copy normalises to the same expression; only the analysis differs
    expect(byName.margin!.conflict).toEqual({
      count: 2,
      variants: [
        {
          expression: '{revenue} - {cost} - {tax}',
          sources: [{ assetType: 'analysis', assetId: 'a1', assetName: 'Sales WIP' }],
        },
      ],
    });

    expect(byName.revenue).toMatchObject({
      isCalculated: false,
      references: [],
      usedBy: ['margin', 'margin_pct'],
      usedIn: [{ assetType: 'dashboard', assetId: 'd1', assetName: 'Sales' }],
      visuals: [
        {
          assetType: 'dashboard',
          assetId: 'd1',
          visualId: 'v1',
          visualName: 'Revenue by month',
          sheetName: 'Overview',
        },
      ],
      smus: {
        listingId: 'l-orders',
        columnName: 'revenue',
        description: 'Net revenue after returns',
        url: ASSET.url,
      },
    });
    expect(byName.revenue!.portal).toBeUndefined();
  });

  it('reports not configured, and 404 for an unknown listing', async () => {
    smus.listAssets.mockResolvedValue({ configured: false, projectFilter: [], assets: [] });
    expect(await service.list()).toMatchObject({ configured: false, assets: [] });
    smus.listAssets.mockResolvedValue({ configured: true, projectFilter: [], assets: [ASSET] });
    await expect(service.get('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('keeps working when notes and templates are unavailable, and without recorded visuals', async () => {
    notes.getAllFieldMetadata.mockRejectedValue(new Error('no metadata'));
    templates.list.mockRejectedValue(new Error('no table'));
    cache.searchFields.mockResolvedValue(
      (FIELDS as any[]).map(({ visuals: _visuals, ...rest }) => rest)
    );
    const asset = await service.get('l-orders');
    const margin = asset.datasets[0]!.fields.find((f) => f.name === 'margin')!;
    expect(margin.portal).toBeUndefined();
    expect(margin.template).toBeUndefined();
    expect(margin.visuals).toBeUndefined();
  });
});
