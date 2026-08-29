import { vi } from 'vitest';

import { isRenameableAssetType, RenameService } from '../RenameService';

const OVER_MAX_NAME_LENGTH = 201;
const PUBLISHED_VERSION = 7;

const mocks = vi.hoisted(() => ({
  qs: {
    describeAnalysisDefinition: vi.fn(),
    updateAnalysis: vi.fn(),
    describeDashboardDefinition: vi.fn(),
    updateDashboard: vi.fn(),
    updateDashboardPublishedVersion: vi.fn(),
    describeDataset: vi.fn(),
    updateDataSet: vi.fn(),
    updateFolder: vi.fn(),
  },
  cache: {
    updateAsset: vi.fn(),
  },
}));

vi.mock('../../../../shared/services/aws/QuickSightService', () => ({
  QuickSightService: vi.fn(() => mocks.qs),
}));
vi.mock('../../../../shared/services/cache/CacheService', () => ({
  cacheService: mocks.cache,
}));
vi.mock('../../../../shared/utils/logger');

describe('isRenameableAssetType', () => {
  it('allows dashboard/analysis/dataset/folder only', () => {
    expect(isRenameableAssetType('dashboard')).toBe(true);
    expect(isRenameableAssetType('analysis')).toBe(true);
    expect(isRenameableAssetType('dataset')).toBe(true);
    expect(isRenameableAssetType('folder')).toBe(true);
    // No rename support: datasource (connection params), user/group (no API)
    expect(isRenameableAssetType('datasource')).toBe(false);
    expect(isRenameableAssetType('user')).toBe(false);
    expect(isRenameableAssetType('group')).toBe(false);
  });
});

describe('RenameService', () => {
  let service: RenameService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new RenameService('123456789012');
  });

  it('rejects empty and oversized names', async () => {
    await expect(service.renameAsset('folder', 'f-1', '   ')).rejects.toThrow(/between 1 and 200/);
    await expect(
      service.renameAsset('folder', 'f-1', 'x'.repeat(OVER_MAX_NAME_LENGTH))
    ).rejects.toThrow(/between 1 and 200/);
  });

  it('renames a folder with the name-only API and updates the cache', async () => {
    const result = await service.renameAsset('folder', 'f-1', '  New Folder Name  ');

    expect(mocks.qs.updateFolder).toHaveBeenCalledWith({
      folderId: 'f-1',
      name: 'New Folder Name',
    });
    expect(mocks.cache.updateAsset).toHaveBeenCalledWith('folder', 'f-1', {
      assetName: 'New Folder Name',
    });
    expect(result).toEqual({ name: 'New Folder Name' });
  });

  it('renames a dashboard by resending its definition and publishing the new version', async () => {
    mocks.qs.describeDashboardDefinition.mockResolvedValue({
      Definition: { Sheets: [] },
      ThemeArn: 'arn:theme',
      DashboardPublishOptions: { AdHocFilteringOption: {} },
    });
    mocks.qs.updateDashboard.mockResolvedValue({
      versionArn: 'arn:aws:quicksight:us-east-1:123:dashboard/d-1/version/7',
    });

    await service.renameAsset('dashboard', 'd-1', 'Renamed Dashboard');

    expect(mocks.qs.updateDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        dashboardId: 'd-1',
        name: 'Renamed Dashboard',
        definition: { Sheets: [] },
        themeArn: 'arn:theme',
      })
    );
    // Viewers only see the rename once the draft version is published
    expect(mocks.qs.updateDashboardPublishedVersion).toHaveBeenCalledWith('d-1', PUBLISHED_VERSION);
  });

  it('fails loudly when the new dashboard version cannot be determined', async () => {
    mocks.qs.describeDashboardDefinition.mockResolvedValue({ Definition: {} });
    mocks.qs.updateDashboard.mockResolvedValue({ versionArn: undefined });

    await expect(service.renameAsset('dashboard', 'd-1', 'Name')).rejects.toThrow(
      /could not be determined for publishing/
    );
  });

  it('renames a dataset by resending its full specification', async () => {
    mocks.qs.describeDataset.mockResolvedValue({
      PhysicalTableMap: { t1: {} },
      LogicalTableMap: { l1: {} },
      ImportMode: 'SPICE',
      DataSetUsageConfiguration: { DisableUseAsDirectQuerySource: false },
    });

    await service.renameAsset('dataset', 'ds-1', 'Renamed Dataset');

    expect(mocks.qs.updateDataSet).toHaveBeenCalledWith(
      expect.objectContaining({
        dataSetId: 'ds-1',
        name: 'Renamed Dataset',
        physicalTableMap: { t1: {} },
        logicalTableMap: { l1: {} },
        importMode: 'SPICE',
      })
    );
  });

  it('refuses to rename datasets it cannot describe (e.g. flat-file uploads)', async () => {
    mocks.qs.describeDataset.mockResolvedValue(undefined);

    await expect(service.renameAsset('dataset', 'ds-1', 'Name')).rejects.toThrow(/flat-file/);
    expect(mocks.qs.updateDataSet).not.toHaveBeenCalled();
  });

  it('treats a cache update failure as non-fatal after a successful rename', async () => {
    mocks.cache.updateAsset.mockRejectedValue(new Error('cache down'));

    const result = await service.renameAsset('folder', 'f-1', 'Still Renamed');

    expect(result).toEqual({ name: 'Still Renamed' });
  });
});
