/* global setTimeout, setInterval, clearInterval */
/**
 * BulkOperationsProcessor
 * Processes bulk operations in the background worker
 * Handles batching, concurrency, and progress tracking
 */

import pLimit from 'p-limit';

// Import services that will handle individual operations
import {
  BulkDeleteService,
  type RefreshAssets,
} from '../../../features/asset-management/services/BulkDeleteService';
import { FolderService } from '../../../features/organization/services/FolderService';
import { IdentityService } from '../../../features/organization/services/IdentityService';
import { TagService } from '../../../features/organization/services/TagService';
import { MATH_CONSTANTS, PAGINATION, TIME_UNITS } from '../../constants';
import type { AssetType } from '../../types/assetTypes';
import type {
  BulkAssetReference,
  BulkOperationConfig,
  BulkOperationItemResult,
  BulkOperationResult,
} from '../../types/bulkOperationTypes';
import { logger } from '../../utils/logger';
import { ClientFactory } from '../aws/ClientFactory';
import { QuickSightService } from '../aws/QuickSightService';
import { keepCacheFresh } from '../cache/assetFreshness';
import { cacheService } from '../cache/CacheService';
import type { JobStateService } from '../jobs/JobStateService';
import { summarizeBulkResult } from './bulkResultSummary';

// Processing constants
const PROCESSING_CONSTANTS = {
  DEFAULT_BATCH_SIZE: 10,
  DEFAULT_MAX_CONCURRENCY: 5,
  PROGRESS_UPDATE_INTERVAL: 1000, // Update progress every 1 second
  MAX_RETRIES: 2,
} as const;

// Keep-alive heartbeat while a long single-phase operation (bulk delete) runs
// with no per-item progress writes - must be well under the stuck-job
// threshold (30 min) so live jobs are never auto-failed
const HEARTBEAT_INTERVAL_MS = 60_000;
const HEARTBEAT_PROGRESS_PERCENT = 50;

const describeGroupOperation = (op: { userName: string; groupName: string }): string =>
  `${op.userName} → ${op.groupName}`;

export class BulkOperationsProcessor {
  // Services
  private readonly bulkDeleteService: BulkDeleteService;
  private readonly folderService: FolderService;
  private readonly identityService: IdentityService;

  private jobId: string = '';
  private jobStateService: JobStateService | null = null;
  private lastProgressUpdate: number = 0;
  private readonly tagService: TagService;

  /**
   * `refreshAssets` re-exports assets from QuickSight; the worker passes the
   * export's, so a delete archives what QuickSight has now.
   */
  private readonly refreshAssets?: RefreshAssets;

  public constructor(accountId: string, deps: { refreshAssets?: RefreshAssets } = {}) {
    const quickSightService = ClientFactory.getQuickSightService(accountId);
    this.refreshAssets = deps.refreshAssets;

    this.bulkDeleteService = new BulkDeleteService(quickSightService, deps.refreshAssets);
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
        case 'permission-revoke':
          result = await this.processBulkPermissionRevoke(config, batchSize, maxConcurrency);
          break;
        case 'permission-grant':
          result = await this.processBulkPermissionGrant(config, batchSize, maxConcurrency);
          break;
        default:
          throw new Error(`Unsupported operation type: ${(config as any).operationType}`);
      }

      const endTime = new Date().toISOString();
      const duration = Date.now() - startMs;

      result.startTime = startTime;
      result.endTime = endTime;
      result.duration = duration;

      await this.updateProgress(summarizeBulkResult(result).message, PAGINATION.MAX_PAGE_SIZE);

      // One cache path for every bulk op: re-export what it touched from
      // QuickSight before the job reports done, so a view that refreshes on
      // completion shows the result (no per-operation cache patching).
      await this.refreshAffected(config);

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

  /** What a bulk operation changed, as the assets whose records must be re-read. */
  private affectedAssets(
    config: BulkOperationConfig
  ): Array<{ assetType: AssetType; assetId: string }> {
    const c = config as any;
    const assets = (list: BulkAssetReference[] = []) =>
      list.map((a) => ({ assetType: a.type, assetId: a.id }));
    switch (config.operationType) {
      case 'folder-add':
      case 'folder-remove':
        // The folders' members changed, and so did each asset's folder list.
        return [
          ...(c.folderIds as string[]).map((assetId) => ({
            assetType: 'folder' as AssetType,
            assetId,
          })),
          ...assets(c.assets),
        ];
      case 'group-add':
      case 'group-remove':
        return [
          ...(c.groupNames as string[]).map((assetId) => ({
            assetType: 'group' as AssetType,
            assetId,
          })),
          ...(c.userNames as string[]).map((assetId) => ({
            assetType: 'user' as AssetType,
            assetId,
          })),
        ];
      case 'permission-grant':
      case 'permission-revoke':
        return [{ assetType: c.assetType as AssetType, assetId: c.assetId as string }];
      case 'tag-update':
        return assets(c.assets);
      default:
        // Deletes archive their assets themselves.
        return [];
    }
  }

  private async refreshAffected(config: BulkOperationConfig): Promise<void> {
    const affected = this.affectedAssets(config);
    if (affected.length === 0) {
      return;
    }
    await this.updateProgress('Refreshing what changed', PAGINATION.MAX_PAGE_SIZE - 1);
    try {
      if (this.refreshAssets) {
        const refreshed = await this.refreshAssets(affected);
        if (refreshed.failed.length > 0) {
          logger.warn('Some changed assets could not be re-read after the bulk operation', {
            failed: refreshed.failed,
          });
        }
      } else {
        await keepCacheFresh(affected);
      }
    } catch (error) {
      // The operation itself succeeded; the next export picks the change up.
      logger.warn('Refreshing the cache after the bulk operation failed', { error });
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
   * Generic batched operation processor.
   * `describeItem` labels each op in the per-item results (e.g. "alice → analysts");
   * those labels are what the job record's failures list shows to the user.
   */
  private async processBatchedOperations<T>(
    operationType: string,
    operations: T[],
    processor: (op: T) => Promise<string>,
    batchSize: number,
    maxConcurrency: number,
    describeItem: (op: T) => string = (op) => JSON.stringify(op)
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
        const operation = batch[index] as T;
        const itemId = describeItem(operation);

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
    // Heartbeat while the delete runs: deleteAssets + archive + cache update
    // can take many minutes with no intermediate progress writes, and a job
    // with no heartbeat past the stuck-job threshold gets auto-failed as
    // "worker died or timed out" even though it finishes successfully.
    const heartbeat = setInterval(() => {
      this.updateProgress(
        `Bulk delete in progress (${config.assets.length} assets)...`,
        HEARTBEAT_PROGRESS_PERCENT
      ).catch(() => {
        // heartbeat failures are non-fatal
      });
    }, HEARTBEAT_INTERVAL_MS);

    let deleteResult;
    try {
      // Use existing BulkDeleteService which handles QS delete + moving definitions to archived/
      deleteResult = await this.bulkDeleteService.deleteAssets({
        assets: config.assets.map((a) => ({ type: a.type, id: a.id })),
        reason: config.reason,
        deletedBy: config.requestedBy,
      });
    } finally {
      clearInterval(heartbeat);
    }

    // CRITICAL: After the archive file moves succeed, use the shared DRY cache mutation
    // path so that the active index is updated (status=archived), per-type S3 caches are
    // persisted, memory is evicted in this process, and readers (AssetService.list etc.)
    // will reflect the deletion promptly.
    const successfullyDeleted = config.assets.filter((a) => {
      // Only notify cache for ones that didn't error in the deleteResult
      return !deleteResult.errors.some((e) => e.assetType === a.type && e.assetId === a.id);
    });

    if (successfullyDeleted.length > 0) {
      const archiveUpdates = successfullyDeleted.map((a) => ({
        assetType: a.type,
        assetId: a.id,
        archiveReason: config.reason || 'Bulk delete via portal',
        archivedBy: config.requestedBy,
      }));
      try {
        await cacheService.archiveAssetsInCache(archiveUpdates);
      } catch (cacheErr) {
        // A failed index update means deleted assets keep showing as active
        // until the next full cache rebuild — retry once, then FAIL the job
        // rather than reporting success with a stale index.
        logger.warn('Cache index update failed after bulk delete - retrying once', {
          error: cacheErr,
        });
        try {
          await cacheService.archiveAssetsInCache(archiveUpdates);
        } catch (retryErr) {
          logger.error('Cache index update failed after bulk delete (retry exhausted)', {
            error: retryErr,
          });
          throw new Error(
            'Assets were deleted in QuickSight, but updating the cache index failed - ' +
              'deleted assets may still appear until the next export. ' +
              `Cause: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`
          );
        }
      }
    }

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
    const result = await this.processBatchedOperations(
      'folder-add',
      operations,
      async (op) => {
        await this.folderService.addAssetToFolder(
          op.folderId,
          op.assetId,
          op.assetType.toUpperCase() as any,
          false
        );
        return `Added ${op.assetType}:${op.assetId} to folder ${op.folderId}`;
      },
      batchSize,
      maxConcurrency,
      (op) => `${op.assetType}:${op.assetId} → folder ${op.folderId}`
    );
    return result;
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
        await this.folderService.removeAssetFromFolder(
          op.folderId,
          op.assetId,
          op.assetType.toUpperCase() as any,
          false
        );
        return `Removed ${op.assetType}:${op.assetId} from folder ${op.folderId}`;
      },
      batchSize,
      maxConcurrency,
      (op) => `${op.assetType}:${op.assetId} → folder ${op.folderId}`
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

        return `Added ${op.userName} to group ${op.groupName}`;
      },
      batchSize,
      maxConcurrency,
      describeGroupOperation
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

        return `Removed ${op.userName} from group ${op.groupName}`;
      },
      batchSize,
      maxConcurrency,
      describeGroupOperation
    );
  }

  /** Update*Permissions per asset type: (id, grants, revocations). */
  private permissionUpdaters(): Record<
    string,
    (id: string, grants: any[], revocations: any[]) => Promise<any>
  > {
    const quickSightService = new QuickSightService(process.env.AWS_ACCOUNT_ID || '');
    return {
      dashboard: (id, p, r) => quickSightService.updateDashboardPermissions(id, p, r),
      analysis: (id, p, r) => quickSightService.updateAnalysisPermissions(id, p, r),
      dataset: (id, p, r) => quickSightService.updateDataSetPermissions(id, p, r),
      datasource: (id, p, r) => quickSightService.updateDataSourcePermissions(id, p, r),
      folder: (id, p, r) => quickSightService.updateFolderPermissions(id, p, r),
    };
  }

  /**
   * Process bulk permission revoke operations
   */
  private async processBulkPermissionRevoke(
    config: BulkOperationConfig & {
      assetType: string;
      assetId: string;
      revocations: Array<{ principal: string; actions: string[] }>;
    },
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const updateFn = this.permissionUpdaters()[config.assetType];
    if (!updateFn) {
      throw new Error(`Unsupported asset type for permission revoke: ${config.assetType}`);
    }

    const operations = config.revocations.map((rev) => ({
      principal: rev.principal,
      actions: rev.actions,
      assetType: config.assetType,
      assetId: config.assetId,
    }));

    const result = await this.processBatchedOperations(
      'permission-revoke',
      operations,
      async (op) => {
        const revocation = { Principal: op.principal, Actions: op.actions };
        await updateFn(op.assetId, [], [revocation]);
        return `Revoked permissions for ${op.principal.split('/').pop()}`;
      },
      batchSize,
      maxConcurrency,
      (op) => `${op.principal.split('/').pop()} on ${op.assetType}:${op.assetId}`
    );

    return result;
  }

  /** Process bulk permission grant operations: the mirror of revoke. */
  private async processBulkPermissionGrant(
    config: BulkOperationConfig & {
      assetType: string;
      assetId: string;
      grants: Array<{ principal: string; actions: string[] }>;
    },
    batchSize: number,
    maxConcurrency: number
  ): Promise<BulkOperationResult> {
    const updateFn = this.permissionUpdaters()[config.assetType];
    if (!updateFn) {
      throw new Error(`Unsupported asset type for permission grant: ${config.assetType}`);
    }

    const operations = config.grants.map((grant) => ({
      principal: grant.principal,
      actions: grant.actions,
      assetType: config.assetType,
      assetId: config.assetId,
    }));

    const result = await this.processBatchedOperations(
      'permission-grant',
      operations,
      async (op) => {
        await updateFn(op.assetId, [{ Principal: op.principal, Actions: op.actions }], []);
        return `Granted permissions to ${op.principal.split('/').pop()}`;
      },
      batchSize,
      maxConcurrency,
      (op) => `${op.principal.split('/').pop()} on ${op.assetType}:${op.assetId}`
    );

    return result;
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
        const formattedTags = op.tags.map((t: any) => ({
          key: t.Key ?? t.key,
          value: t.Value ?? t.value ?? '',
        }));
        if (op.action === 'remove') {
          await this.tagService.removeResourceTags(
            op.assetType,
            op.assetId,
            formattedTags.map((t) => t.key)
          );
        } else if (op.action === 'add') {
          // Add or overwrite these keys; every other tag stays.
          await this.tagService.tagResource(op.assetType, op.assetId, formattedTags);
        } else {
          // Replace: exactly these tags.
          await this.tagService.updateResourceTags(op.assetType, op.assetId, formattedTags);
        }
        return `Updated tags for ${op.assetType}:${op.assetId}`;
      },
      batchSize,
      maxConcurrency,
      (op) => `${op.assetType}:${op.assetId}`
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
            const timeout = 2 ** attempt * TIME_UNITS.SECOND;
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
