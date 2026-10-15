import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ClientFactory } from '../../aws/ClientFactory';
import { S3Service } from '../../aws/S3Service';
import { cacheService } from '../../cache/CacheService';
import { FolderService } from '../FolderService';

// Mock dependencies
vi.mock('../../aws/ClientFactory');
vi.mock('../../aws/S3Service');
vi.mock('../../cache/CacheService');
vi.mock('../../../utils/logger');
vi.mock('../TagService');
const freshness = vi.hoisted(() => vi.fn());
vi.mock('../../catalog/assetFreshness', () => ({ keepCatalogFresh: freshness }));
const store = vi.hoisted(() => ({
  get: vi.fn(),
  archive: vi.fn(),
  list: vi.fn().mockResolvedValue([]),
  snapshot: vi.fn().mockResolvedValue({ entries: {} }),
}));
vi.mock('../../catalog/catalogStore', () => ({ catalog: store }));

describe('FolderService', () => {
  let folderService: FolderService;
  let mockQuickSightService: any;
  let mockS3Service: any;
  let mockCacheService: any;

  beforeEach(() => {
    // Setup mocks
    mockQuickSightService = {
      createFolderMembership: vi.fn().mockResolvedValue({}),
      deleteFolderMembership: vi.fn().mockResolvedValue({}),
      listFolders: vi.fn().mockResolvedValue([]),
      listFolderMembers: vi.fn().mockResolvedValue([]),
      updateFolderPermissions: vi.fn().mockResolvedValue({}),
      createFolder: vi.fn().mockResolvedValue({ arn: 'arn:folder/new', folderId: 'new' }),
      deleteFolder: vi.fn().mockResolvedValue(undefined),
      describeFolderPermissions: vi.fn().mockResolvedValue([]),
    };

    mockS3Service = {
      getObject: vi.fn(),
      putObject: vi.fn().mockResolvedValue({}),
    };

    mockCacheService = {
      getCacheEntries: vi.fn().mockResolvedValue([]),
      updateAsset: vi.fn().mockResolvedValue({}),
      clearMemoryCache: vi.fn().mockResolvedValue({}),
    };

    // Setup mock returns
    (ClientFactory.getQuickSightService as any).mockReturnValue(mockQuickSightService);
    (S3Service as any).mockImplementation(function () {
      return mockS3Service;
    });
    (cacheService as any).getCacheEntries = mockCacheService.getCacheEntries;
    (cacheService as any).updateAsset = mockCacheService.updateAsset;
    (cacheService as any).clearMemoryCache = mockCacheService.clearMemoryCache;

    // Create service instance
    folderService = new FolderService('test-account-id');
  });

  describe('removeAssetFromFolder', () => {
    it('should successfully remove an asset from a folder', async () => {
      const folderId = 'folder-123';
      const assetId = 'dashboard-456';
      const memberType = 'DASHBOARD';
      // Setup folder in cache
      const mockFolder = {
        assetId: folderId,
        assetName: 'Test Folder',
        metadata: {
          members: [
            {
              MemberId: assetId,
              MemberArn: `arn:aws:quicksight:us-east-1:test-account-id:dashboard/${assetId}`,
              MemberType: memberType,
            },
            {
              MemberId: 'other-asset',
              MemberArn: 'arn:aws:quicksight:us-east-1:test-account-id:analysis/other-asset',
              MemberType: 'ANALYSIS',
            },
          ],
          memberCount: 2,
        },
      };

      mockCacheService.getCacheEntries.mockResolvedValue([mockFolder]);

      // Setup S3 export data
      const mockExportData = {
        apiResponses: {
          listMembers: {
            timestamp: '2024-01-01T00:00:00Z',
            data: mockFolder.metadata.members,
          },
        },
      };
      mockS3Service.getObject.mockResolvedValue(mockExportData);

      // Execute
      await folderService.removeAssetFromFolder(folderId, assetId, memberType as any);

      // Verify QuickSight API was called
      expect(mockQuickSightService.deleteFolderMembership).toHaveBeenCalledWith(
        folderId,
        assetId,
        memberType
      );

      // The folder and the asset are re-read from QuickSight (the folder lives
      // in the shared collection file; nothing is patched by hand)
      expect(freshness).toHaveBeenCalledWith([
        { assetType: 'folder', assetId: folderId },
        { assetType: 'dashboard', assetId },
      ]);
      expect(mockS3Service.putObject).not.toHaveBeenCalled();
    });

    it('should throw error when QuickSight API fails', async () => {
      const folderId = 'folder-123';
      const assetId = 'dashboard-456';
      const memberType = 'DASHBOARD';

      mockQuickSightService.deleteFolderMembership.mockRejectedValue(
        new Error('QuickSight API error')
      );

      await expect(
        folderService.removeAssetFromFolder(folderId, assetId, memberType as any)
      ).rejects.toThrow('QuickSight API error');

      expect(mockCacheService.updateAsset).not.toHaveBeenCalled();
      expect(mockCacheService.clearMemoryCache).not.toHaveBeenCalled();
    });
  });

  describe('addAssetToFolder', () => {
    it('should successfully add an asset to a folder', async () => {
      await folderService.addAssetToFolder('folder-123', 'dashboard-456', 'DASHBOARD' as any);

      expect(mockQuickSightService.createFolderMembership).toHaveBeenCalledWith(
        'folder-123',
        'dashboard-456',
        'DASHBOARD'
      );
    });

    it('should throw error when QuickSight API fails', async () => {
      mockQuickSightService.createFolderMembership.mockRejectedValue(
        new Error('Failed to add member')
      );

      await expect(
        folderService.addAssetToFolder('folder-123', 'dashboard-456', 'DASHBOARD' as any)
      ).rejects.toThrow('Failed to add member');
    });
  });
  describe('create, delete and permissions', () => {
    it('creates a shared folder with a fresh id and tells the catalog at once', async () => {
      freshness.mockReset();
      const created = await folderService.create({ name: '  Finance  ' });
      expect(mockQuickSightService.createFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Finance',
          folderType: 'SHARED',
          folderId: created.folderId,
        })
      );
      expect(created.arn).toBe('arn:folder/new');
      expect(freshness).toHaveBeenCalledWith([
        { assetType: 'folder', assetId: created.folderId, name: 'Finance', arn: 'arn:folder/new' },
      ]);
    });

    it('refuses to delete a folder that still holds assets unless forced, then takes them out first', async () => {
      mockQuickSightService.listFolderMembers.mockResolvedValue([
        { MemberId: 'd1', MemberType: 'DASHBOARD', MemberArn: 'arn:...:dashboard/d1' },
      ]);
      await expect(folderService.remove('f1')).rejects.toThrow(/still holds 1 asset/);
      expect(mockQuickSightService.deleteFolder).not.toHaveBeenCalled();

      const result = await folderService.remove('f1', { force: true, by: 'pat' });
      expect(mockQuickSightService.deleteFolderMembership).toHaveBeenCalledWith(
        'f1',
        'd1',
        'DASHBOARD'
      );
      expect(mockQuickSightService.deleteFolder).toHaveBeenCalledWith('f1');
      expect(result).toEqual({ folderId: 'f1', removedMembers: 1 });
    });

    it('reads who is on a folder with the role their actions amount to', async () => {
      mockQuickSightService.describeFolderPermissions.mockResolvedValue([
        {
          Principal: 'arn:aws:quicksight:us-east-1:1:group/default/analysts',
          Actions: ['quicksight:DescribeFolder', 'quicksight:CreateAnalysis'],
        },
        {
          Principal: 'arn:aws:quicksight:us-east-1:1:user/default/pat',
          Actions: ['quicksight:DescribeFolder', 'quicksight:UpdateFolderPermissions'],
        },
        {
          Principal: 'arn:aws:quicksight:us-east-1:1:user/default/sam',
          Actions: ['quicksight:DescribeFolder'],
        },
      ]);
      const permissions = await folderService.permissions('f1');
      expect(permissions.map((p) => [p.name, p.type, p.role])).toEqual([
        ['default/analysts', 'GROUP', 'AUTHOR'],
        ['default/pat', 'USER', 'ADMIN'],
        ['default/sam', 'USER', 'VIEWER'],
      ]);
    });
  });
});
