/**
 * BulkOperationsService
 * Centralized service for orchestrating all bulk operations
 * Routes operations to job queue for async processing
 */

import { ASSET_TYPES } from '../../types/assetTypes';
import {
  type BulkOperationConfig,
  type BulkDeleteConfig,
  type BulkFolderAddConfig,
  type BulkFolderRemoveConfig,
  type BulkGroupAddConfig,
  type BulkGroupRemoveConfig,
  type BulkTagUpdateConfig,
  type BulkAssetReference,
} from '../../types/bulkOperationTypes';
import { logger } from '../../utils/logger';
import { CacheService } from '../cache/CacheService';
import { jobFactory } from '../jobs/JobFactory';

// Constants for bulk operations
const BULK_OPERATION_LIMITS = {
  MAX_ITEMS_PER_REQUEST: 1000,
  DEFAULT_BATCH_SIZE: 10,
  DEFAULT_MAX_CONCURRENCY: 5,
} as const;

export interface BulkOperationJobResponse {
  jobId: string;
  status: string;
  message: string;
  estimatedOperations: number;
}

export class BulkOperationsService {
  private readonly accountId: string;
  private readonly bucketName: string;
  private readonly cacheService: CacheService;

  constructor(accountId?: string) {
    this.accountId = accountId || process.env.AWS_ACCOUNT_ID || '';
    this.bucketName = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${this.accountId}`;
    this.cacheService = CacheService.getInstance();
  }

  /**
   * Add multiple assets to multiple folders
   */
  public async bulkAddToFolders(
    assets: BulkAssetReference[],
    folderIds: string[],
    requestedBy: string
  ): Promise<BulkOperationJobResponse> {
    this.validateAssets(assets);
    this.validateFolderIds(folderIds);

    const config: BulkFolderAddConfig = {
      operationType: 'folder-add',
      assets,
      folderIds,
      requestedBy,
    };

    // Total operations = assets × folders
    const totalOperations = assets.length * folderIds.length;
    return await this.createBulkOperationJob(config, totalOperations);
  }

  /**
   * Add multiple users to multiple groups
   */
  public async bulkAddUsersToGroups(
    userNames: string[],
    groupNames: string[],
    requestedBy: string
  ): Promise<BulkOperationJobResponse> {
    this.validateUserNames(userNames);
    this.validateGroupNames(groupNames);

    const config: BulkGroupAddConfig = {
      operationType: 'group-add',
      userNames,
      groupNames,
      requestedBy,
    };

    // Total operations = users × groups
    const totalOperations = userNames.length * groupNames.length;
    return await this.createBulkOperationJob(config, totalOperations);
  }

  /**
   * Execute a bulk delete operation
   */
  public async bulkDelete(
    assets: BulkAssetReference[],
    requestedBy: string,
    reason?: string
  ): Promise<BulkOperationJobResponse> {
    this.validateAssets(assets);

    const config: BulkDeleteConfig = {
      operationType: 'delete',
      assets,
      requestedBy,
      reason,
    };

    return await this.createBulkOperationJob(config, assets.length);
  }

  /**
   * Remove multiple assets from multiple folders
   */
  public async bulkRemoveFromFolders(
    assets: BulkAssetReference[],
    folderIds: string[],
    requestedBy: string
  ): Promise<BulkOperationJobResponse> {
    this.validateAssets(assets);
    this.validateFolderIds(folderIds);

    const config: BulkFolderRemoveConfig = {
      operationType: 'folder-remove',
      assets,
      folderIds,
      requestedBy,
    };

    const totalOperations = assets.length * folderIds.length;
    return await this.createBulkOperationJob(config, totalOperations);
  }

  /**
   * Remove multiple users from multiple groups
   */
  public async bulkRemoveUsersFromGroups(
    userNames: string[],
    groupNames: string[],
    requestedBy: string
  ): Promise<BulkOperationJobResponse> {
    this.validateUserNames(userNames);
    this.validateGroupNames(groupNames);

    const config: BulkGroupRemoveConfig = {
      operationType: 'group-remove',
      userNames,
      groupNames,
      requestedBy,
    };

    const totalOperations = userNames.length * groupNames.length;
    return await this.createBulkOperationJob(config, totalOperations);
  }

  public async bulkUpdateTags(
    assets: BulkAssetReference[],
    tags: Array<{ Key: string; Value: string }>,
    action: 'add' | 'replace' | 'remove',
    requestedBy: string
  ): Promise<BulkOperationJobResponse> {
    this.validateAssets(assets);
    this.validateTags(tags);

    const config: BulkTagUpdateConfig = {
      operationType: 'tag-update',
      assets,
      tags,
      action,
      requestedBy,
    };

    return await this.createBulkOperationJob(config, assets.length);
  }

  /**
   * Update tags for multiple assets
   */
  /**
   * Validate if assets can be deleted
   * Check for dependencies, permissions, etc.
   */
  public async validateBulkDelete(assets: BulkAssetReference[]): Promise<{
    canDelete: boolean;
    warnings: string[];
    errors: string[];
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Extract IDs for different asset types
      const datasetIds = assets.filter((a) => a.type === ASSET_TYPES.dataset).map((a) => a.id);
      const datasourceIds = assets
        .filter((a) => a.type === ASSET_TYPES.datasource)
        .map((a) => a.id);

      // Check dependencies by looking at cached metadata
      const cachedAssets = await this.cacheService.getCacheEntries();

      // Check which dashboards/analyses depend on datasets being deleted
      if (datasetIds.length > 0 && cachedAssets) {
        const dependentAssets = cachedAssets.filter((asset: any) => {
          const assetDatasetIds = asset.metadata?.lineageData?.datasetIds || [];
          return datasetIds.some((id) => assetDatasetIds.includes(id));
        });

        dependentAssets.forEach((asset: any) => {
          warnings.push(
            `${asset.assetType} "${asset.assetName}" depends on dataset(s) being deleted`
          );
        });
      }

      // Check which datasets depend on datasources being deleted
      if (datasourceIds.length > 0 && cachedAssets) {
        const dependentDatasets = cachedAssets.filter((asset: any) => {
          if (asset.assetType !== ASSET_TYPES.dataset) {
            return false;
          }
          const assetDatasourceIds = asset.metadata?.lineageData?.datasourceIds || [];
          return datasourceIds.some((id) => assetDatasourceIds.includes(id));
        });

        dependentDatasets.forEach((dataset: any) => {
          warnings.push(`Dataset "${dataset.assetName}" depends on datasource(s) being deleted`);
        });
      }
    } catch (error) {
      logger.warn('Could not check dependencies for deletion validation', { error });
    }

    // Validate collection assets - prevent deletion of certain critical assets
    const collectionAssets = [
      'collection_dashboards',
      'collection_analyses',
      'collection_datasets',
    ];
    assets.forEach((asset) => {
      if (collectionAssets.includes(asset.id)) {
        errors.push(`Cannot delete collection asset: ${asset.id}`);
      }
    });

    return {
      canDelete: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Create a job for the bulk operation
   */
  private async createBulkOperationJob(
    config: BulkOperationConfig,
    estimatedOperations: number
  ): Promise<BulkOperationJobResponse> {
    logger.info('Creating bulk operation job', {
      operationType: config.operationType,
      estimatedOperations,
      requestedBy: config.requestedBy,
    });

    // Create job configuration
    const jobConfig = {
      jobType: 'bulk-operation' as const,
      accountId: this.accountId,
      bucketName: this.bucketName,
      userId: config.requestedBy,
      operationConfig: config,
      estimatedOperations,
      batchSize: BULK_OPERATION_LIMITS.DEFAULT_BATCH_SIZE,
      maxConcurrency: BULK_OPERATION_LIMITS.DEFAULT_MAX_CONCURRENCY,
    };

    // Send to job queue
    const result = await jobFactory.createJob(jobConfig as any);

    logger.info('Bulk operation job created', {
      jobId: result.jobId,
      operationType: config.operationType,
    });

    return {
      jobId: result.jobId,
      status: result.status,
      message: `Bulk ${config.operationType} operation queued`,
      estimatedOperations,
    };
  }

  /**
   * Validate assets array
   */
  private validateAssets(assets: BulkAssetReference[]): void {
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      throw new Error('Assets array is required and must not be empty');
    }

    if (assets.length > BULK_OPERATION_LIMITS.MAX_ITEMS_PER_REQUEST) {
      throw new Error(
        `Maximum ${BULK_OPERATION_LIMITS.MAX_ITEMS_PER_REQUEST} assets allowed per request`
      );
    }

    for (const asset of assets) {
      if (!asset.type || !asset.id) {
        throw new Error('Each asset must have type and id');
      }
    }
  }

  /**
   * Validate folder IDs
   */
  private validateFolderIds(folderIds: string[]): void {
    if (!folderIds || !Array.isArray(folderIds) || folderIds.length === 0) {
      throw new Error('Folder IDs array is required and must not be empty');
    }

    for (const folderId of folderIds) {
      if (!folderId || typeof folderId !== 'string') {
        throw new Error('Each folder ID must be a non-empty string');
      }
    }
  }

  /**
   * Validate group names
   */
  private validateGroupNames(groupNames: string[]): void {
    if (!groupNames || !Array.isArray(groupNames) || groupNames.length === 0) {
      throw new Error('Group names array is required and must not be empty');
    }
  }

  /**
   * Validate tags
   */
  private validateTags(tags: Array<{ Key: string; Value: string }>): void {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new Error('Tags array is required and must not be empty');
    }

    for (const tag of tags) {
      if (!tag.Key || typeof tag.Key !== 'string') {
        throw new Error('Each tag must have a Key');
      }
    }
  }

  /**
   * Validate user names
   */
  private validateUserNames(userNames: string[]): void {
    if (!userNames || !Array.isArray(userNames) || userNames.length === 0) {
      throw new Error('User names array is required and must not be empty');
    }

    if (userNames.length > BULK_OPERATION_LIMITS.MAX_ITEMS_PER_REQUEST) {
      throw new Error(
        `Maximum ${BULK_OPERATION_LIMITS.MAX_ITEMS_PER_REQUEST} users allowed per request`
      );
    }
  }
}
