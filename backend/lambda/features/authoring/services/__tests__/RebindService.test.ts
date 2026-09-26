import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  GOLD_COLUMNS,
  ORDERS_ARN,
  REGIONS_ARN,
  sampleDefinition,
} from '../../lib/__tests__/fixtures';
import { RebindService } from '../RebindService';

const mocks = vi.hoisted(() => ({
  qs: {
    describeAnalysisDefinition: vi.fn(),
    describeDashboardDefinition: vi.fn(),
    describeDataset: vi.fn(),
    describeAnalysisPermissions: vi.fn(),
    describeDashboardPermissions: vi.fn(),
    updateAnalysis: vi.fn(),
    updateDashboard: vi.fn(),
    updateDashboardPublishedVersion: vi.fn(),
    createAnalysis: vi.fn(),
    createDashboard: vi.fn(),
    createFolderMembership: vi.fn(),
    describeAnalysis: vi.fn(),
    describeDashboard: vi.fn(),
    tagResource: vi.fn(),
  },
  s3: { getObject: vi.fn() },
  archive: { getArchivedAsset: vi.fn(), markRestored: vi.fn() },
  cache: { getCacheEntries: vi.fn() },
}));

vi.mock('../../../../shared/services/archive/ArchiveService', () => ({
  ArchiveService: vi.fn(function () {
    return mocks.archive;
  }),
}));
vi.mock('../../../../shared/services/cache/CacheService', () => ({ cacheService: mocks.cache }));

const freshness = vi.hoisted(() => vi.fn());
vi.mock('../../../../shared/services/cache/assetFreshness', () => ({ keepCacheFresh: freshness }));
vi.mock('../../../../shared/services/aws/ClientFactory', () => ({
  ClientFactory: { getQuickSightService: () => mocks.qs, getS3Service: () => mocks.s3 },
}));

vi.mock('../../../../shared/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const GOLD_ARN = 'arn:aws:quicksight:us-east-1:1:dataset/orders-gold';
const FULL_MAP = { order_date: 'Order Date' };

describe('RebindService', () => {
  let service: RebindService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qs.describeAnalysisDefinition.mockResolvedValue({
      Name: 'Sales analysis',
      Definition: sampleDefinition(),
      ThemeArn: 'arn:theme',
    });
    mocks.qs.describeDashboardDefinition.mockResolvedValue({
      Name: 'Sales dashboard',
      Definition: sampleDefinition(),
      ThemeArn: 'arn:theme',
      DashboardPublishOptions: { AdHocFilteringOption: { AvailabilityStatus: 'ENABLED' } },
    });
    mocks.qs.describeDataset.mockResolvedValue({
      Arn: GOLD_ARN,
      Name: 'orders_gold',
      OutputColumns: GOLD_COLUMNS,
    });
    mocks.qs.describeAnalysisPermissions.mockResolvedValue([
      { Principal: 'arn:user/rob', Actions: ['quicksight:DescribeAnalysis'] },
    ]);
    mocks.qs.describeDashboardPermissions.mockResolvedValue({
      Permissions: [{ Principal: 'arn:user/rob', Actions: ['quicksight:DescribeDashboard'] }],
      LinkSharingConfiguration: {},
    });
    mocks.qs.updateAnalysis.mockResolvedValue({ arn: 'arn:analysis/a1' });
    mocks.qs.updateDashboard.mockResolvedValue({
      arn: 'arn:dashboard/d1',
      versionArn: 'arn:dashboard/d1/version/7',
    });
    mocks.qs.createAnalysis.mockResolvedValue({ arn: 'arn:analysis/new', analysisId: 'new' });
    mocks.qs.createDashboard.mockResolvedValue({
      arn: 'arn:dashboard/new',
      dashboardId: 'new',
      versionArn: 'arn:dashboard/new/version/1',
    });
    mocks.cache.getCacheEntries.mockResolvedValue([]);
    service = new RebindService('1');
  });

  describe('describeDatasets', () => {
    it('reads the live definition and lists what it takes from each dataset', async () => {
      const result = await service.describeDatasets('analysis', 'a1');

      expect(mocks.qs.describeAnalysisDefinition).toHaveBeenCalledWith('a1');
      expect(result.name).toBe('Sales analysis');
      expect(result.datasets.map((d) => d.identifier)).toEqual(['orders', 'regions']);
      expect(result.datasets[0]?.columns.map((c) => c.name)).toEqual([
        'cost',
        'order_date',
        'revenue',
        'status',
      ]);
    });

    it('uses the dashboard definition API for dashboards', async () => {
      await service.describeDatasets('dashboard', 'd1');
      expect(mocks.qs.describeDashboardDefinition).toHaveBeenCalledWith('d1');
      expect(mocks.qs.describeAnalysisDefinition).not.toHaveBeenCalled();
    });

    it('fails clearly when the definition cannot be loaded', async () => {
      mocks.qs.describeAnalysisDefinition.mockResolvedValue({ Name: 'x' });
      await expect(service.describeDatasets('analysis', 'a1')).rejects.toThrow(
        'Could not load the analysis definition'
      );
    });
  });

  describe('plan', () => {
    it('resolves every referenced column against the target', async () => {
      const plan = await service.plan('analysis', 'a1', [
        { identifier: 'orders', targetDataSetId: 'orders-gold' },
      ]);

      expect(plan.canApply).toBe(false);
      const [orders] = plan.datasets;
      expect(orders?.current).toEqual({ dataSetId: 'orders-silver', dataSetArn: ORDERS_ARN });
      expect(orders?.target).toEqual({
        dataSetId: 'orders-gold',
        dataSetArn: GOLD_ARN,
        name: 'orders_gold',
        columnCount: 5,
      });
      expect(orders?.summary).toEqual({ matched: 3, mapped: 0, suggested: 1, missing: 0 });
      expect(orders?.columns.find((c) => c.name === 'order_date')).toMatchObject({
        status: 'suggested',
        suggestion: 'Order Date',
      });
      expect(orders?.unusedTargetColumns).toEqual(['Order Date', 'customer_id']);
    });

    it('becomes applicable once the caller maps the odd column', async () => {
      const plan = await service.plan('analysis', 'a1', [
        { identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP },
      ]);
      expect(plan.canApply).toBe(true);
      expect(plan.datasets[0]?.summary).toEqual({
        matched: 3,
        mapped: 1,
        suggested: 0,
        missing: 0,
      });
    });

    it('rejects an identifier the definition does not declare', async () => {
      await expect(
        service.plan('analysis', 'a1', [{ identifier: 'ghost', targetDataSetId: 'orders-gold' }])
      ).rejects.toThrow("no dataset identifier 'ghost'. Declared: orders, regions");
    });

    it('rejects the same identifier twice', async () => {
      await expect(
        service.plan('analysis', 'a1', [
          { identifier: 'orders', targetDataSetId: 'orders-gold' },
          { identifier: 'orders', targetDataSetId: 'orders-gold' },
        ])
      ).rejects.toThrow('rebound twice');
    });

    it('falls back to the S3 export when the dataset cannot be described', async () => {
      mocks.qs.describeDataset.mockRejectedValue(new Error('flat file'));
      mocks.s3.getObject.mockResolvedValue({
        apiResponses: {
          describe: { data: { Arn: GOLD_ARN, Name: 'orders_gold', OutputColumns: GOLD_COLUMNS } },
        },
      });

      const plan = await service.plan('analysis', 'a1', [
        { identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP },
      ]);

      expect(mocks.s3.getObject).toHaveBeenCalledWith(
        expect.any(String),
        'assets/datasets/orders-gold.json'
      );
      expect(plan.canApply).toBe(true);
    });

    it('fails when the target dataset exists nowhere', async () => {
      mocks.qs.describeDataset.mockRejectedValue(new Error('nope'));
      mocks.s3.getObject.mockRejectedValue(new Error('NoSuchKey'));
      await expect(
        service.plan('analysis', 'a1', [{ identifier: 'orders', targetDataSetId: 'zzz' }])
      ).rejects.toThrow("Dataset 'zzz' was not found");
    });

    it('fails when the target carries no column information', async () => {
      mocks.qs.describeDataset.mockResolvedValue({ Arn: GOLD_ARN, Name: 'no-cols' });
      mocks.s3.getObject.mockResolvedValue({ apiResponses: {} });
      await expect(
        service.plan('analysis', 'a1', [{ identifier: 'orders', targetDataSetId: 'no-cols' }])
      ).rejects.toThrow('no column information');
    });
  });

  describe('preview', () => {
    it('returns the plan and the definition as apply would write it', async () => {
      const preview = await service.preview('analysis', 'a1', {
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
      });
      expect(preview.plan.canApply).toBe(true);
      expect(preview.definition.DataSetIdentifierDeclarations[0].DataSetArn).toBe(GOLD_ARN);
      expect(preview.changes.map((c) => c.kind)).toEqual(['rebind', 'rename']);
      // Placed visuals first, then controls the layout does not place
      expect(preview.outline[0]?.elements.map((e) => e.elementId)).toEqual([
        'v1',
        'v2',
        'c1',
        'c2',
      ]);
      expect(mocks.qs.updateAnalysis).not.toHaveBeenCalled();
    });

    it('says which datasets a cross-dataset filter cannot reach', async () => {
      mocks.qs.describeDataset.mockImplementation(async (id: string) =>
        id.includes('regions')
          ? {
              Arn: REGIONS_ARN,
              Name: 'regions',
              OutputColumns: [{ Name: 'region_name', Type: 'STRING' }],
            }
          : { Arn: GOLD_ARN, Name: 'orders_gold', OutputColumns: GOLD_COLUMNS }
      );
      const preview = await service.preview('analysis', 'a1', { rebinds: [] });
      expect(preview.warnings).toEqual([
        expect.stringContaining("'regions' has no column 'status', so it will not be filtered"),
      ]);
    });

    it('never applies a suggestion the caller has not accepted', async () => {
      const preview = await service.preview('analysis', 'a1', {
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold' }],
      });
      expect(preview.plan.canApply).toBe(false);
      expect(
        preview.definition.Sheets[0].Visuals[1].KPIVisual.ChartConfiguration.FieldWells
          .TrendGroups[0].DateDimensionField.Column.ColumnName
      ).toBe('order_date');
    });
  });

  describe('apply', () => {
    it('refuses while any column is unresolved and names them', async () => {
      await expect(
        service.apply('analysis', 'a1', {
          mode: 'update',
          rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold' }],
        })
      ).rejects.toThrow("orders.order_date (did you mean 'Order Date'?)");
      expect(mocks.qs.updateAnalysis).not.toHaveBeenCalled();
    });

    it('refuses an added calculated field that reads a column the target lacks, after warning in preview', async () => {
      // QuickSight would fail the whole write over it and leave a broken
      // asset; the preview says so and apply stops before writing.
      const request = {
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
        addCalculatedFields: [
          { identifier: 'orders', name: 'net', expression: '{revenue} - {tax} - {margin}' },
        ],
      };
      const preview = await service.preview('analysis', 'a1', request);
      expect(preview.warnings).toEqual([
        expect.stringContaining(
          "Calculated field 'net' reads 'tax', which orders_gold does not have"
        ),
      ]);
      await expect(service.apply('analysis', 'a1', { mode: 'update', ...request })).rejects.toThrow(
        "Calculated field 'net' reads 'tax'"
      );
      expect(mocks.qs.updateAnalysis).not.toHaveBeenCalled();
    });

    it('updates an analysis in place with the rewritten definition', async () => {
      const result = await service.apply('analysis', 'a1', {
        mode: 'update',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
      });

      expect(mocks.qs.updateAnalysis).toHaveBeenCalledTimes(1);
      const call = mocks.qs.updateAnalysis.mock.calls[0]?.[0];
      expect(call.analysisId).toBe('a1');
      expect(call.name).toBe('Sales analysis');
      expect(call.themeArn).toBe('arn:theme');
      expect(call.definition.DataSetIdentifierDeclarations[0].DataSetArn).toBe(GOLD_ARN);
      expect(
        call.definition.Sheets[0].Visuals[1].KPIVisual.ChartConfiguration.FieldWells.TrendGroups[0]
          .DateDimensionField.Column.ColumnName
      ).toBe('Order Date');
      expect(result).toMatchObject({
        assetType: 'analysis',
        assetId: 'a1',
        name: 'Sales analysis',
        arn: 'arn:analysis/a1',
        mode: 'update',
      });
      expect(result.plan.canApply).toBe(true);
    });

    it('updates a dashboard and publishes the new version', async () => {
      const result = await service.apply('dashboard', 'd1', {
        mode: 'update',
        name: 'Sales dashboard (gold)',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
      });

      const call = mocks.qs.updateDashboard.mock.calls[0]?.[0];
      expect(call).toMatchObject({
        dashboardId: 'd1',
        name: 'Sales dashboard (gold)',
        themeArn: 'arn:theme',
        dashboardPublishOptions: { AdHocFilteringOption: { AvailabilityStatus: 'ENABLED' } },
      });
      expect(mocks.qs.updateDashboardPublishedVersion).toHaveBeenCalledWith('d1', 7);
      expect(result.versionNumber).toBe(7);
    });

    it('fails loudly if the dashboard version cannot be read back', async () => {
      mocks.qs.updateDashboard.mockResolvedValue({ arn: 'arn:dashboard/d1' });
      await expect(
        service.apply('dashboard', 'd1', {
          mode: 'update',
          rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
        })
      ).rejects.toThrow('new version could not be determined');
      expect(mocks.qs.updateDashboardPublishedVersion).not.toHaveBeenCalled();
    });

    it('allows a rename-only update', async () => {
      await service.apply('analysis', 'a1', { mode: 'update', rebinds: [], name: 'Renamed' });
      const call = mocks.qs.updateAnalysis.mock.calls[0]?.[0];
      expect(call.name).toBe('Renamed');
      expect(call.definition).toEqual(sampleDefinition());
    });

    it('refuses an update that changes nothing', async () => {
      await expect(
        service.apply('analysis', 'a1', { mode: 'update', rebinds: [] })
      ).rejects.toThrow('Nothing to do');
    });

    it('clones an analysis with the source permissions and a generated id', async () => {
      const result = await service.apply('analysis', 'a1', {
        mode: 'clone',
        name: 'Sales analysis (gold)',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
      });

      const call = mocks.qs.createAnalysis.mock.calls[0]?.[0];
      expect(call.analysisId).toMatch(/^[0-9a-f-]{36}$/);
      expect(call.name).toBe('Sales analysis (gold)');
      expect(call.permissions).toEqual([
        { Principal: 'arn:user/rob', Actions: ['quicksight:DescribeAnalysis'] },
      ]);
      expect(call.definition.DataSetIdentifierDeclarations[0].DataSetArn).toBe(GOLD_ARN);
      expect(mocks.qs.updateAnalysis).not.toHaveBeenCalled();
      expect(result).toMatchObject({ assetId: 'new', arn: 'arn:analysis/new', mode: 'clone' });
    });

    it('clones a dashboard, honouring a requested id and normalising permissions', async () => {
      const result = await service.apply('dashboard', 'd1', {
        mode: 'clone',
        name: 'Copy',
        newAssetId: 'my-copy',
        rebinds: [],
      });

      const call = mocks.qs.createDashboard.mock.calls[0]?.[0];
      expect(call.dashboardId).toBe('my-copy');
      expect(call.permissions).toEqual([
        { Principal: 'arn:user/rob', Actions: ['quicksight:DescribeDashboard'] },
      ]);
      expect(call.definition).toEqual(sampleDefinition());
      expect(result.versionNumber).toBe(1);
    });

    it('applies edit ops after the rebind and places a clone in a folder', async () => {
      mocks.qs.createFolderMembership.mockResolvedValue({});
      const result = await service.apply('dashboard', 'd1', {
        mode: 'clone',
        name: 'Copy',
        folderId: 'f-1',
        rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
        ops: [
          { op: 'retitle', sheetId: 's1', elementId: 'v1', title: 'Revenue by status (gold)' },
          { op: 'move', sheetId: 's1', elementId: 'v2', col: 0, row: 12 },
        ],
      });
      const call = mocks.qs.createDashboard.mock.calls[0]?.[0];
      expect(call.definition.Sheets[0].Visuals[0].BarChartVisual.Title.FormatText.PlainText).toBe(
        'Revenue by status (gold)'
      );
      const moved = call.definition.Sheets[0].Layouts[0].Configuration.GridLayout.Elements.find(
        (e: any) => e.ElementId === 'v2'
      );
      expect(moved).toMatchObject({ ColumnIndex: 0, RowIndex: 12 });
      expect(mocks.qs.createFolderMembership).toHaveBeenCalledWith('f-1', 'new', 'DASHBOARD');
      expect(result.folderIds).toEqual(['f-1']);
      expect(result.changes.map((c) => c.kind)).toEqual(['rebind', 'rename', 'visual', 'layout']);
    });

    it('refuses a folder for an in-place update', async () => {
      await expect(
        service.apply('analysis', 'a1', { mode: 'update', name: 'x', rebinds: [], folderId: 'f' })
      ).rejects.toThrow('creating a copy');
    });

    it('requires a name to clone', async () => {
      await expect(service.apply('analysis', 'a1', { mode: 'clone', rebinds: [] })).rejects.toThrow(
        'A name is required to clone'
      );
    });

    it('omits permissions when the source has none rather than sending an empty list', async () => {
      mocks.qs.describeAnalysisPermissions.mockResolvedValue([]);
      await service.apply('analysis', 'a1', { mode: 'clone', name: 'Copy', rebinds: [] });
      expect(mocks.qs.createAnalysis.mock.calls[0]?.[0].permissions).toBeUndefined();
    });
  });
});

describe('RebindService restoring an archived asset', () => {
  const ROB = 'arn:aws:quicksight:us-east-1:1:user/default/rob';
  const GONE = 'arn:aws:quicksight:us-east-1:1:user/default/left-the-company';
  const ANALYSTS = 'arn:aws:quicksight:us-east-1:1:group/default/analysts';
  const notFound = () =>
    Object.assign(new Error('not found'), { name: 'ResourceNotFoundException' });
  let service: RebindService;

  function archivedRecord(overrides: Record<string, any> = {}) {
    return {
      apiResponses: {
        definition: {
          data: {
            Name: 'Sales analysis',
            Definition: sampleDefinition(),
            ThemeArn: 'arn:theme',
          },
        },
        permissions: {
          data: [
            { Principal: ROB, Actions: ['quicksight:DescribeAnalysis'] },
            { Principal: GONE, Actions: ['quicksight:DescribeAnalysis'] },
            { Principal: ANALYSTS, Actions: ['quicksight:DescribeAnalysis'] },
          ],
        },
        tags: {
          data: [
            { key: 'team', value: 'sales' },
            { key: 'portal:channel', value: 'ui' },
          ],
        },
        ...overrides,
      },
      archivedMetadata: { archivedAt: '2026-09-01T00:00:00Z', archiveReason: 'Deleted via portal' },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.archive.getArchivedAsset.mockResolvedValue(archivedRecord());
    mocks.qs.describeAnalysis.mockRejectedValue(notFound());
    mocks.qs.describeDashboard.mockRejectedValue(notFound());
    mocks.qs.describeDataset.mockResolvedValue({
      Arn: GOLD_ARN,
      Name: 'orders_gold',
      OutputColumns: GOLD_COLUMNS,
    });
    mocks.qs.createAnalysis.mockResolvedValue({ arn: 'arn:analysis/a1', analysisId: 'a1' });
    mocks.cache.getCacheEntries.mockImplementation(async ({ assetType }: any) =>
      assetType === 'user' ? [{ arn: ROB }] : [{ arn: ANALYSTS }]
    );
    service = new RebindService('1');
  });

  it('reads the archived definition, never QuickSight, when asked for the archive', async () => {
    const result = await service.describeDatasets('analysis', 'a1', 'archive');
    expect(result.name).toBe('Sales analysis');
    expect(mocks.qs.describeAnalysisDefinition).not.toHaveBeenCalled();
    expect(mocks.archive.getArchivedAsset).toHaveBeenCalledWith('analysis', 'a1');
  });

  it('restores under its old id with its audience, less who is gone, and its tags', async () => {
    const result = await service.restore('analysis', 'a1', { rebinds: [] });

    const call = mocks.qs.createAnalysis.mock.calls[0]?.[0];
    expect(call.analysisId).toBe('a1');
    expect(call.name).toBe('Sales analysis');
    expect(call.themeArn).toBe('arn:theme');
    expect(call.permissions.map((p: any) => p.Principal)).toEqual([ROB, ANALYSTS]);
    expect(mocks.qs.tagResource).toHaveBeenCalledWith('analysis', 'a1', [
      { key: 'team', value: 'sales' },
    ]);
    expect(mocks.archive.markRestored).toHaveBeenCalledWith(
      'analysis',
      'a1',
      expect.objectContaining({ restoredAs: 'a1', restoredBy: 'the portal' })
    );
    expect(result).toMatchObject({ assetId: 'a1', mode: 'restore' });
    expect(result.warnings?.[0]).toContain('left-the-company');
  });

  it('refuses the old id while QuickSight holds it, and takes a new one', async () => {
    mocks.qs.describeAnalysis.mockResolvedValue({
      AnalysisId: 'a1',
      Status: 'CREATION_SUCCESSFUL',
    });
    await expect(service.restore('analysis', 'a1', { rebinds: [] })).rejects.toThrow(
      'restore it under a new id'
    );
    mocks.qs.describeAnalysis.mockImplementation(async (id: string) => {
      if (id === 'a1') return { Status: 'DELETED' };
      throw notFound();
    });
    await expect(service.restore('analysis', 'a1', { rebinds: [] })).rejects.toThrow(
      'recovery window'
    );
    await service.restore('analysis', 'a1', { rebinds: [], newAssetId: 'a1-restored' });
    expect(mocks.qs.createAnalysis.mock.calls[0]?.[0].analysisId).toBe('a1-restored');
  });

  it('applies repairs, dataset choices and edits before it writes', async () => {
    const result = await service.restore('analysis', 'a1', {
      rebinds: [{ identifier: 'orders', targetDataSetId: 'orders-gold', columnMap: FULL_MAP }],
      ops: [{ op: 'retitle', sheetId: 's1', elementId: 'v1', title: 'Back again' }],
    });
    const call = mocks.qs.createAnalysis.mock.calls[0]?.[0];
    expect(call.definition.DataSetIdentifierDeclarations[0].DataSetArn).toBe(GOLD_ARN);
    expect(call.definition.Sheets[0].Visuals[0].BarChartVisual.Title.FormatText.PlainText).toBe(
      'Back again'
    );
    expect(result.changes.map((c) => c.kind)).toContain('visual');
  });

  it('says so when the archive kept no audience or shared the dashboard by link', async () => {
    mocks.archive.getArchivedAsset.mockResolvedValue(
      archivedRecord({
        definition: { data: { Name: 'Board', Definition: sampleDefinition() } },
        permissions: { data: { Permissions: [], LinkSharingConfiguration: { Permissions: [{}] } } },
      })
    );
    mocks.qs.createDashboard.mockResolvedValue({
      arn: 'arn:dashboard/d1',
      dashboardId: 'd1',
      versionArn: 'arn:dashboard/d1/version/1',
    });
    const result = await service.restore('dashboard', 'd1', { rebinds: [] });
    expect(result.warnings?.join(' ')).toContain('shared by link');
    expect(result.warnings?.join(' ')).toContain('kept no audience');
  });

  it('reads the new asset back and says what QuickSight still objects to', async () => {
    mocks.qs.describeAnalysis.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({
      Status: 'CREATION_SUCCESSFUL',
      Errors: [{ Type: 'COLUMN_NOT_FOUND', Message: 'Column margin was not found' }],
    });
    const result = await service.restore('analysis', 'a1', { rebinds: [] });
    expect(result.warnings?.join(' ')).toContain(
      'QuickSight still reports 1 error: COLUMN_NOT_FOUND: Column margin was not found'
    );
  });

  it('refuses an archive without a definition', async () => {
    mocks.archive.getArchivedAsset.mockResolvedValue({ apiResponses: {} });
    await expect(service.restore('analysis', 'a1', { rebinds: [] })).rejects.toThrow(
      'has no definition'
    );
  });
});

describe('RebindService with a template', () => {
  const template = () => ({
    DataSetIdentifierDeclarations: [{ Identifier: 'tpl', DataSetArn: 'arn:tpl' }],
    Sheets: [
      {
        SheetId: 'ts',
        Name: 'Standard overview',
        TextBoxes: [{ SheetTextBoxId: 'title', Content: 'Team dashboard' }],
        Visuals: [{ BarChartVisual: { VisualId: 'tb1' } }],
        Layouts: [
          {
            Configuration: {
              GridLayout: {
                Elements: [
                  {
                    ElementId: 'title',
                    ElementType: 'TEXT_BOX',
                    ColumnIndex: 0,
                    ColumnSpan: 36,
                    RowIndex: 0,
                    RowSpan: 2,
                  },
                  {
                    ElementId: 'tb1',
                    ElementType: 'VISUAL',
                    ColumnIndex: 0,
                    ColumnSpan: 12,
                    RowIndex: 2,
                    RowSpan: 8,
                  },
                ],
              },
            },
          },
        ],
      },
    ],
  });

  let service: RebindService;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.qs.describeDashboardDefinition.mockImplementation(async (id: string) =>
      id === 'tpl'
        ? { Name: 'Template', Definition: template(), ThemeArn: 'arn:theme-tpl' }
        : { Name: 'Sales', Definition: sampleDefinition(), ThemeArn: 'arn:theme' }
    );
    mocks.qs.describeDataset.mockResolvedValue({
      Arn: GOLD_ARN,
      Name: 'orders_gold',
      OutputColumns: GOLD_COLUMNS,
    });
    mocks.qs.updateDashboard.mockResolvedValue({
      arn: 'arn:dashboard/d1',
      versionArn: 'arn:dashboard/d1/version/8',
    });
    service = new RebindService('1');
  });

  it('previews the source laid out on the template, with its sheet names and theme', async () => {
    const preview = await service.preview('dashboard', 'd1', {
      rebinds: [],
      template: { assetType: 'dashboard', assetId: 'tpl' },
    });

    expect(preview.themeArn).toBe('arn:theme-tpl');
    expect(preview.definition.Sheets[0].Name).toBe('Standard overview');
    expect(preview.definition.Sheets[0].TextBoxes.map((t: any) => t.Content)).toEqual([
      'Team dashboard',
    ]);
    const elements = preview.definition.Sheets[0].Layouts[0].Configuration.GridLayout.Elements;
    expect(
      elements
        .filter((e: any) => e.ElementType === 'VISUAL')
        .map((e: any) => [e.ColumnSpan, e.RowSpan])
    ).toEqual([
      [12, 8],
      [12, 8],
    ]);
    expect(preview.changes.some((c) => c.kind === 'template')).toBe(true);
    expect(preview.outline[0]?.elements.length).toBeGreaterThan(2);
  });

  it('writes the template theme on apply, or keeps the source theme when told not to', async () => {
    await service.apply('dashboard', 'd1', {
      mode: 'update',
      rebinds: [],
      template: { assetType: 'dashboard', assetId: 'tpl' },
    });
    expect(mocks.qs.updateDashboard).toHaveBeenLastCalledWith(
      expect.objectContaining({ dashboardId: 'd1', themeArn: 'arn:theme-tpl' })
    );

    await service.apply('dashboard', 'd1', {
      mode: 'update',
      rebinds: [],
      template: { assetType: 'dashboard', assetId: 'tpl', theme: false, sheetNames: false },
    });
    const last = mocks.qs.updateDashboard.mock.calls.at(-1)![0];
    expect(last.themeArn).toBe('arn:theme');
    expect(last.definition.Sheets[0].Name).toBe('Overview');
  });
});
