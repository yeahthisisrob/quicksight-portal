import { sanitizeS3Key, buildAssetCacheKey } from '../s3KeyUtils';

describe('s3KeyUtils', () => {
  describe('sanitizeS3Key', () => {
    it('should sanitize forward slashes', () => {
      const input = 'AWSReservedSSO_Admin/testuser';
      const result = sanitizeS3Key(input);
      expect(result).toBe('AWSReservedSSO_Admin_testuser');
    });

    it('should sanitize backslashes', () => {
      const input = 'path\\to\\file';
      const result = sanitizeS3Key(input);
      expect(result).toBe('path_to_file');
    });

    it('should sanitize colons', () => {
      const input = 'time:12:00';
      const result = sanitizeS3Key(input);
      expect(result).toBe('time_12_00');
    });

    it('should sanitize all problematic characters', () => {
      const input = 'test\\/:*?"<>|name';
      const result = sanitizeS3Key(input);
      expect(result).toBe('test_________name');
    });

    it('should handle regular names without changes', () => {
      const input = 'regular-name_123';
      const result = sanitizeS3Key(input);
      expect(result).toBe('regular-name_123');
    });

    it('should handle empty strings', () => {
      const input = '';
      const result = sanitizeS3Key(input);
      expect(result).toBe('');
    });
  });

  describe('buildAssetCacheKey', () => {
    it('should build individual asset cache key', () => {
      const result = buildAssetCacheKey('dashboards', 'dashboard-123', 'individual');
      expect(result).toBe('assets/dashboards/dashboard-123.json');
    });

    it('should build collection cache key', () => {
      const result = buildAssetCacheKey('users', 'user-123', 'collection');
      expect(result).toBe('assets/organization/users.json');
    });

    it('should default to individual when storageType not specified', () => {
      const result = buildAssetCacheKey('datasets', 'dataset-456');
      expect(result).toBe('assets/datasets/dataset-456.json');
    });

    it('should sanitize asset ID in individual keys', () => {
      const result = buildAssetCacheKey('users', 'AWS/Admin/user', 'individual');
      expect(result).toBe('assets/users/AWS_Admin_user.json');
    });

    it('should ignore asset ID for collection keys', () => {
      const result = buildAssetCacheKey('groups', 'Group/With/Slashes', 'collection');
      expect(result).toBe('assets/organization/groups.json');
    });
  });
});
