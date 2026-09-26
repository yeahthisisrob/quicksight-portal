/**
 * Bulk Operation Types
 * Shared types for all bulk operations across the application
 */

import type { AssetType } from './assetTypes';

// Bulk operation types that can be processed
type BulkOperationType =
  | 'delete'
  | 'folder-add'
  | 'folder-remove'
  | 'group-add'
  | 'group-remove'
  | 'tag-update'
  | 'permission-revoke'
  | 'permission-grant';

// Asset reference for bulk operations
export interface BulkAssetReference {
  type: AssetType;
  id: string;
  name?: string; // Optional for better logging
}

// Base configuration for all bulk operations
interface BaseBulkOperationConfig {
  operationType: BulkOperationType;
  requestedBy: string;
  reason?: string;
}

// Specific configurations for each operation type
export interface BulkDeleteConfig extends BaseBulkOperationConfig {
  operationType: 'delete';
  assets: BulkAssetReference[];
}

export interface BulkFolderAddConfig extends BaseBulkOperationConfig {
  operationType: 'folder-add';
  assets: BulkAssetReference[];
  folderIds: string[];
}

export interface BulkFolderRemoveConfig extends BaseBulkOperationConfig {
  operationType: 'folder-remove';
  assets: BulkAssetReference[];
  folderIds: string[];
}

export interface BulkGroupAddConfig extends BaseBulkOperationConfig {
  operationType: 'group-add';
  userNames: string[];
  groupNames: string[];
}

export interface BulkGroupRemoveConfig extends BaseBulkOperationConfig {
  operationType: 'group-remove';
  userNames: string[];
  groupNames: string[];
}

export interface BulkTagUpdateConfig extends BaseBulkOperationConfig {
  operationType: 'tag-update';
  assets: BulkAssetReference[];
  tags: Array<{ Key: string; Value: string }>;
  action: 'add' | 'replace' | 'remove';
}

export interface BulkPermissionRevokeConfig extends BaseBulkOperationConfig {
  operationType: 'permission-revoke';
  assetType: AssetType;
  assetId: string;
  revocations: Array<{ principal: string; actions: string[] }>;
}

export interface BulkPermissionGrantConfig extends BaseBulkOperationConfig {
  operationType: 'permission-grant';
  assetType: AssetType;
  assetId: string;
  grants: Array<{ principal: string; actions: string[] }>;
}

// Union type for all bulk operation configurations
export type BulkOperationConfig =
  | BulkDeleteConfig
  | BulkFolderAddConfig
  | BulkFolderRemoveConfig
  | BulkGroupAddConfig
  | BulkGroupRemoveConfig
  | BulkTagUpdateConfig
  | BulkPermissionRevokeConfig
  | BulkPermissionGrantConfig;

// Result types for bulk operations
export interface BulkOperationItemResult {
  success: boolean;
  item: string; // human-readable label, e.g. "alice → analysts"
  message?: string;
  error?: string;
}

/** One failed item, as recorded on the job record (see bulkResultSummary) */
export interface BulkItemFailure {
  item: string;
  error: string;
}

export interface BulkOperationResult {
  operationType: BulkOperationType;
  startTime: string;
  endTime: string;
  duration: number;
  totalItems: number;
  successCount: number;
  failureCount: number;
  results: BulkOperationItemResult[];
  summary: {
    byType?: Record<AssetType, number>; // For asset operations
    byFolder?: Record<string, number>; // For folder operations
    byGroup?: Record<string, number>; // For group operations
  };
}
