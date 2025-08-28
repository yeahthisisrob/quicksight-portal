/**
 * Bulk Operation Types
 * Shared types for all bulk operations across the application
 */

import { type AssetType } from './assetTypes';

// Bulk operation types that can be processed
export type BulkOperationType =
  | 'delete'
  | 'folder-add'
  | 'folder-remove'
  | 'group-add'
  | 'group-remove'
  | 'tag-update';

// Asset reference for bulk operations
export interface BulkAssetReference {
  type: AssetType;
  id: string;
  name?: string; // Optional for better logging
}

// Base configuration for all bulk operations
export interface BaseBulkOperationConfig {
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

// Union type for all bulk operation configurations
export type BulkOperationConfig =
  | BulkDeleteConfig
  | BulkFolderAddConfig
  | BulkFolderRemoveConfig
  | BulkGroupAddConfig
  | BulkGroupRemoveConfig
  | BulkTagUpdateConfig;

// Result types for bulk operations
export interface BulkOperationItemResult {
  success: boolean;
  item: string; // asset ID, user name, etc.
  message?: string;
  error?: string;
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

// Job configuration for bulk operations
export interface BulkOperationJobConfig {
  jobType: 'bulk-operation';
  operationConfig: BulkOperationConfig;
  estimatedOperations: number;
  batchSize?: number; // Allow override of default batch size
  maxConcurrency?: number; // Allow override of default concurrency
}

// Progress tracking
export interface BulkOperationProgress {
  totalOperations: number;
  completedOperations: number;
  successfulOperations: number;
  failedOperations: number;
  currentBatch: number;
  totalBatches: number;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}
