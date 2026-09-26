import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GOLD_COLUMNS, sampleDefinition } from '../../lib/__tests__/fixtures';

const mocks = vi.hoisted(() => ({
  qs: {
    createDashboard: vi.fn(),
    createAnalysis: vi.fn(),
    updateAnalysis: vi.fn(),
    updateDashboard: vi.fn(),
    updateDashboardPublishedVersion: vi.fn(),
    createFolderMembership: vi.fn(),
    tagResource: vi.fn(),
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

import { assertDefinitionShape, DefinitionService } from '../DefinitionService';

const AUTH = {
  userId: 'api-key:claude cli',
  accountId: '1',
  apiKey: { id: 'k', label: 'claude cli' },
};

/** The sample definition's own columns, so every reference resolves. */
const SILVER_COLUMNS = [
  { Name: 'status', Type: 'STRING' },
  { Name: 'revenue', Type: 'DECIMAL' },
  { Name: 'cost', Type: 'DECIMAL' },
  { Name: 'order_date', Type: 'DATETIME' },
];
/** The fixture reads parameters it never declares; a sound definition declares them. */
function sound() {
  const definition = sampleDefinition();
  const declared = new Set(
    (definition.ParameterDeclarations ?? []).flatMap((d: any) =>
      Object.values(d).map((x: any) => x?.Name)
    )
  );
  for (const name of ['scale', 'region']) {
    if (!declared.has(name)) {
      definition.ParameterDeclarations = [
        ...(definition.ParameterDeclarations ?? []),
        { StringParameterDeclaration: { Name: name, ParameterValueType: 'SINGLE_VALUED' } },
      ];
    }
  }
  return definition;
}

const REGION_COLUMNS = [
  { Name: 'region_name', Type: 'STRING' },
  { Name: 'country', Type: 'STRING' },
];

describe('DefinitionService', () => {
  const rebind = {
    describeTargetDataset: vi.fn(),
    loadDefinitionWithTheme: vi.fn(),
    permissionsOf: vi.fn(),
  };
  const service = () => new DefinitionService('1', rebind as any);
  const target = (columns: any[]) => ({
    columns: columns.map((c) => ({ name: c.Name, type: c.Type })),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    rebind.describeTargetDataset.mockImplementation(async (id: string) => {
      if (id === 'orders-silver') {
        return {
          dataSetId: id,
          dataSetArn: `arn:${id}`,
          name: 'orders_silver',
          ...target(SILVER_COLUMNS),
        };
      }
      if (id === 'orders-gold') {
        return {
          dataSetId: id,
          dataSetArn: `arn:${id}`,
          name: 'orders_gold',
          ...target(GOLD_COLUMNS),
        };
      }
      if (id === 'regions') {
        return {
          dataSetId: id,
          dataSetArn: `arn:${id}`,
          name: 'regions',
          ...target(REGION_COLUMNS),
        };
      }
      throw new Error(`Dataset '${id}' was not found`);
    });
    rebind.loadDefinitionWithTheme.mockResolvedValue({
      name: 'Sales analysis',
      definition: sampleDefinition(),
      themeArn: 'arn:theme',
      dashboardPublishOptions: { AdHocFilteringOption: { AvailabilityStatus: 'ENABLED' } },
    });
    rebind.permissionsOf.mockResolvedValue([
      { Principal: 'arn:user/rob', Actions: ['quicksight:DescribeAnalysis'] },
    ]);
    mocks.qs.updateAnalysis.mockResolvedValue({ arn: 'arn:analysis/a1' });
    mocks.qs.updateDashboard.mockResolvedValue({
      arn: 'arn:dashboard/d1',
      versionArn: 'arn:dashboard/d1/version/4',
    });
    mocks.qs.createAnalysis.mockResolvedValue({ analysisId: 'new-a', arn: 'arn:analysis/new-a' });
    mocks.qs.createDashboard.mockResolvedValue({
      dashboardId: 'new-d',
      arn: 'arn:dashboard/new-d',
      versionArn: 'arn:dashboard/new-d/version/1',
    });
  });

  it('refuses anything that is not a definition before reading a dataset', async () => {
    expect(() => assertDefinitionShape(null)).toThrow('definition must be');
    expect(() => assertDefinitionShape({ Sheets: [{}] })).toThrow('DataSetIdentifierDeclarations');
    expect(() =>
      assertDefinitionShape({
        DataSetIdentifierDeclarations: [{ Identifier: 'a', DataSetArn: 'x' }],
      })
    ).toThrow('Sheets');
    await expect(service().preview([])).rejects.toThrow('definition must be');
    expect(rebind.describeTargetDataset).not.toHaveBeenCalled();
  });

  it('previews a sound definition: every dataset read, every column found, no issues', async () => {
    const preview = await service().preview(sound());
    expect(preview.canApply).toBe(true);
    expect(preview.issues).toEqual([]);
    expect(preview.datasets).toEqual([
      expect.objectContaining({
        identifier: 'orders',
        name: 'orders_silver',
        readable: true,
        missing: [],
      }),
      expect.objectContaining({ identifier: 'regions', readable: true, missing: [] }),
    ]);
    expect(preview.datasets[0]!.referenced).toBeGreaterThan(0);
    expect(preview.outline.length).toBeGreaterThan(0);
  });

  it('names the columns a dataset lacks and the datasets it cannot read, with fixes', async () => {
    const definition = sound();
    // Point orders at the gold dataset, which spells the date column differently.
    definition.DataSetIdentifierDeclarations[0].DataSetArn =
      'arn:aws:quicksight:us-east-1:1:dataset/orders-gold';
    definition.DataSetIdentifierDeclarations[1].DataSetArn =
      'arn:aws:quicksight:us-east-1:1:dataset/gone';
    const preview = await service().preview(definition);
    expect(preview.canApply).toBe(false);
    expect(preview.datasets[0]).toMatchObject({ readable: true, missing: ['order_date'] });
    expect(preview.datasets[1]).toMatchObject({ readable: false, dataSetId: 'gone' });
    expect(preview.issues.map((i) => i.kind).sort()).toEqual(['column-missing', 'dataset-missing']);
    expect(preview.issues.find((i) => i.kind === 'column-missing')?.fix).toMatchObject({
      op: 'rename',
      to: 'Order Date',
    });
  });

  it('apply refuses what preview flags, and never writes', async () => {
    const definition = sound();
    definition.DataSetIdentifierDeclarations[0].DataSetArn =
      'arn:aws:quicksight:us-east-1:1:dataset/orders-gold';
    await expect(
      service().apply({ assetType: 'analysis', assetId: 'a1' }, { definition, mode: 'update' })
    ).rejects.toThrow(
      'QuickSight would refuse this definition (1 issue): Column order_date is not in orders_gold'
    );
    expect(mocks.qs.updateAnalysis).not.toHaveBeenCalled();
  });

  it('rewrites an analysis in place, keeping its name and theme unless told otherwise', async () => {
    const result = await service().apply(
      { assetType: 'analysis', assetId: 'a1' },
      { definition: sound(), mode: 'update' },
      AUTH
    );
    expect(mocks.qs.updateAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ analysisId: 'a1', name: 'Sales analysis', themeArn: 'arn:theme' })
    );
    expect(result).toMatchObject({ assetId: 'a1', mode: 'update', name: 'Sales analysis' });
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'authoring.update', assetId: 'a1' })
    );
    expect(mocks.qs.tagResource).toHaveBeenCalled();
  });

  it('rewrites a dashboard and publishes the new version, with its publish options kept', async () => {
    const result = await service().apply(
      { assetType: 'dashboard', assetId: 'd1' },
      { definition: sound(), mode: 'update', name: 'Renamed', themeArn: 'arn:other' }
    );
    const call = mocks.qs.updateDashboard.mock.calls[0]![0];
    expect(call).toMatchObject({
      dashboardId: 'd1',
      name: 'Renamed',
      themeArn: 'arn:other',
      dashboardPublishOptions: { AdHocFilteringOption: { AvailabilityStatus: 'ENABLED' } },
    });
    expect(mocks.qs.updateDashboardPublishedVersion).toHaveBeenCalledWith('d1', 4);
    expect(result).toMatchObject({ versionNumber: 4, name: 'Renamed' });
  });

  it("clones with the source audience (or another asset's), into a folder, and needs a name", async () => {
    await expect(
      service().apply(
        { assetType: 'analysis', assetId: 'a1' },
        { definition: sound(), mode: 'clone' }
      )
    ).rejects.toThrow('A name is required');
    await expect(
      service().apply(
        { assetType: 'analysis', assetId: 'a1' },
        { definition: sound(), mode: 'update', folderId: 'f' }
      )
    ).rejects.toThrow('only be chosen when creating a copy');

    const result = await service().apply(
      { assetType: 'analysis', assetId: 'a1' },
      {
        definition: sound(),
        mode: 'clone',
        name: 'Copy',
        newAssetId: 'copy-1',
        folderId: 'f-1',
        permissionsFrom: { assetType: 'dashboard', assetId: 'exec' },
      },
      AUTH
    );
    expect(rebind.permissionsOf).toHaveBeenCalledWith('dashboard', 'exec');
    expect(mocks.qs.createAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: 'copy-1',
        name: 'Copy',
        permissions: expect.any(Array),
      })
    );
    expect(mocks.qs.createFolderMembership).toHaveBeenCalledWith('f-1', 'new-a', 'ANALYSIS');
    expect(result).toMatchObject({ mode: 'clone', folderIds: ['f-1'], assetId: 'new-a' });
    expect(mocks.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'authoring.clone' })
    );
  });

  it('creates a new dashboard from a definition alone, warning when nobody will see it', async () => {
    rebind.permissionsOf.mockResolvedValue(undefined);
    const result = await service().create(
      { assetType: 'dashboard', name: 'Fresh', definition: sound() },
      AUTH
    );
    expect(mocks.qs.createDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Fresh', permissions: undefined })
    );
    expect(result).toMatchObject({ mode: 'create', assetId: 'new-d', versionNumber: 1 });
    expect(result.warnings).toContainEqual(
      expect.stringContaining('Only account admins will see this')
    );
    expect(rebind.loadDefinitionWithTheme).not.toHaveBeenCalled();
  });
});
