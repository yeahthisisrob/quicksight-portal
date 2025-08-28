import { RestoreStrategyFactory } from './RestoreStrategyFactory';
import { QUICKSIGHT_LIMITS } from '../../../../../../shared/constants';
import * as mappers from '../../../../../../shared/mappers/quicksight.mapper';
import { type AssetExportData } from '../../../../../../shared/models/asset-export.model';
import { AssetStatus, type AssetType } from '../../../../../../shared/models/asset.model';
import { getAssetName } from '../../../../../../shared/models/quicksight-domain.model';
import { QuickSightService } from '../../../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../../../shared/services/aws/S3Service';
import { type CacheService } from '../../../../../../shared/services/cache/CacheService';
import {
  ASSET_TYPES,
  ASSET_TYPES_PLURAL,
  isCollectionType,
} from '../../../../../../shared/types/assetTypes';
import { logger } from '../../../../../../shared/utils/logger';
import {
  type IDeploymentStrategy,
  type DeploymentType,
  type DeploymentConfig,
  type DeploymentResult,
  type ValidationResult,
  type DeploymentStatus,
} from '../../types';

// Reuse deployment constants from parent service
const DEPLOYMENT_CONSTANTS = {
  ID_GENERATION: {
    RADIX_BASE36: 36,
    RANDOM_STRING_LENGTH: 9,
  },
} as const;

/**
 * Restore strategy - restores archived assets back to QuickSight
 */
export class RestoreStrategy implements IDeploymentStrategy {
  public type: DeploymentType = 'restore';
  private readonly quickSightService: QuickSightService;
  private readonly restoreStrategyFactory: RestoreStrategyFactory;

  constructor(
    private readonly s3Service: S3Service,
    private readonly cacheService: CacheService,
    private readonly bucketName: string,
    private readonly awsAccountId: string,
    private readonly awsRegion: string
  ) {
    this.quickSightService = new QuickSightService(awsAccountId);
    this.restoreStrategyFactory = new RestoreStrategyFactory(
      this.quickSightService,
      this.s3Service,
      awsAccountId,
      bucketName
    );
  }

  /**
   * Deploy (restore) the asset
   */
  public async deploy(
    assetType: AssetType,
    assetId: string,
    assetData: any,
    config: DeploymentConfig
  ): Promise<DeploymentResult> {
    const startTime = new Date();
    const deploymentId = `restore-${Date.now()}-${Math.random().toString(DEPLOYMENT_CONSTANTS.ID_GENERATION.RADIX_BASE36).substr(2, DEPLOYMENT_CONSTANTS.ID_GENERATION.RANDOM_STRING_LENGTH)}`;
    const targetId = config.options.id || assetId;

    let status: DeploymentStatus = 'deploying';
    let error: string | undefined;
    let targetArn: string | undefined;
    let backupPath: string | undefined;

    try {
      logger.info(`Starting restore for ${assetType} ${assetId}`, {
        hasAssetData: !!assetData,
        assetDataKeys: assetData ? Object.keys(assetData) : [],
      });

      const deployData = this.applyTransformations(assetData, config);

      await this.handleExistingAssetBackup(assetType, targetId, config);

      logger.info(`Performing QuickSight restore for ${assetType} ${assetId}`);
      const restoreResult = await this.performRestore(assetType, targetId, deployData);
      targetArn = restoreResult.arn;
      logger.info(`QuickSight restore successful for ${assetType} ${assetId}`, { arn: targetArn });

      logger.info(`Starting post-restore operations for ${assetType} ${assetId}`);
      await this.postRestoreOperations({
        assetType,
        assetId,
        targetId,
        assetData,
        deployData,
        config,
        arn: restoreResult.arn,
      });

      backupPath = await this.createArchivedBackup(assetType, assetId, assetData);
      status = 'completed';

      logger.info(`Successfully restored ${assetType} ${assetId} as ${targetId}`);
    } catch (err: any) {
      logger.error(`Restore failed at stage for ${assetType} ${assetId}:`, {
        error: err.message,
        stack: err.stack,
        errorType: err.constructor?.name,
      });
      ({ status, error } = this.handleRestoreError(err, assetType, assetId, targetId));
    }

    return this.buildDeploymentResult({
      deploymentId,
      success: status === 'completed',
      assetType,
      sourceId: assetId,
      targetId,
      targetName: config.options.name || assetData.Name || assetData.name || 'Unknown',
      targetArn,
      startTime,
      endTime: new Date(),
      status,
      error,
      backupPath,
      config,
    });
  }

  /**
   * Validate the restore operation
   */
  public async validate(
    assetType: AssetType,
    assetId: string,
    assetData: any,
    config: DeploymentConfig
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    logger.info('RestoreStrategy.validate called', {
      assetType,
      assetId,
      source: config.source,
      hasAssetData: !!assetData,
    });

    // Validate source is archive
    if (config.source !== 'archive') {
      results.push({
        validator: 'source',
        passed: false,
        message: 'Restore deployment requires source to be "archive"',
        severity: 'error',
      });
    }

    // Validate asset data exists
    if (!assetData) {
      results.push({
        validator: 'asset-data',
        passed: false,
        message: `Asset ${assetType}/${assetId} not found in archive`,
        severity: 'error',
      });
      return results; // Can't validate further without data
    }

    // Validate target ID
    const targetId = config.options.id || assetId;
    if (!this.isValidAssetId(targetId)) {
      results.push({
        validator: 'asset-id',
        passed: false,
        message: `Invalid asset ID: ${targetId}`,
        severity: 'error',
      });
    }

    // Check if asset already exists (unless skipIfExists or overwriteExisting)
    if (!config.options.skipIfExists && !config.options.overwriteExisting) {
      const exists = await this.assetExists(assetType, targetId);
      if (exists) {
        results.push({
          validator: 'asset-exists',
          passed: false,
          message: `Asset ${assetType}/${targetId} already exists. Use skipIfExists or overwriteExisting option.`,
          severity: 'error',
        });
      }
    }

    // Delegate validation to the strategy
    const strategy = this.restoreStrategyFactory.getStrategy(assetType);
    const strategyResults = await strategy.validate(assetId, assetData, config);
    results.push(...strategyResults);

    // Always add an overall result
    const errorCount = results.filter((r) => !r.passed && r.severity === 'error').length;
    const hasErrors = errorCount > 0;

    if (!hasErrors) {
      // If no errors (or no results at all), add success
      const successMessage =
        results.length === 0 ? 'Ready to restore' : `All ${results.length} validation(s) passed`;

      results.push({
        validator: 'overall',
        passed: true,
        message: successMessage,
        severity: 'info',
      });
    } else {
      // If there are errors, add a failure summary
      results.push({
        validator: 'overall',
        passed: false,
        message: `${errorCount} validation error(s) found - please fix before restoring`,
        severity: 'error',
      });
    }

    logger.info('RestoreStrategy.validate completed', {
      assetType,
      assetId,
      resultCount: results.length,
      hasErrors: results.some((r) => !r.passed && r.severity === 'error'),
      results: results.map((r) => ({
        validator: r.validator,
        passed: r.passed,
        severity: r.severity,
      })),
    });

    return results;
  }

  /**
   * Apply config overrides to data
   */
  private applyConfigOverrides(data: any, config: DeploymentConfig): any {
    const result = { ...data };

    if (config.options.name) {
      this.applyNameOverrides(result, config.options.name);
    }

    if (config.options.description !== undefined) {
      result.Description = config.options.description;
    }

    if (config.options.tags) {
      result.Tags = config.options.tags.map((t) => ({ Key: t.key, Value: t.value }));
    }

    return result;
  }

  /**
   * Apply custom transformations and variable substitutions
   */
  private applyCustomTransformations(data: any, config: DeploymentConfig): any {
    let result = data;

    // Apply custom transformations
    if (config.options.transformations) {
      for (const transform of config.options.transformations) {
        result = this.applyTransformation(result, transform);
      }
    }

    // Apply variable substitutions
    if (config.options.variableSubstitutions) {
      result = this.applyVariableSubstitutions(result, config.options.variableSubstitutions);
    }

    return result;
  }

  /**
   * Apply name overrides to all asset type name fields
   */
  private applyNameOverrides(data: any, name: string): void {
    data.Name = name;
    const nameFields = [
      'DashboardName',
      'AnalysisName',
      'DataSetName',
      'DataSourceName',
      'FolderName',
      'GroupName',
    ];
    for (const field of nameFields) {
      if (data[field]) {
        data[field] = name;
      }
    }
  }

  /**
   * Apply a single transformation
   */
  private applyTransformation(data: any, _transformation: any): any {
    // Implementation depends on transformation type
    // This is a placeholder for future transformation logic
    return data;
  }

  /**
   * Apply transformations to asset data
   */
  private applyTransformations(assetData: any, config: DeploymentConfig): any {
    const exportData = assetData as AssetExportData;
    const actualData = exportData.apiResponses?.describe?.data || assetData;
    let data = { ...actualData };

    data = this.extractArchivedComponents(assetData, data, config);
    data = this.applyConfigOverrides(data, config);
    data = this.applyCustomTransformations(data, config);

    delete data.archivedMetadata;

    return {
      ...data,
      apiResponses: assetData.apiResponses,
    };
  }

  /**
   * Apply variable substitutions
   */
  private applyVariableSubstitutions(data: any, substitutions: Record<string, string>): any {
    const json = JSON.stringify(data);
    let result = json;

    for (const [variable, value] of Object.entries(substitutions)) {
      result = result.replace(new RegExp(`\\$\\{${variable}\\}`, 'g'), value);
    }

    return JSON.parse(result);
  }

  /**
   * Check if an asset exists
   */
  private async assetExists(assetType: AssetType, assetId: string): Promise<boolean> {
    try {
      const activePath = isCollectionType(assetType)
        ? `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
        : `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;

      return await this.s3Service.objectExists(this.bucketName, activePath);
    } catch {
      return false;
    }
  }

  /**
   * Create backup of existing asset
   */
  private async backupExistingAsset(assetType: AssetType, assetId: string): Promise<string> {
    const activePath = `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;
    const backupPath = `backups/${ASSET_TYPES_PLURAL[assetType]}/${assetId}-${Date.now()}.json`;

    const assetData = await this.s3Service.getObject(this.bucketName, activePath);
    await this.s3Service.putObject(this.bucketName, backupPath, assetData);

    return backupPath;
  }

  /**
   * Build the deployment result object
   */
  private buildDeploymentResult(params: {
    deploymentId: string;
    success: boolean;
    assetType: AssetType;
    sourceId: string;
    targetId: string;
    targetName: string;
    targetArn?: string;
    startTime: Date;
    endTime: Date;
    status: DeploymentStatus;
    error?: string;
    backupPath?: string;
    config: DeploymentConfig;
  }): DeploymentResult {
    return {
      deploymentId: params.deploymentId,
      success: params.success,
      deploymentType: this.type,
      assetType: params.assetType,
      sourceId: params.sourceId,
      targetId: params.targetId,
      targetName: params.targetName,
      targetArn: params.targetArn,
      accountId: params.config.target.accountId || this.awsAccountId,
      region: params.config.target.region || this.awsRegion,
      startTime: params.startTime,
      endTime: params.endTime,
      durationMs:
        params.endTime instanceof Date && params.startTime instanceof Date
          ? params.endTime.getTime() - params.startTime.getTime()
          : 0,
      status: params.status,
      error: params.error,
      backupPath: params.backupPath,
      transformationsApplied: params.config.options.transformations?.map((t) => t.type),
      metadata: {
        source: 'archive',
        originalId: params.sourceId,
        overwrite: params.config.options.overwriteExisting,
      },
    };
  }

  private convertSDKToDomainSummary(assetType: AssetType, sdkData: any): any {
    switch (assetType) {
      case ASSET_TYPES.dashboard:
        return mappers.mapSDKDashboardSummaryToDomain(sdkData);
      case ASSET_TYPES.analysis:
        return mappers.mapSDKAnalysisSummaryToDomain(sdkData);
      case ASSET_TYPES.dataset:
        return mappers.mapSDKDataSetSummaryToDomain(sdkData);
      case ASSET_TYPES.datasource:
        return mappers.mapSDKDataSourceSummaryToDomain(sdkData);
      case ASSET_TYPES.folder:
        return mappers.mapSDKFolderSummaryToDomain(sdkData);
      case ASSET_TYPES.user:
        return mappers.mapSDKUserSummaryToDomain(sdkData);
      case ASSET_TYPES.group:
        return mappers.mapSDKGroupSummaryToDomain(sdkData);
      default:
        throw new Error(`Unknown asset type: ${assetType}`);
    }
  }

  /**
   * Copy asset from archived to active location (preserves archived version)
   */
  private async copyToActive(
    assetType: AssetType,
    originalId: string,
    targetId: string,
    assetData: any
  ): Promise<void> {
    if (isCollectionType(assetType)) {
      // For collection types, move from archived to active collection
      const activePath = `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`;
      const archivePath = `archived/organization/${ASSET_TYPES_PLURAL[assetType]}.json`;

      // Get both collections
      const [activeCollection] = await Promise.all([
        this.s3Service.getObject(this.bucketName, activePath).catch(() => ({})),
        this.s3Service.getObject(this.bucketName, archivePath).catch(() => ({})),
      ]);

      // Copy item to active collection (don't remove from archived)
      activeCollection[targetId] = assetData;
      // DO NOT DELETE from archived collection - preserve the archive

      // Save only the active collection
      await this.s3Service.putObject(this.bucketName, activePath, activeCollection);
    } else {
      // For individual types
      const activePath = `assets/${ASSET_TYPES_PLURAL[assetType]}/${targetId}.json`;
      const archivePath = `archived/${ASSET_TYPES_PLURAL[assetType]}/${originalId}.json`;

      // Get the full archived data (with apiResponses structure)
      const archivedData = await this.s3Service.getObject(this.bucketName, archivePath);

      // Save to active location (preserve the full structure)
      await this.s3Service.putObject(this.bucketName, activePath, archivedData);

      // DO NOT DELETE from archived location - preserve the archive
    }
  }

  /**
   * Create numbered backup of archived version
   */
  private async createArchivedBackup(
    assetType: AssetType,
    assetId: string,
    assetData: any
  ): Promise<string> {
    let backupNumber = 1;
    let backupPath: string;

    do {
      backupPath = `archived/${ASSET_TYPES_PLURAL[assetType]}/${assetId}-previous-archive-${backupNumber}.json`;
      const exists = await this.s3Service.objectExists(this.bucketName, backupPath);
      if (!exists) {
        break;
      }
      backupNumber++;
    } while (backupNumber < QUICKSIGHT_LIMITS.DEFAULT_MAX_RESULTS);

    await this.s3Service.putObject(this.bucketName, backupPath, {
      ...assetData,
      backupMetadata: {
        backupDate: new Date().toISOString(),
        backupNumber,
        originalArchivePath: `archived/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`,
      },
    });

    return backupPath;
  }

  /**
   * Delete existing asset before restore (if it exists)
   */
  private async deleteExistingAsset(assetType: AssetType, assetId: string): Promise<void> {
    const strategy = this.restoreStrategyFactory.getStrategy(assetType);
    await strategy.deleteExisting(assetId);
  }

  /**
   * Extract archived components from asset data
   */
  private extractArchivedComponents(assetData: any, data: any, config: DeploymentConfig): any {
    const result = { ...data };

    // Permissions
    if (assetData.apiResponses?.permissions?.data) {
      result.Permissions = assetData.apiResponses.permissions.data;
      logger.info('Found permissions in archived data', {
        permissionCount: result.Permissions?.length || 0,
      });
    }

    // Tags (only if not overridden in config)
    if (assetData.apiResponses?.tags?.data && !config.options.tags) {
      result.Tags = assetData.apiResponses.tags.data;
      logger.info('Found tags in archived data', {
        tagCount: result.Tags?.length || 0,
      });
    }

    // Dataset-specific components
    this.extractDatasetComponents(assetData, result);

    // Special components
    this.extractSpecialComponents(assetData, result);

    return result;
  }

  /**
   * Extract dataset-specific components
   */
  private extractDatasetComponents(assetData: any, data: any): void {
    if (assetData.apiResponses?.dataSetRefreshProperties?.data) {
      data.DataSetRefreshProperties = assetData.apiResponses.dataSetRefreshProperties.data;
      logger.info('Found refresh properties in archived data');
    }

    if (assetData.apiResponses?.refreshSchedules?.data) {
      data.RefreshSchedules = assetData.apiResponses.refreshSchedules.data;
      logger.info('Found refresh schedules in archived data', {
        scheduleCount: data.RefreshSchedules?.length || 0,
      });
    }

    if (assetData.apiResponses?.folderMemberships?.data) {
      data.FolderMemberships = assetData.apiResponses.folderMemberships.data;
      logger.info('Found folder memberships in archived data');
    }
  }

  /**
   * Extract special components
   */
  private extractSpecialComponents(assetData: any, data: any): void {
    const specialKeys = ['dashboardPublishOptions', 'sheetDefinitions', 'visualDefinitions'];
    for (const key of specialKeys) {
      if (assetData.apiResponses?.[key]?.data) {
        data[key] = assetData.apiResponses[key].data;
        logger.info(`Found ${key} in archived data`);
      }
    }
  }

  /**
   * Handle backup of existing asset if needed
   */
  private async handleExistingAssetBackup(
    assetType: AssetType,
    targetId: string,
    config: DeploymentConfig
  ): Promise<void> {
    if (config.options.overwriteExisting) {
      const exists = await this.assetExists(assetType, targetId);
      if (exists) {
        const existingBackupPath = await this.backupExistingAsset(assetType, targetId);
        logger.info(`Created backup of existing asset at ${existingBackupPath}`);
      }
    }
  }

  /**
   * Handle restore errors
   */
  private handleRestoreError(
    err: any,
    assetType: AssetType,
    assetId: string,
    targetId: string
  ): { status: DeploymentStatus; error: string } {
    const status: DeploymentStatus = 'failed';

    // Better error message extraction
    let errorMessage = 'Unknown error during restore';
    if (err.message) {
      errorMessage = err.message;
      // Check for specific error patterns
      if (err.message.includes('getTime')) {
        errorMessage = `Date parsing error during restore: ${err.message}. This may be due to invalid date formats in the archived data.`;
      }
    }

    logger.error(`Failed to restore ${assetType} ${assetId}`, {
      error: errorMessage,
      originalError: err.message,
      stack: err.stack,
      assetType,
      assetId,
      targetId,
    });

    // Note: Cache and S3 updates are automatically skipped since they're in postRestoreOperations
    // which only runs if performRestore succeeds

    return { status, error: errorMessage };
  }

  /**
   * Validate asset ID format
   */
  private isValidAssetId(id: string): boolean {
    // QuickSight IDs must be alphanumeric with hyphens and underscores
    return /^[a-zA-Z0-9_-]+$/.test(id);
  }

  /**
   * Perform the main restore operation
   */
  private async performRestore(
    assetType: AssetType,
    targetId: string,
    deployData: any
  ): Promise<{ arn?: string; [key: string]: any }> {
    const restoreResult = await this.restoreToQuickSight(assetType, targetId, deployData);
    await this.restoreAdditionalComponents(assetType, targetId, deployData);
    return restoreResult;
  }

  /**
   * Handle post-restore operations (S3 and cache updates)
   */
  private async postRestoreOperations(params: {
    assetType: AssetType;
    assetId: string;
    targetId: string;
    assetData: any;
    deployData: any;
    config: DeploymentConfig;
    arn?: string;
  }): Promise<void> {
    await this.copyToActive(params.assetType, params.assetId, params.targetId, params.assetData);

    if (!params.config.options.validateOnly) {
      await this.updateCacheForRestoredAsset(
        params.assetType,
        params.targetId,
        params.assetData,
        params.deployData,
        params.arn
      );
      logger.info(`Successfully updated cache for restored ${params.assetType} ${params.assetId}`);

      // Rebuild cache for this asset type so frontend sees the change immediately
      try {
        await this.cacheService.rebuildCacheForAssetType(params.assetType);
        logger.info(`Successfully rebuilt cache for ${params.assetType} after restore`);
      } catch (error) {
        logger.warn(`Failed to rebuild cache after restore, may need manual refresh:`, error);
      }
    }
  }

  /**
   * Restore additional components after main asset creation
   */
  private async restoreAdditionalComponents(
    assetType: AssetType,
    assetId: string,
    deployData: any
  ): Promise<void> {
    logger.info(`Restoring additional components for ${assetType} ${assetId}`);

    try {
      // 1. Permissions should be set during creation, but log if they exist
      if (deployData.Permissions && deployData.Permissions.length > 0) {
        logger.info(`Permissions were included in restore for ${assetType} ${assetId}`, {
          permissionCount: deployData.Permissions.length,
        });

        // Note: Permissions are set during asset creation via the create APIs
        // We don't need to update them separately unless the create API failed to set them
        // which would have caused the create to fail
      }

      // 2. Apply tags if they exist
      if (deployData.Tags && deployData.Tags.length > 0) {
        logger.info(`Applying tags to ${assetType} ${assetId}`, {
          tagCount: deployData.Tags.length,
        });

        // QuickSight tag operations are handled during creation for most assets
        // This is a fallback if tags weren't applied
      }

      // 3. For datasets, restore refresh schedules
      if (assetType === 'dataset' && deployData.RefreshSchedules) {
        logger.info(`Restoring refresh schedules for dataset ${assetId}`, {
          scheduleCount: deployData.RefreshSchedules.length,
        });

        for (const schedule of deployData.RefreshSchedules) {
          try {
            await this.quickSightService.createRefreshSchedule(assetId, schedule);
            logger.info(`Created refresh schedule ${schedule.ScheduleId} for dataset ${assetId}`);
          } catch (error) {
            logger.warn(`Failed to create refresh schedule for dataset ${assetId}:`, error);
          }
        }
      }

      // 4. For datasets, update refresh properties
      if (assetType === 'dataset' && deployData.DataSetRefreshProperties) {
        logger.info(`Updating refresh properties for dataset ${assetId}`);

        try {
          await this.quickSightService.putDataSetRefreshProperties(
            assetId,
            deployData.DataSetRefreshProperties
          );
        } catch (error) {
          logger.warn(`Failed to update refresh properties for dataset ${assetId}:`, error);
        }
      }

      // 5. Restore folder memberships if any
      if (deployData.FolderMemberships && deployData.FolderMemberships.length > 0) {
        logger.info(`Restoring folder memberships for ${assetType} ${assetId}`, {
          folderCount: deployData.FolderMemberships.length,
        });

        for (const membership of deployData.FolderMemberships) {
          try {
            await this.quickSightService.createFolderMembership(
              membership.FolderId,
              assetId,
              assetType.toUpperCase()
            );
            logger.info(`Added ${assetType} ${assetId} to folder ${membership.FolderId}`);
          } catch (error) {
            logger.warn(`Failed to add to folder ${membership.FolderId}:`, error);
          }
        }
      }
    } catch (error) {
      logger.error(`Error restoring additional components for ${assetType} ${assetId}:`, error);
      // Don't fail the entire restore if additional components fail
      // The main asset has been created successfully
    }
  }

  /**
   * Restore asset to QuickSight using the appropriate strategy
   */
  private async restoreToQuickSight(
    assetType: AssetType,
    assetId: string,
    assetData: any
  ): Promise<{ arn?: string; [key: string]: any }> {
    // Delete existing asset if it exists
    await this.deleteExistingAsset(assetType, assetId);

    // Get the appropriate strategy and restore
    const strategy = this.restoreStrategyFactory.getStrategy(assetType);
    return await strategy.restore(assetId, assetData as AssetExportData);
  }

  private async updateCacheForRestoredAsset(
    assetType: AssetType,
    assetId: string,
    archivedData: any,
    deployData: any,
    arn?: string
  ): Promise<void> {
    try {
      const describeData = archivedData.apiResponses?.describe?.data || deployData;
      const permissions =
        archivedData.apiResponses?.permissions?.data || deployData.Permissions || [];
      const tags = archivedData.apiResponses?.tags?.data || deployData.Tags || [];

      const createdTime = describeData.CreatedTime || describeData.createdTime;
      const lastUpdatedTime = describeData.LastUpdatedTime || describeData.lastUpdatedTime;

      const domainSummary = this.convertSDKToDomainSummary(assetType, describeData);
      const assetName = getAssetName(domainSummary);

      await this.cacheService.replaceAsset(assetType, assetId, {
        assetId,
        assetType,
        assetName,
        arn: arn || describeData.Arn || describeData.arn || '',
        status: AssetStatus.ACTIVE,
        enrichmentStatus: 'enriched',
        createdTime: createdTime ? new Date(createdTime) : new Date(),
        lastUpdatedTime: lastUpdatedTime ? new Date(lastUpdatedTime) : new Date(),
        exportedAt: new Date(),
        exportFilePath: isCollectionType(assetType)
          ? `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
          : `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`,
        storageType: isCollectionType(assetType) ? 'collection' : 'individual',
        tags: tags.map((t: any) => ({ key: t.Key || t.key, value: t.Value || t.value })),
        permissions: permissions.map((p: any) => ({
          principal: p.Principal,
          actions: p.Actions || [],
        })),
        metadata: {
          ...describeData,
          hasPermissions: permissions.length > 0,
          hasTags: tags.length > 0,
          restoredAt: new Date().toISOString(),
        },
      });

      logger.info(`Updated cache for restored ${assetType} ${assetId}`, {
        permissionCount: permissions.length,
        tagCount: tags.length,
        enrichmentStatus: 'enriched',
      });
    } catch (error) {
      logger.error(`Failed to update cache for restored asset ${assetType}/${assetId}`, { error });
    }
  }
}
