/**
 * Shared archive types for consistent archive handling across services
 */
import { type AssetType } from '../models/asset.model';

/**
 * Archive metadata that gets added to archived assets
 */
export interface ArchiveMetadata {
  archivedAt: string;
  archivedBy: string;
  archiveReason: string;
  originalPath: string;
}

/**
 * Result of an archive operation
 */
export interface ArchiveResult {
  success: boolean;
  assetId: string;
  assetType: AssetType;
  originalPath: string;
  archivePath: string;
  archivedAt: string;
  error?: string;
}

/**
 * Archive statistics
 */
export interface ArchiveStats {
  totalArchived: number;
  totalSizeGB: number;
  byType: Record<AssetType, number>;
  oldestArchive: string;
  growthRateGB: number;
}

/**
 * Archived asset item for API responses
 */
export interface ArchivedAssetResponse {
  id: string;
  name: string;
  type: AssetType;
  status: 'archived';
  createdTime: string;
  lastUpdatedTime: string;
  lastExportTime: string;
  enrichmentStatus: string;
  enrichmentTimestamps: Record<string, any>;
  tags: Array<{ key: string; value: string }>;
  permissions: Array<{
    principal: string;
    principalType: 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC';
    actions: string[];
  }>;
  archiveMetadata: ArchiveMetadata;
  lastActivity?: string | null;
  canRestore: boolean;
}

/**
 * Paginated archived assets response
 */
export interface ArchivedAssetsResponse {
  items: ArchivedAssetResponse[];
  nextToken?: string;
  totalCount?: number;
}

/**
 * Options for retrieving archived assets
 */
export interface GetArchivedAssetsOptions {
  assetType?: AssetType;
  dateRange?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
