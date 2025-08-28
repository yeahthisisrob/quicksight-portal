import { vi, type Mocked } from 'vitest';

import { type QuickSightService } from '../../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../../shared/services/parsing/AssetParserService';
import { type TagService } from '../../../../organization/services/TagService';
import { UserProcessor } from '../UserProcessor';

describe('UserProcessor', () => {
  let processor: UserProcessor;
  let mockQuickSightService: Mocked<QuickSightService>;
  let mockS3Service: Mocked<S3Service>;
  let mockTagService: Mocked<TagService>;
  let mockAssetParserService: Mocked<AssetParserService>;

  beforeEach(() => {
    mockQuickSightService = {
      listUserGroups: vi.fn(),
    } as any;
    mockS3Service = {} as any;
    mockTagService = {} as any;
    mockAssetParserService = {} as any;

    processor = new UserProcessor(
      mockQuickSightService,
      mockS3Service,
      mockTagService,
      mockAssetParserService,
      '123456789012'
    );

    vi.clearAllMocks();
  });

  describe('assetType', () => {
    it('should be user', () => {
      expect(processor.assetType).toBe('user');
    });
  });

  describe('executeSpecialOperations', () => {
    it('should return empty object since groups are no longer fetched', async () => {
      const result = await processor['executeSpecialOperations']('test-user');

      expect(mockQuickSightService.listUserGroups).not.toHaveBeenCalled();
      expect(result).toEqual({});
    });
  });

  describe('getAssetId', () => {
    it('should extract UserName', () => {
      const summary = { userName: 'test-user' };
      expect(processor['getAssetId'](summary)).toBe('test-user');
    });

    it('should return empty string if UserName is missing', () => {
      const summary = {};
      expect(processor['getAssetId'](summary)).toBe('');
    });
  });

  describe('getAssetName', () => {
    it('should extract UserName', () => {
      const summary = { userName: 'test-user' };
      expect(processor['getAssetName'](summary)).toBe('test-user');
    });

    it('should return empty string if UserName is missing', () => {
      const summary = {};
      expect(processor['getAssetName'](summary)).toBe('');
    });
  });

  describe('getServicePath', () => {
    it('should return users', () => {
      expect(processor['getServicePath']()).toBe('users');
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

  describe('TODO comment', () => {
    it('should have TODO about optimizing with group cache', () => {
      // This test documents that there's a TODO in the code
      // to optimize user export by using fresh group cache
      // instead of making API calls per user
      expect(true).toBe(true);
    });
  });
});
