import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  qs: {
    createDashboard: vi.fn(),
    createAnalysis: vi.fn(),
    createFolderMembership: vi.fn(),
    tagResource: vi.fn(),
    updateDataSetPermissions: vi.fn(),
  },
  audit: { record: vi.fn() },
}));

const freshness = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/cache/assetFreshness', () => ({ keepCacheFresh: freshness }));
vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => mocks.qs },
}));
vi.mock('../../../../shared/services/audit/AuditLog', () => ({
  auditLog: mocks.audit,
  actorFromAuth: () => ({
    actor: { kind: 'api-key', id: 'k', label: 'claude cli' },
    channel: 'api',
  }),
}));
vi.mock('../../../../shared/services/settings/SettingsStore', () => ({
  settingsStore: { get: () => undefined, getString: () => '', getList: () => [] },
}));
vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { NewAssetService } from '../NewAssetService';

const columns = [
  { name: 'order_date', type: 'DATETIME' },
  { name: 'region', type: 'STRING' },
  { name: 'revenue', type: 'DECIMAL' },
];

describe('NewAssetService', () => {
  const rebind = {
    describeTargetDataset: vi.fn(),
    loadDefinitionWithTheme: vi.fn(),
    permissionsOf: vi.fn(),
  };
  const planner = { planVisuals: vi.fn() };
  const filterBars = { get: vi.fn(), getDefault: vi.fn() };
  const visualTemplates = { get: vi.fn() };
  const service = () =>
    new NewAssetService('1', rebind as any, planner as any, filterBars, visualTemplates as any);

  beforeEach(() => {
    vi.clearAllMocks();
    filterBars.get.mockResolvedValue(null);
    filterBars.getDefault.mockResolvedValue(null);
    visualTemplates.get.mockResolvedValue(null);
    rebind.describeTargetDataset.mockResolvedValue({
      dataSetId: 'ds-1',
      dataSetArn: 'arn:ds-1',
      name: 'orders_gold',
      columns,
    });
    rebind.permissionsOf.mockResolvedValue([
      { Principal: 'arn:user/rob', Actions: ['quicksight:DescribeDashboard'] },
    ]);
    mocks.qs.createDashboard.mockResolvedValue({
      dashboardId: 'new-1',
      arn: 'arn:dashboard/new-1',
      versionArn: 'arn:dashboard/new-1/version/1',
    });
    mocks.qs.createAnalysis.mockResolvedValue({ analysisId: 'new-a', arn: 'arn:analysis/new-a' });
    mocks.qs.createFolderMembership.mockResolvedValue(undefined);
    mocks.qs.tagResource.mockResolvedValue(undefined);
    mocks.qs.updateDataSetPermissions.mockResolvedValue({ Status: 200 });
    mocks.audit.record.mockResolvedValue(null);
  });

  const TABLE = {
    type: 'Table' as const,
    title: 'All',
    identifier: 'orders',
    category: 'region',
    values: [{ column: 'revenue' }],
  };

  it('warns in preview and refuses to create when an added field reads a column the dataset lacks', async () => {
    // QuickSight validates expressions when the asset is written and fails
    // the whole write (CONTEXTUAL_UNKNOWN_SYMBOL), leaving a blank asset
    // with no dataset bound; the check runs here instead.
    const request = {
      assetType: 'analysis' as const,
      name: 'x',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      visuals: [TABLE],
      addCalculatedFields: [
        { identifier: 'orders', name: 'net', expression: '{revenue} - {tax}' },
        { identifier: 'orders', name: 'net_pct', expression: '{net} / {revenue}' },
      ],
    };
    const preview = await service().preview(request);
    expect(preview.warnings).toEqual([
      "Calculated field 'net' reads 'tax', which orders_gold does not have.",
    ]);
    expect(preview.definition.CalculatedFields).toHaveLength(2);
    await expect(service().create(request)).rejects.toThrow("Calculated field 'net' reads 'tax'");
    expect(mocks.qs.createAnalysis).not.toHaveBeenCalled();
  });

  it('gives the audience the same standing on a dataset made for the asset', async () => {
    rebind.permissionsOf.mockResolvedValue([
      {
        Principal: 'arn:user/rob',
        Actions: ['quicksight:DescribeAnalysis', 'quicksight:UpdateAnalysis'],
      },
      { Principal: 'arn:group/readers', Actions: ['quicksight:DescribeAnalysis'] },
    ]);
    const result = await service().create({
      assetType: 'analysis',
      name: 'x',
      datasets: [
        { identifier: 'orders', dataSetId: 'ds-1' },
        { identifier: 'fresh', dataSetId: 'ds-new', shareWithAudience: true },
      ],
      visuals: [TABLE],
      permissionsFrom: { assetType: 'analysis', assetId: 'src' },
    });
    expect(mocks.qs.updateDataSetPermissions).toHaveBeenCalledTimes(1);
    const [dataSetId, grants] = mocks.qs.updateDataSetPermissions.mock.calls[0]!;
    expect(dataSetId).toBe('ds-new');
    expect(grants).toEqual([
      {
        Principal: 'arn:user/rob',
        Actions: expect.arrayContaining(['quicksight:PassDataSet', 'quicksight:UpdateDataSet']),
      },
      {
        Principal: 'arn:group/readers',
        Actions: expect.arrayContaining(['quicksight:PassDataSet']),
      },
    ]);
    expect(grants[1].Actions).not.toContain('quicksight:UpdateDataSet');
    expect(result.warnings).toEqual([]);
  });

  it('warns rather than fails when the dataset cannot be shared, or there is no audience to share with', async () => {
    mocks.qs.updateDataSetPermissions.mockRejectedValue(new Error('AccessDenied'));
    const failed = await service().create({
      assetType: 'analysis',
      name: 'x',
      datasets: [{ identifier: 'fresh', dataSetId: 'ds-new', shareWithAudience: true }],
      visuals: [{ ...TABLE, identifier: 'fresh' }],
      permissionsFrom: { assetType: 'analysis', assetId: 'src' },
    });
    expect(failed.warnings).toEqual([
      expect.stringContaining('Dataset fresh could not be shared with the audience'),
    ]);
    expect(mocks.qs.createAnalysis).toHaveBeenCalledTimes(1);

    rebind.permissionsOf.mockResolvedValue(undefined);
    const nobody = await service().create({
      assetType: 'analysis',
      name: 'x',
      datasets: [{ identifier: 'fresh', dataSetId: 'ds-new', shareWithAudience: true }],
      visuals: [{ ...TABLE, identifier: 'fresh' }],
    });
    expect(nobody.warnings).toEqual([
      expect.stringContaining('only account admins will see this asset'),
      expect.stringContaining('A dataset created for this asset has no audience either'),
    ]);
    expect(mocks.qs.updateDataSetPermissions).toHaveBeenCalledTimes(1);
  });

  it('previews given visuals: builds the definition, outline and warnings without writing', async () => {
    const preview = await service().preview({
      assetType: 'dashboard',
      name: 'Sales',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      visuals: [
        { type: 'KPI', title: 'Revenue', identifier: 'orders', values: [{ column: 'revenue' }] },
        {
          type: 'LineChart',
          title: 'Trend',
          identifier: 'orders',
          category: 'order_date',
          values: [{ column: 'revenue' }],
        },
        { type: 'Table', title: 'Bad', identifier: 'orders', values: [{ column: 'nope' }] },
      ],
    });
    expect(preview.definition.DataSetIdentifierDeclarations).toEqual([
      { Identifier: 'orders', DataSetArn: 'arn:ds-1' },
    ]);
    expect(preview.outline[0]!.elements).toHaveLength(2);
    expect(preview.warnings.some((w) => w.includes("'Bad' skipped"))).toBe(true);
    expect(preview.proposal).toBeUndefined();
    expect(mocks.qs.createDashboard).not.toHaveBeenCalled();
  });

  it('asks the planner for visuals when only an ask is given', async () => {
    planner.planVisuals.mockResolvedValue({
      visuals: [
        {
          type: 'ColumnChart',
          title: 'Revenue by region',
          identifier: 'orders',
          category: 'region',
          values: [{ column: 'revenue', aggregation: 'SUM' }],
        },
      ],
      reason: 'Revenue by region is the ask.',
      model: { provider: 'bedrock', model: 'm' },
    });
    const preview = await service().preview({
      assetType: 'dashboard',
      name: 'Sales',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      ask: 'revenue by region',
    });
    expect(planner.planVisuals).toHaveBeenCalledWith('revenue by region', [
      expect.objectContaining({ identifier: 'orders', dataSetArn: 'arn:ds-1' }),
    ]);
    expect(preview.visuals).toHaveLength(1);
    expect(preview.proposal).toEqual({
      reason: 'Revenue by region is the ask.',
      model: { provider: 'bedrock', model: 'm' },
    });
    expect(Object.keys(preview.definition.Sheets[0].Visuals[0])).toEqual(['BarChartVisual']);
  });

  it("creates with the template's audience and theme, files it in a folder, and leaves provenance", async () => {
    rebind.loadDefinitionWithTheme.mockResolvedValue({
      name: 'Standard',
      themeArn: 'arn:theme',
      definition: {
        Sheets: [
          {
            SheetId: 'ts',
            Name: 'Standard',
            TextBoxes: [{ SheetTextBoxId: 't', Content: 'Title' }],
            Visuals: [],
            Layouts: [
              {
                Configuration: {
                  GridLayout: {
                    Elements: [
                      {
                        ElementId: 't',
                        ElementType: 'TEXT_BOX',
                        ColumnIndex: 0,
                        ColumnSpan: 36,
                        RowIndex: 0,
                        RowSpan: 2,
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
      },
    });
    const result = await service().create(
      {
        assetType: 'dashboard',
        name: 'Sales',
        datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
        visuals: [
          { type: 'KPI', title: 'Revenue', identifier: 'orders', values: [{ column: 'revenue' }] },
        ],
        template: { assetType: 'dashboard', assetId: 'tpl' },
        folderId: 'f-1',
      },
      { userId: 'api-key:claude cli', accountId: '1', apiKey: { id: 'k', label: 'claude cli' } }
    );
    expect(rebind.permissionsOf).toHaveBeenCalledWith('dashboard', 'tpl');
    const call = mocks.qs.createDashboard.mock.calls[0]![0];
    expect(call).toMatchObject({ name: 'Sales', themeArn: 'arn:theme' });
    expect(call.permissions).toHaveLength(1);
    expect(call.definition.Sheets[0].Name).toBe('Standard');
    expect(call.definition.Sheets[0].TextBoxes).toHaveLength(1);
    expect(mocks.qs.createFolderMembership).toHaveBeenCalledWith('f-1', 'new-1', 'DASHBOARD');
    // The cache learns of the new dashboard and the folder it went into, without an export.
    expect(freshness).toHaveBeenCalledWith(
      [
        expect.objectContaining({ assetType: 'dashboard', assetId: 'new-1' }),
        { assetType: 'folder', assetId: 'f-1' },
      ],
      expect.anything()
    );
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'authoring.create', assetId: 'new-1' })
    );
    expect(mocks.qs.tagResource).toHaveBeenCalledWith(
      'dashboard',
      'new-1',
      expect.arrayContaining([
        expect.objectContaining({ key: 'portal:authored-by', value: 'api-key:claude cli' }),
      ])
    );
    expect(result).toMatchObject({ assetId: 'new-1', versionNumber: 1, folderId: 'f-1' });
  });

  it('refuses an empty build and warns when nobody will see the asset', async () => {
    await expect(
      service().create({
        assetType: 'analysis',
        name: 'x',
        datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
        visuals: [],
      })
    ).rejects.toThrow('no visual could be built');
    rebind.permissionsOf.mockResolvedValue(undefined);
    const result = await service().create({
      assetType: 'analysis',
      name: 'x',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      visuals: [
        {
          type: 'Table',
          title: 'All',
          identifier: 'orders',
          category: 'region',
          values: [{ column: 'revenue' }],
        },
      ],
    });
    expect(result.warnings).toEqual([
      expect.stringContaining('only account admins will see this asset'),
    ]);
    expect(mocks.qs.createAnalysis).toHaveBeenCalled();
  });

  it("starts every sheet from the organisation's filter bar, in its order and widths, then the filters asked for", async () => {
    filterBars.getDefault.mockResolvedValue({
      id: 'bar-1',
      name: 'Standard',
      isDefault: true,
      controls: [
        { column: 'Region', span: 3, title: 'Region' },
        { column: 'segment', span: 2 },
      ],
    });
    const preview = await service().preview({
      assetType: 'analysis',
      name: 'x',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      visuals: [TABLE],
      filters: [
        { identifier: 'orders', column: 'region' },
        { identifier: 'orders', column: 'order_date' },
      ],
    });
    const sheet = preview.definition.Sheets[0];
    const bar = sheet.SheetControlLayouts[0].Configuration.GridLayout.Elements;
    expect(sheet.FilterControls.map((c: any) => (Object.values(c)[0] as any).Title)).toEqual([
      'Region',
      'order_date',
    ]);
    expect(bar.map((e: any) => e.ColumnSpan)).toEqual([3, 2]);
    expect(preview.warnings).toContain(
      "Filter bar 'Standard': segment is not on these datasets, so it was left out."
    );

    const none = await service().preview({
      assetType: 'analysis',
      name: 'x',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      visuals: [TABLE],
      filterBarTemplateId: 'none',
    });
    expect(none.definition.Sheets[0].FilterControls).toBeUndefined();
  });

  it('adds saved visual templates on the dataset named, and says when one is gone', async () => {
    visualTemplates.get.mockImplementation(async (id: string) =>
      id === 'vt-trend'
        ? {
            id,
            name: 'Revenue trend',
            visual: {
              type: 'LineChart',
              category: 'order_date',
              granularity: 'MONTH',
              values: [{ column: 'revenue' }],
            },
          }
        : null
    );
    const preview = await service().preview({
      assetType: 'analysis',
      name: 'x',
      datasets: [{ identifier: 'orders', dataSetId: 'ds-1' }],
      visualTemplates: [
        { templateId: 'vt-trend', identifier: 'orders' },
        { templateId: 'vt-gone', identifier: 'orders' },
      ],
    });
    expect(preview.visuals).toEqual([
      expect.objectContaining({
        type: 'LineChart',
        identifier: 'orders',
        title: 'Revenue trend',
        granularity: 'MONTH',
      }),
    ]);
    expect(preview.warnings).toContain("No visual template 'vt-gone'; it was left out.");
  });
});
