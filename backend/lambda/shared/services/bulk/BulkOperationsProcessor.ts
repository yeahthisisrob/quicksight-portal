/* global setTimeout */
/**
 * BulkOperationsProcessor
 * Processes bulk operations in the background worker
 * Handles batching, concurrency, and progress tracking
 */

import pLimit from 'p-limit';

// Import services that will handle individual operations
import { BulkDeleteService } from '../../../features/asset-management/services/BulkDeleteService';
import { FolderService } from '../../../features/organization/services/FolderService';
import { IdentityService } from '../../../features/organization/services/IdentityService';
import { TagService } from '../../../features/organization/services/TagService';
import { MATH_CONSTANTS, PAGINATION, TIME_UNITS } from '../../constants';
import { type AssetType } from '../../types/assetTypes';
import {
  type BulkOperationConfig,
  type BulkOperationResult,
  type BulkOperationItemResult,
  type BulkAssetReference,
} from '../../types/bulkOperationTypes';
import { logger } from '../../utils/logger';
import { ClientFactory } from '../aws/ClientFactory';
import { cacheService } from '../cache/CacheService';
import { type JobStateService } from '../jobs/JobStateService';

// Processing constants
const PROCESSING_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 10,
  DEFAULT_MAX_CONCURRENCY: 5,
  PROGRESS_UPDATE_INTERVAL: 1000, // Update progress every 1 second
  MAX_RETRIES: 2,
} as const;

export class BulkOperationsProcessor {
  // Services
  private readonly bulkDeleteService: BulkDeleteService;
  private readonly folderService: FolderService;
  private readonly identityService: IdentityService;

  private jobId: string = '';
  private jobStateService: JobStateService | null = null;
  private lastProgressUpdate: number = 0;
  private readonly tagService: TagService;

  constructor(accountId: string) {
    const quickSightService = ClientFactory.getQuickSightService(accountId);

    this.bulkDeleteService = new BulkDeleteService(quickSightService);
    this.folderService = new FolderService(accountId);
    this.identityService = new IdentityService(accountId);
    this.tagService = new TagService(accountId);
  }

  /**
   * Process a bulk operation job
   */
  public async processBulkOperation(
    config: BulkOperationConfig,
    batchSize: number = PROCESSING_CONSTANTS.DEFAULT_BATCH_SIZE,
    maxConcurrency: number = PROCESSING_CONSTANTS.DEFAULT_MAX_CONCURRENCY
  ): Promise<BulkOperationResult> {
    const startTime = new Date().toISOString();
    const startMs = Date.now();

    logger.info('Starting bulk operation processing', {
      jobId: this.jobId,
      operationType: config.operationType,
      batchSize,
      maxConcurrency,
    });

    try {
      await this.updateProgress('Initializing bulk operation', 0);

      let result: BulkOperationResult;

      // Route to appropriate processor based on operation type
      switch (config.operationType) {
        case 'delete':
          result = await this.processBulkDelete(config, batchSize, maxConcurrency);
          break;
        case 'folder-add':
          result = await this.processBulkFolderAdd(config, batchSize, maxConcurrency);
          break;
        case 'folder-remove':
          result = await this.processBulkFolderRemove(config, batchSize, maxConcurrency);
          break;
        case 'group-add':
          result = await this.processBulkGroupAdd(config, batchSize, maxConcurrency);
          break;
        case 'group-remove':
          result = await this.processBulkGroupRemove(config, batchSize, maxConcurrency);
          break;
        case 'tag-update':
          result = await this.processBulkTagUpdate(config, batchSize, maxConcurrency);
          break;
        default:
          throw new Error(`Unsupported operation type: ${(config as any).operationType}`);
      }

      const endTime = new Date().toISOString();
      const duration = Date.now() - startMs;

      result.startTime = startTime;
      result.endTime = endTime;
      result.duration = duration;

      await this.updateProgress(
        `Bulk ${config.operationType} completed: ${result.successCount}/${result.totalItems} successful`,
        PAGINATION.MAX_PAGE_SIZE
      );

      return result;
    } catch (error) {
      logger.error('Bulk operation failed', {
        jobId: this.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.updateProgress(
        `Bulk operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        -1
      );

      throw error;
    }
  }

  /**
   * Set the job state service for progress tracking
   */
  public setJobStateService(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
  }

  /**
   * Create folder operations from assets and folders
   */
  private createFolderOperations(
    assets: BulkAssetReference[],
    folderIds: string[]
  ): Array<{ assetType: AssetType; assetId: string; folderId: string }> {
    const operations = [];
    for (const asset of assets) {
      for (const folderId of folderIds) {
        operations.push({
          assetType: asset.type,
          assetId: asset.id,
          folderId,
        });
      }
    }
    return operations;
  }

  /**
   * Create group operations from users and groups
   */
  private createGroupOperations(
    userNames: string[],
    groupNames: string[]
  ): Array<{ userName: string; groupName: string }> {
    const operations = [];
    for (const userName of userNames) {
      for (const groupName of groupNames) {
        operations.push({ userName, groupName });
      }
    }
    return operations;
  }

  /**
   * Generic batched operation processor
   */
  private async processBatchedOperations<T>(
    operationType: string,
    operations: T[],
    processor: (op: T) => Promise<string>,
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const results: BulkOperationItemResult[] = [];
    const limit = pLimit(maxConcurrency);
    const totalOperations = operations.length;
    let completedOperations = 0;

    // Process in batches
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(operations.length / batchSize);

      await this.updateProgress(
        `Processing batch ${batchNumber}/${totalBatches}`,
        Math.round((completedOperations / totalOperations) * MATH_CONSTANTS.PERCENTAGE_MULTIPLIER)
      );

      // Process batch with concurrency control
      const batchResults = await Promise.allSettled(
        batch.map((op) => limit(() => this.processWithRetry(op, processor)))
      );

      // Collect results
      batchResults.forEach((result, index) => {
        const operation = batch[index];
        const itemId = JSON.stringify(operation);

        if (result.status === 'fulfilled') {
          results.push({
            success: true,
            item: itemId,
            message: result.value,
          });
        } else {
          results.push({
            success: false,
            item: itemId,
            error: result.reason?.message || 'Unknown error',
          });
        }
        completedOperations++;
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return {
      operationType: operationType as any,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0, // Will be set by caller
      totalItems: totalOperations,
      successCount,
      failureCount,
      results,
      summary: {},
    };
  }

  /**
   * Process bulk delete operations
   */
  private async processBulkDelete(
    config: BulkOperationConfig & { assets: BulkAssetReference[] },
    _batchSize: number,
    _maxConcurrency: number
  ): Promise<BulkOperationResult> {
    // Use existing BulkDeleteService which handles archiving
    const deleteResult = await this.bulkDeleteService.deleteAssets({
      assets: config.assets.map((a) => ({ type: a.type, id: a.id })),
      reason: config.reason,
      deletedBy: config.requestedBy,
    });

    // Convert to our result format
    const results: BulkOperationItemResult[] = [];

    // Add successful deletions
    Object.entries(deleteResult.deleted.byType).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        results.push({
          success: true,
          item: `${type}-item-${i}`,
          message: 'Deleted and archived',
        });
      }
    });

    // Add errors
    deleteResult.errors.forEach((error) => {
      results.push({
        success: false,
        item: `${error.assetType}:${error.assetId}`,
        error: error.error,
      });
    });

    return {
      operationType: 'delete',
      startTime: new Date(deleteResult.startTime).toISOString(),
      endTime: new Date(deleteResult.endTime).toISOString(),
      duration: deleteResult.duration,
      totalItems: config.assets.length,
      successCount: deleteResult.deleted.total,
      failureCount: deleteResult.errors.length,
      results,
      summary: {
        byType: deleteResult.deleted.byType,
      },
    };
  }

  /**
   * Process bulk folder add operations
   */
  private async processBulkFolderAdd(
    config: BulkOperationConfig & { assets: BulkAssetReference[]; folderIds: string[] },
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const operations = this.createFolderOperations(config.assets, config.folderIds);
    return await this.processBatchedOperations(
      'folder-add',
      operations,
      async (op) => {
        await this.folderService.addAssetToFolder(
          op.folderId,
          op.assetId,
          op.assetType.toUpperCase() as any
        );
        return `Added ${op.assetType}:${op.assetId} to folder ${op.folderId}`;
      },
      batchSize,
      maxConcurrency
    );
  }

  /**
   * Process bulk folder remove operations
   */
  private async processBulkFolderRemove(
    config: BulkOperationConfig & { assets: BulkAssetReference[]; folderIds: string[] },
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const operations = this.createFolderOperations(config.assets, config.folderIds);
    return await this.processBatchedOperations(
      'folder-remove',
      operations,
      async (op) => {
        await this.folderService.removeMember(
          op.folderId,
          op.assetId,
          op.assetType.toUpperCase() as any
        );
        return `Removed ${op.assetType}:${op.assetId} from folder ${op.folderId}`;
      },
      batchSize,
      maxConcurrency
    );
  }

  /**
   * Process bulk group add operations
   */
  private async processBulkGroupAdd(
    config: BulkOperationConfig & { userNames: string[]; groupNames: string[] },
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const operations = this.createGroupOperations(config.userNames, config.groupNames);
    return await this.processBatchedOperations(
      'group-add',
      operations,
      async (op) => {
        await this.identityService.addUserToGroup(op.userName, op.groupName);

        // Update cache for group
        try {
          // Update group's member list
          await cacheService.updateGroupMembership(op.groupName, 'add', op.userName);
        } catch (cacheError) {
          // Log but don't fail the operation if cache update fails
          logger.warn(`Failed to update cache after adding ${op.userName} to ${op.groupName}`, {
            cacheError,
          });
        }

        return `Added ${op.userName} to group ${op.groupName}`;
      },
      batchSize,
      maxConcurrency
    );
  }

  /**
   * Process bulk group remove operations
   */
  private async processBulkGroupRemove(
    config: BulkOperationConfig & { userNames: string[]; groupNames: string[] },
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const operations = this.createGroupOperations(config.userNames, config.groupNames);
    return await this.processBatchedOperations(
      'group-remove',
      operations,
      async (op) => {
        await this.identityService.removeUserFromGroup(op.userName, op.groupName);

        // Update cache for group
        try {
          // Update group's member list
          await cacheService.updateGroupMembership(op.groupName, 'remove', op.userName);
        } catch (cacheError) {
          // Log but don't fail the operation if cache update fails
          logger.warn(`Failed to update cache after removing ${op.userName} from ${op.groupName}`, {
            cacheError,
          });
        }

        return `Removed ${op.userName} from group ${op.groupName}`;
      },
      batchSize,
      maxConcurrency
    );
  }

  /**
   * Process bulk tag update operations
   */
  private async processBulkTagUpdate(
    config: BulkOperationConfig & {
      assets: BulkAssetReference[];
      tags: Array<{ Key: string; Value: string }>;
      action: 'add' | 'replace' | 'remove';
    },
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const operations = config.assets.map((asset) => ({
      assetType: asset.type,
      assetId: asset.id,
      tags: config.tags,
      action: config.action,
    }));

    return await this.processBatchedOperations(
      'tag-update',
      operations,
      async (op) => {
        if (op.action === 'remove') {
          await this.tagService.removeResourceTags(
            op.assetType,
            op.assetId,
            op.tags.map((t: any) => t.Key || t.key)
          );
        } else {
          // Convert tags format if needed
          const formattedTags = op.tags.map((t: any) => ({
            key: t.Key || t.key,
            value: t.Value || t.value,
          }));
          await this.tagService.updateResourceTags(op.assetType, op.assetId, formattedTags);
        }
        return `Updated tags for ${op.assetType}:${op.assetId}`;
      },
      batchSize,
      maxConcurrency
    );
  }

  /**
   * Process operation with retry logic
   */
  private async processWithRetry<T>(
    operation: T,
    processor: (op: T) => Promise<string>
  ): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= PROCESSING_CONSTANTS.MAX_RETRIES; attempt++) {
      try {
        return await processor(operation);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        if (attempt < PROCESSING_CONSTANTS.MAX_RETRIES) {
          logger.warn('Operation failed, retrying', {
            attempt,
            error: lastError.message,
          });
          // Exponential backoff
          await new Promise<void>((resolve) => {
            const timeout = Math.pow(2, attempt) * TIME_UNITS.SECOND;
            setTimeout(resolve, timeout);
          });
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Update job progress
   */
  private async updateProgress(message: string, percentComplete: number): Promise<void> {
    const now = Date.now();

    // Throttle progress updates
    if (now - this.lastProgressUpdate < PROCESSING_CONSTANTS.PROGRESS_UPDATE_INTERVAL) {
      return;
    }

    this.lastProgressUpdate = now;

    if (!this.jobStateService) {
      return;
    }

    try {
      if (percentComplete === -1) {
        await this.jobStateService.updateJobStatus(this.jobId, {
          status: 'failed',
          message,
          endTime: new Date().toISOString(),
        });
      } else if (percentComplete === PAGINATION.MAX_PAGE_SIZE) {
        await this.jobStateService.updateJobStatus(this.jobId, {
          status: 'completed',
          progress: percentComplete,
          message,
          endTime: new Date().toISOString(),
        });
      } else {
        await this.jobStateService.updateJobStatus(this.jobId, {
          progress: percentComplete,
          message,
        });
      }

      await this.jobStateService.logInfo(this.jobId, message, { progress: percentComplete });
    } catch (error) {
      logger.warn('Failed to update job progress', {
        jobId: this.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
