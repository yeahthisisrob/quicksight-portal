import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  qs: {
    createDashboard: vi.fn(),
    createAnalysis: vi.fn(),
    createFolderMembership: vi.fn(),
    tagResource: vi.fn(),
  },
  audit: { record: vi.fn() },
}));

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
  const service = () => new NewAssetService('1', rebind as any, planner as any);

  beforeEach(() => {
    vi.clearAllMocks();
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
    mocks.audit.record.mockResolvedValue(null);
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
});
