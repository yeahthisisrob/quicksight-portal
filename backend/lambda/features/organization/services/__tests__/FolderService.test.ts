import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ClientFactory } from '../../../../shared/services/aws/ClientFactory';
import { S3Service } from '../../../../shared/services/aws/S3Service';
import { cacheService } from '../../../../shared/services/cache/CacheService';
import { FolderService } from '../FolderService';

// Mock dependencies
vi.mock('../../../../shared/services/aws/ClientFactory');
vi.mock('../../../../shared/services/aws/S3Service');
vi.mock('../../../../shared/services/cache/CacheService');
vi.mock('../../../../shared/utils/logger');
vi.mock('../TagService');

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
    (S3Service as any).mockImplementation(() => mockS3Service);
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

      // Verify cache was updated
      expect(mockCacheService.updateAsset).toHaveBeenCalledWith(
        'folder',
        folderId,
        expect.objectContaining({
          metadata: expect.objectContaining({
            members: [
              {
                MemberId: 'other-asset',
                MemberArn: 'arn:aws:quicksight:us-east-1:test-account-id:analysis/other-asset',
                MemberType: 'ANALYSIS',
              },
            ],
            memberCount: 1,
          }),
        })
      );

      // Verify S3 export was updated
      expect(mockS3Service.putObject).toHaveBeenCalledWith(
        expect.any(String),
        `assets/folders/${folderId}.json`,
        expect.objectContaining({
          apiResponses: expect.objectContaining({
            listMembers: expect.objectContaining({
              data: [
                {
                  MemberId: 'other-asset',
                  MemberArn: 'arn:aws:quicksight:us-east-1:test-account-id:analysis/other-asset',
                  MemberType: 'ANALYSIS',
                },
              ],
            }),
          }),
        })
      );

      // Verify memory cache was cleared
      expect(mockCacheService.clearMemoryCache).toHaveBeenCalled();
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
});
