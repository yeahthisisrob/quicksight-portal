import type { Mocked } from 'vitest';

import { type QuickSightService } from '../../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../../shared/services/aws/S3Service';
import { type AssetParserService } from '../../../../../shared/services/parsing/AssetParserService';
import { type TagService } from '../../../../organization/services/TagService';
import { type AssetType } from '../../../types';
import { OrganizationalProcessor } from '../OrganizationalProcessor';

// Create a concrete implementation for testing
class TestOrganizationalProcessor extends OrganizationalProcessor {
  public readonly assetType: AssetType = 'user';

  protected getAssetId(summary: any): string {
    return summary.UserName || '';
  }

  protected getAssetName(summary: any): string {
    return summary.UserName || '';
  }

  protected getServicePath(): string {
    return 'users';
  }

  public testGetAssetTypeCapitalized(): string {
    return this.getAssetTypeCapitalized();
  }

  // Expose protected methods for testing
  public testShouldUpdate(cachedEntry: any, newEntry: any): boolean {
    return this.shouldUpdate(cachedEntry, newEntry);
  }
}

describe('OrganizationalProcessor', () => {
  let processor: TestOrganizationalProcessor;
  let mockQuickSightService: Mocked<QuickSightService>;
  let mockS3Service: Mocked<S3Service>;
  let mockTagService: Mocked<TagService>;
  let mockAssetParserService: Mocked<AssetParserService>;

  beforeEach(() => {
    mockQuickSightService = {} as any;
    mockS3Service = {} as any;
    mockTagService = {} as any;
    mockAssetParserService = {} as any;

    processor = new TestOrganizationalProcessor(
      mockQuickSightService,
      mockS3Service,
      mockTagService,
      mockAssetParserService,
      '123456789012'
    );
  });

  describe('capabilities', () => {
    it('should have correct capabilities for organizational assets', () => {
      expect(processor.capabilities).toEqual({
        hasDefinition: false,
        hasPermissions: false,
        hasTags: false,
        hasSpecialOperations: true,
      });
    });
  });

  describe('storageType', () => {
    it('should use collection storage', () => {
      expect(processor.storageType).toBe('collection');
    });
  });

  describe('shouldUpdate', () => {
    it('should always return true for organizational assets', () => {
      const cachedEntry = { id: 'test', lastModified: '2024-01-01' };
      const newEntry = { id: 'test', lastModified: '2024-01-02' };

      expect(processor.testShouldUpdate(cachedEntry, newEntry)).toBe(true);
    });

    it('should return true even when entries are identical', () => {
      const entry = { id: 'test', data: 'same' };

      expect(processor.testShouldUpdate(entry, entry)).toBe(true);
    });
  });

  describe('executeDescribe', () => {
    it('should return minimal describe data', async () => {
      const result = await processor['executeDescribe']('test-id');

      expect(result).toEqual({
        UserName: 'test-id',
      });
    });
  });

  describe('executeGetPermissions', () => {
    it('should return empty array', async () => {
      const result = await processor['executeGetPermissions']('test-asset-id');

      expect(result).toEqual([]);
    });
  });

  describe('executeGetTags', () => {
    it('should return empty array', async () => {
      const result = await processor['executeGetTags']();

      expect(result).toEqual([]);
    });
  });

  describe('getAssetTypeCapitalized', () => {
    it('should capitalize asset type correctly', () => {
      expect(processor.testGetAssetTypeCapitalized()).toBe('User');
    });
  });
});
