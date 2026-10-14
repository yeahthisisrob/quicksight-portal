import { beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogEntry, useTestCatalog } from '../../../../shared/utils/testUtils/testCatalog';
import { DatasetMigrationService } from '../DatasetMigrationService';

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const settings: Record<string, unknown> = {};
vi.mock('../../../../shared/services/settings/SettingsStore', () => ({
  settingsStore: {
    get: (key: string) => settings[key],
    getString: () => '',
    getList: () => [],
    stored: () => ({}),
  },
}));
vi.mock('../../../../shared/services/identity/IdentityResolver', () => ({
  quickSightUserFor: async () => ({ userName: 'rob', arn: 'arn:user/rob' }),
}));
vi.mock('../../../../shared/services/catalog/assetFreshness', () => ({
  keepCatalogFresh: vi.fn(),
}));
vi.mock('../../../../shared/services/audit/AuditLog', () => ({
  auditLog: { record: vi.fn() },
  actorFromAuth: () => ({
    actor: { kind: 'user', id: 'u', label: 'rob@example.com' },
    channel: 'web',
  }),
}));

const quickSight = {
  describeDataset: vi.fn(),
  describeDatasetPermissions: vi.fn(),
  getResourceTags: vi.fn(),
  listRefreshSchedules: vi.fn(),
  createRefreshSchedule: vi.fn(),
  createDataSet: vi.fn(),
  createFolderMembership: vi.fn(),
};
vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => quickSight },
}));

const { seed } = useTestCatalog();

const LEGACY = {
  Name: 'orders_fact',
  ImportMode: 'SPICE',
  PhysicalTableMap: {
    'p-1': {
      CustomSql: {
        DataSourceArn: 'arn:ds',
        Name: 'orders_fact',
        SqlQuery: 'SELECT * FROM "published_prod"."fct_orders"',
        Columns: [
          { Name: 'id', Type: 'INTEGER' },
          { Name: 'amt', Type: 'DECIMAL' },
        ],
      },
    },
  },
  LogicalTableMap: {
    'l-1': {
      Alias: 'orders_fact',
      Source: { PhysicalTableId: 'p-1' },
      DataTransforms: [{ ProjectOperation: { ProjectedColumns: ['id', 'amt'] } }],
    },
  },
  FieldFolders: { Money: { columns: ['amt'] } },
};

const rebind = {
  describeDatasets: vi.fn(async (_type: string, id: string) => ({
    name: id === 'dash-1' ? 'Orders dashboard' : 'Orders analysis',
    datasets: [{ dataSetId: 'ds-1', identifier: 'orders', columns: [{ name: 'amt' }] }],
  })),
  apply: vi.fn(async (..._args: unknown[]) => ({})),
};
const lineage = {
  getLineageMapForAssets: vi.fn(async () => {
    return new Map([
      [
        'dataset:ds-1',
        {
          relationships: [
            {
              relationshipType: 'used_by',
              targetAssetType: 'dashboard',
              targetAssetId: 'dash-1',
              targetAssetName: 'Orders dashboard',
            },
            {
              relationshipType: 'used_by',
              targetAssetType: 'analysis',
              targetAssetId: 'an-1',
              targetAssetName: 'Orders analysis',
            },
          ],
        },
      ],
    ]);
  }),
};
const auth = { userId: 'u', accountId: '1', email: 'rob@example.com' };
const service = () => new DatasetMigrationService('1', rebind as any, lineage as any);

describe('DatasetMigrationService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(settings)) delete settings[key];
    quickSight.describeDataset.mockResolvedValue(structuredClone(LEGACY));
    quickSight.describeDatasetPermissions.mockResolvedValue([
      { Principal: 'arn:group/finance', Actions: ['quicksight:DescribeDataSet'] },
    ]);
    quickSight.getResourceTags.mockResolvedValue([
      { key: 'team', value: 'finance' },
      { key: 'portal:authored-by', value: 'user:someone' },
    ]);
    quickSight.listRefreshSchedules.mockResolvedValue([
      { ScheduleId: 'nightly', Arn: 'arn:sched', RefreshType: 'FULL_REFRESH' },
    ]);
    quickSight.createDataSet.mockResolvedValue({
      arn: 'arn:ds/new',
      dataSetId: 'new',
      ingestionArn: 'arn:aws:quicksight:us-east-1:1:dataset/new/ingestion/ing-1',
    });
    quickSight.createFolderMembership.mockResolvedValue({});
    await seed([
      catalogEntry('dataset', 'ds-1', {
        assetName: 'orders_fact',
        metadata: { folderPath: ['arn:aws:quicksight:us-east-1:1:folder/finance'] },
      }),
    ]);
  });

  it('previews what the twin carries, who reads the original, and where it will be filed', async () => {
    const preview = await service().preview('ds-1', auth);
    expect(preview).toMatchObject({
      dataSetId: 'ds-1',
      name: 'orders_fact',
      importMode: 'SPICE',
      experience: 'legacy',
      carried: ['1 source table'],
      dropped: [],
      refused: [],
      readers: [
        { assetType: 'dashboard', assetId: 'dash-1', name: 'Orders dashboard' },
        { assetType: 'analysis', assetId: 'an-1', name: 'Orders analysis' },
      ],
      folderIds: ['finance'],
    });
  });

  it('says so when the dataset is already in the new experience', async () => {
    quickSight.describeDataset.mockResolvedValue({
      ...LEGACY,
      LogicalTableMap: undefined,
      DataPrepConfiguration: { SourceTableMap: {} },
    });
    const preview = await service().preview('ds-1', auth);
    expect(preview.experience).toBe('dataPrep');
    expect(preview.refused).toEqual(['The dataset is already in the new data prep experience.']);
    await expect(service().migrate('ds-1', {}, auth)).rejects.toThrow('cannot be migrated');
    expect(quickSight.createDataSet).not.toHaveBeenCalled();
  });

  it('creates the twin with the same physical tables as the new pipeline, carrying audience, tags, folders and schedules, and repoints the readers', async () => {
    settings['authoring.defaultFolderIds'] = ['f-default'];
    const result = await service().migrate('ds-1', { rebindReaders: true }, auth);

    const call = quickSight.createDataSet.mock.calls[0]![0];
    expect(call).toMatchObject({
      name: 'orders_fact',
      importMode: 'SPICE',
      fieldFolders: LEGACY.FieldFolders,
    });
    // The same physical table, each column given the id the new experience requires.
    expect(call.physicalTableMap['p-1'].CustomSql).toEqual({
      ...LEGACY.PhysicalTableMap['p-1'].CustomSql,
      Columns: [
        { Id: expect.any(String), Name: 'id', Type: 'INTEGER' },
        { Id: expect.any(String), Name: 'amt', Type: 'DECIMAL' },
      ],
    });
    expect(call.logicalTableMap).toBeUndefined();
    const steps = Object.values(call.dataPrepConfiguration.TransformStepMap) as any[];
    expect(steps.map((s) => Object.keys(s)[0])).toEqual(['ImportTableStep', 'ProjectStep']);
    expect(Object.values(call.semanticModelConfiguration.TableMap)).toEqual([
      expect.objectContaining({ Alias: 'orders_fact' }),
    ]);
    // The original's audience plus the person as owner; its tags minus provenance, plus the twin's own.
    const principals = Object.fromEntries(
      call.permissions.map((p: any) => [p.Principal, p.Actions])
    );
    expect(principals['arn:group/finance']).toEqual(['quicksight:DescribeDataSet']);
    expect(principals['arn:user/rob']).toContain('quicksight:DeleteDataSet');
    expect(call.tags).toEqual(
      expect.arrayContaining([
        { key: 'team', value: 'finance' },
        { key: 'portal:authored-by', value: 'user:rob@example.com' },
      ])
    );
    expect(call.tags.find((t: any) => t.key === 'portal:authored-by').value).not.toBe(
      'user:someone'
    );
    expect(quickSight.createRefreshSchedule).toHaveBeenCalledWith('new', {
      ScheduleId: 'nightly',
      RefreshType: 'FULL_REFRESH',
    });
    expect(quickSight.createFolderMembership.mock.calls.map((c) => c.slice(0, 2))).toEqual([
      ['finance', 'new'],
      ['f-default', 'new'],
    ]);
    expect(rebind.apply.mock.calls.map((c) => [c[0], c[1], c[2]])).toEqual([
      [
        'dashboard',
        'dash-1',
        { mode: 'update', rebinds: [{ identifier: 'orders', targetDataSetId: 'new' }] },
      ],
      [
        'analysis',
        'an-1',
        { mode: 'update', rebinds: [{ identifier: 'orders', targetDataSetId: 'new' }] },
      ],
    ]);
    expect(result).toMatchObject({
      assetType: 'dataset',
      assetId: 'new',
      arn: 'arn:ds/new',
      owner: 'rob',
      ingestionId: 'ing-1',
      folderIds: ['finance', 'f-default'],
      rebound: [
        { assetType: 'dashboard', assetId: 'dash-1', ok: true },
        { assetType: 'analysis', assetId: 'an-1', ok: true },
      ],
    });
  });

  it('leaves readers alone unless asked, and reports one that refused', async () => {
    rebind.apply.mockRejectedValueOnce(new Error('definition locked'));
    const untouched = await service().migrate('ds-1', {}, auth);
    expect(rebind.apply).not.toHaveBeenCalled();
    expect(untouched.rebound).toEqual([]);

    const result = await service().migrate(
      'ds-1',
      { rebindReaders: true, name: 'orders_fact v2' },
      auth
    );
    expect(quickSight.createDataSet.mock.calls[1]![0].name).toBe('orders_fact v2');
    expect(result.rebound).toEqual([
      expect.objectContaining({ assetId: 'dash-1', ok: false, error: 'definition locked' }),
      expect.objectContaining({ assetId: 'an-1', ok: true }),
    ]);
  });

  it('refuses, writing nothing, when the legacy shape cannot be carried', async () => {
    quickSight.describeDataset.mockResolvedValue({
      ...LEGACY,
      LogicalTableMap: {
        'l-1': {
          Alias: 'child',
          Source: { DataSetArn: 'arn:aws:quicksight:us-east-1:1:dataset/parent' },
        },
      },
    });
    const preview = await service().preview('ds-1', auth);
    expect(preview.refused[0]).toContain('built on another dataset');
    await expect(service().migrate('ds-1', {}, auth)).rejects.toThrow('built on another dataset');
    expect(quickSight.createDataSet).not.toHaveBeenCalled();
  });
});
