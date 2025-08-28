/**
 * Utility functions for S3 key sanitization and manipulation
 */

/**
 * Sanitize an ID for use in S3 keys by replacing problematic characters
 * @param id - The ID to sanitize
 * @returns Sanitized ID safe for S3 keys
 */
export function sanitizeS3Key(id: string): string {
  // Replace characters that are problematic in S3 keys or file systems
  // This includes: \ / : * ? " < > |
  return id.replace(/[\\/:*?"<>|]/g, '_');
}

/**
 * Build a cache key for an asset
 * @param servicePath - The service path (e.g., 'users', 'groups', 'dashboards')
 * @param assetId - The asset ID
 * @param storageType - Whether this is stored individually or as a collection
 * @returns The S3 cache key
 */
export function buildAssetCacheKey(
  servicePath: string,
  assetId: string,
  storageType: 'individual' | 'collection' = 'individual'
): string {
  if (storageType === 'collection') {
    return `assets/organization/${servicePath}.json`;
  }
  const sanitizedId = sanitizeS3Key(assetId);
  return `assets/${servicePath}/${sanitizedId}.json`;
}
