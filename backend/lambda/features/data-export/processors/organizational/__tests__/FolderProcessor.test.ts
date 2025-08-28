import { vi, type Mocked } from 'vitest';

/* eslint-disable max-lines-per-function */
import { type QuickSightService } from '../../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../../shared/services/parsing/AssetParserService';
import * as logger from '../../../../../shared/utils/logger';
import { type TagService } from '../../../../organization/services/TagService';
import { FolderProcessor } from '../FolderProcessor';

vi.mock('../../../../../shared/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('FolderProcessor', () => {
  let processor: FolderProcessor;
  let mockQuickSightService: Mocked<QuickSightService>;
  let mockS3Service: Mocked<S3Service>;
  let mockTagService: Mocked<TagService>;
  let mockAssetParserService: Mocked<AssetParserService>;

  beforeEach(() => {
    mockQuickSightService = {
      getAllFolderMembers: vi.fn(),
      describeFolderPermissions: vi.fn(),
      describeFolder: vi.fn(),
    } as any;
    mockS3Service = {} as any;
    mockTagService = {} as any;
    mockAssetParserService = {} as any;

    processor = new FolderProcessor(
      mockQuickSightService,
      mockS3Service,
      mockTagService,
      mockAssetParserService,
      '123456789012'
    );

    vi.clearAllMocks();
  });

  describe('assetType', () => {
    it('should be folder', () => {
      expect(processor.assetType).toBe('folder');
    });
  });

  describe('executeSpecialOperations', () => {
    it('should fetch folder members successfully', async () => {
      const mockMembers = [
        {
          MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash1',
          MemberType: 'DASHBOARD',
        },
        {
          MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/ana1',
          MemberType: 'ANALYSIS',
        },
      ];
      mockQuickSightService.getAllFolderMembers.mockResolvedValue(mockMembers);

      const result = await processor['executeSpecialOperations']('test-folder');

      expect(mockQuickSightService.getAllFolderMembers).toHaveBeenCalledWith('test-folder');
      expect(result).toEqual({
        members: mockMembers,
      });
    });

    it('should infer MemberType from ARN when missing', async () => {
      const mockMembers = [
        { MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash1' },
        { MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/ana1' },
        { MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/data1' },
      ];
      mockQuickSightService.getAllFolderMembers.mockResolvedValue(mockMembers);

      const result = await processor['executeSpecialOperations']('test-folder');

      expect(result.members).toEqual([
        {
          MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash1',
          MemberType: 'DASHBOARD',
        },
        {
          MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/ana1',
          MemberType: 'ANALYSIS',
        },
        {
          MemberArn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/data1',
          MemberType: 'DATASET',
        },
      ]);
    });

    it('should handle errors when fetching members', async () => {
      const error = new Error('API Error');
      mockQuickSightService.getAllFolderMembers.mockRejectedValue(error);

      const result = await processor['executeSpecialOperations']('test-folder');

      expect(logger.logger.warn).toHaveBeenCalledWith(
        'Failed to get members for folder test-folder:',
        error
      );
      expect(result).toEqual({
        members: [],
      });
    });
  });

  describe('inferMemberTypeFromArn', () => {
    const testCases = [
      { arn: 'arn:aws:quicksight:us-east-1:123456789012:dashboard/dash1', expected: 'DASHBOARD' },
      { arn: 'arn:aws:quicksight:us-east-1:123456789012:analysis/ana1', expected: 'ANALYSIS' },
      { arn: 'arn:aws:quicksight:us-east-1:123456789012:dataset/data1', expected: 'DATASET' },
      { arn: 'arn:aws:quicksight:us-east-1:123456789012:datasource/ds1', expected: 'DATASOURCE' },
      { arn: 'arn:aws:quicksight:us-east-1:123456789012:user/default/user1', expected: 'USER' },
      { arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/group1', expected: 'GROUP' },
      { arn: 'arn:aws:quicksight:us-east-1:123456789012:unknown/something', expected: undefined },
    ];

    testCases.forEach(({ arn, expected }) => {
      it(`should identify ${expected || 'unknown'} type`, () => {
        expect(processor['inferMemberTypeFromArn'](arn)).toBe(expected);
      });
    });
  });

  describe('getAssetId', () => {
    it('should extract FolderId', () => {
      const summary = { folderId: 'test-folder' };
      expect(processor['getAssetId'](summary)).toBe('test-folder');
    });

    it('should return empty string if FolderId is missing', () => {
      const summary = {};
      expect(processor['getAssetId'](summary)).toBe('');
    });
  });

  describe('getAssetName', () => {
    it('should extract Name', () => {
      const summary = { name: 'Test Folder' };
      expect(processor['getAssetName'](summary)).toBe('Test Folder');
    });

    it('should return empty string if Name is missing', () => {
      const summary = {};
      expect(processor['getAssetName'](summary)).toBe('');
    });
  });

  describe('getServicePath', () => {
    it('should return folders', () => {
      expect(processor['getServicePath']()).toBe('folders');
    });
  });

  describe('executeGetPermissions', () => {
    it('should fetch folder permissions successfully', async () => {
      const folderId = 'folder-123';
      const mockPermissions = [
        {
          Principal: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Admins',
          Actions: ['quicksight:DescribeFolder', 'quicksight:UpdateFolder'],
        },
      ];

      mockQuickSightService.describeFolderPermissions.mockResolvedValue(mockPermissions);

      const result = await processor['executeGetPermissions'](folderId);

      expect(mockQuickSightService.describeFolderPermissions).toHaveBeenCalledWith(folderId);
      expect(result).toEqual(mockPermissions);
    });

    it('should return empty array when describeFolderPermissions fails', async () => {
      const folderId = 'folder-123';
      const error = new Error('Permission denied');

      mockQuickSightService.describeFolderPermissions.mockRejectedValue(error);

      const result = await processor['executeGetPermissions'](folderId);

      expect(mockQuickSightService.describeFolderPermissions).toHaveBeenCalledWith(folderId);
      expect(result).toEqual([]);
      expect(logger.logger.warn).toHaveBeenCalledWith(
        `Failed to get permissions for folder ${folderId}:`,
        error
      );
    });

    it('should return empty array when permissions is null/undefined', async () => {
      const folderId = 'folder-123';

      mockQuickSightService.describeFolderPermissions.mockResolvedValue(null);

      const result = await processor['executeGetPermissions'](folderId);

      expect(result).toEqual([]);
    });
  });

  describe('executeDescribe', () => {
    it('should fetch folder description successfully', async () => {
      const folderId = 'folder-123';
      const mockFolderData = {
        FolderId: folderId,
        Name: 'Test Folder',
        FolderPath: ['arn:aws:quicksight:us-east-1:123456789012:folder/parent-folder'],
        Arn: 'arn:aws:quicksight:us-east-1:123456789012:folder/folder-123',
        CreatedTime: '2025-01-01T00:00:00.000Z',
        LastUpdatedTime: '2025-01-02T00:00:00.000Z',
      };

      mockQuickSightService.describeFolder.mockResolvedValue(mockFolderData);

      const result = await processor['executeDescribe'](folderId);

      expect(mockQuickSightService.describeFolder).toHaveBeenCalledWith(folderId);
      expect(result).toEqual(mockFolderData);
    });

    it('should return fallback when describeFolder fails', async () => {
      const folderId = 'folder-123';
      const error = new Error('Access denied');

      mockQuickSightService.describeFolder.mockRejectedValue(error);

      const result = await processor['executeDescribe'](folderId);

      expect(mockQuickSightService.describeFolder).toHaveBeenCalledWith(folderId);
      expect(result).toEqual({ FolderName: folderId });
      expect(logger.logger.warn).toHaveBeenCalledWith(
        `Failed to describe folder ${folderId}:`,
        error
      );
    });

    it('should return fallback when folder data is null', async () => {
      const folderId = 'folder-123';

      mockQuickSightService.describeFolder.mockResolvedValue(null);

      const result = await processor['executeDescribe'](folderId);

      expect(result).toEqual({ FolderName: folderId });
    });
  });

  describe('inheritance from OrganizationalProcessor', () => {
    it('should have correct capabilities', () => {
      expect(processor.capabilities).toEqual({
        hasDefinition: false,
        hasPermissions: true,
        hasTags: false,
        hasSpecialOperations: true,
      });
    });

    it('should use collection storage', () => {
      expect(processor.storageType).toBe('collection');
    });
  });
});
