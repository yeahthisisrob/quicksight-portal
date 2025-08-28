import { vi, type Mocked } from 'vitest';

import { type QuickSightService } from '../../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../../shared/services/parsing/AssetParserService';
import * as logger from '../../../../../shared/utils/logger';
import { type TagService } from '../../../../organization/services/TagService';
import { GroupProcessor } from '../GroupProcessor';

vi.mock('../../../../../shared/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('GroupProcessor', () => {
  let processor: GroupProcessor;
  let mockQuickSightService: Mocked<QuickSightService>;
  let mockS3Service: Mocked<S3Service>;
  let mockTagService: Mocked<TagService>;
  let mockAssetParserService: Mocked<AssetParserService>;

  beforeEach(() => {
    mockQuickSightService = {
      listGroupMemberships: vi.fn(),
    } as any;
    mockS3Service = {} as any;
    mockTagService = {} as any;
    mockAssetParserService = {} as any;

    processor = new GroupProcessor(
      mockQuickSightService,
      mockS3Service,
      mockTagService,
      mockAssetParserService,
      '123456789012'
    );

    vi.clearAllMocks();
  });

  describe('assetType', () => {
    it('should be group', () => {
      expect(processor.assetType).toBe('group');
    });
  });

  describe('executeSpecialOperations', () => {
    it('should fetch group members successfully', async () => {
      const mockMembers = [
        { UserName: 'user1', Arn: 'arn:user1' },
        { UserName: 'user2', Arn: 'arn:user2' },
      ];
      mockQuickSightService.listGroupMemberships.mockResolvedValue(mockMembers);

      const result = await processor['executeSpecialOperations']('test-group');

      expect(mockQuickSightService.listGroupMemberships).toHaveBeenCalledWith(
        'test-group',
        'default'
      );
      expect(result).toEqual({
        members: mockMembers,
      });
    });

    it('should handle errors when fetching members', async () => {
      const error = new Error('API Error');
      mockQuickSightService.listGroupMemberships.mockRejectedValue(error);

      const result = await processor['executeSpecialOperations']('test-group');

      expect(logger.logger.warn).toHaveBeenCalledWith(
        'Failed to get members for group test-group:',
        error
      );
      expect(result).toEqual({
        members: [],
      });
    });
  });

  describe('getAssetId', () => {
    it('should extract GroupName', () => {
      const summary = { groupName: 'test-group' };
      expect(processor['getAssetId'](summary)).toBe('test-group');
    });

    it('should return empty string if GroupName is missing', () => {
      const summary = {};
      expect(processor['getAssetId'](summary)).toBe('');
    });
  });

  describe('getAssetName', () => {
    it('should extract GroupName', () => {
      const summary = { groupName: 'test-group' };
      expect(processor['getAssetName'](summary)).toBe('test-group');
    });

    it('should return empty string if GroupName is missing', () => {
      const summary = {};
      expect(processor['getAssetName'](summary)).toBe('');
    });
  });

  describe('getServicePath', () => {
    it('should return groups', () => {
      expect(processor['getServicePath']()).toBe('groups');
    });
  });

  describe('inheritance from OrganizationalProcessor', () => {
    it('should have correct capabilities', () => {
      expect(processor.capabilities).toEqual({
        hasDefinition: false,
        hasPermissions: false,
        hasTags: false,
        hasSpecialOperations: true,
      });
    });

    it('should use collection storage', () => {
      expect(processor.storageType).toBe('collection');
    });
  });
});
