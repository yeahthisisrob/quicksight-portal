import { RestoreStrategy } from './strategies/restore/RestoreStrategy';
import {
  type DeploymentConfig,
  type DeploymentResult,
  type DeploymentType,
  type IDeploymentStrategy,
  type ValidationResult,
  type DeploymentManifest,
  type DeploymentItem,
} from './types';
import { type AssetType } from '../../../../shared/models/asset.model';
import { type S3Service } from '../../../../shared/services/aws/S3Service';
import { type CacheService } from '../../../../shared/services/cache/CacheService';
import { getPluralForm } from '../../../../shared/types/assetTypes';
import { logger } from '../../../../shared/utils/logger';

// Deployment-specific constants
const DEPLOYMENT_CONSTANTS = {
  ID_GENERATION: {
    RADIX_BASE36: 36,
    RANDOM_STRING_LENGTH: 9,
  },
  PRIORITY: {
    DEFAULT_MAX: 999,
  },
} as const;
// Future strategies can be imported here:
// import { TemplateStrategy } from './strategies/TemplateStrategy';
// import { CrossAccountStrategy } from './strategies/CrossAccountStrategy';
// import { CloneStrategy } from './strategies/CloneStrategy';

/**
 * Scalable deployment service for QuickSight assets
 * Supports multiple deployment strategies and can be extended
 */
export class DeployService {
  private readonly deploymentHistory: Map<string, DeploymentResult> = new Map();
  private readonly strategies: Map<DeploymentType, IDeploymentStrategy>;

  constructor(
    private readonly s3Service: S3Service,
    cacheService: CacheService,
    private readonly bucketName: string,
    private readonly awsAccountId: string,
    private readonly awsRegion: string
  ) {
    // Initialize deployment strategies
    this.strategies = new Map();

    // Register available strategies
    this.registerStrategy(
      'restore',
      new RestoreStrategy(s3Service, cacheService, bucketName, awsAccountId, awsRegion)
    );

    // Future strategies can be registered here:
    // this.registerStrategy('template', new TemplateStrategy(...));
    // this.registerStrategy('cross-account', new CrossAccountStrategy(...));
    // this.registerStrategy('clone', new CloneStrategy(...));
  }

  /**
   * Deploy a single asset
   */
  public async deployAsset(
    assetType: AssetType,
    assetId: string,
    config: DeploymentConfig
  ): Promise<DeploymentResult> {
    const deploymentId = this.generateDeploymentId();
    const startTime = new Date();

    this.logDeploymentStart(deploymentId, assetType, assetId, config);

    try {
      // Get strategy and load asset data
      const strategy = this.getStrategy(config.deploymentType);
      const assetData = await this.loadAndValidateAssetData(assetType, assetId, config);

      // Run validation
      const validationResults = await this.runValidation(
        strategy,
        assetType,
        assetId,
        assetData,
        config
      );
      const hasErrors = validationResults.some((v) => v.severity === 'error' && !v.passed);

      // Check for validation errors
      if (!config.options.validateOnly && hasErrors) {
        throw new Error(this.formatValidationErrors(validationResults));
      }

      // Handle special modes (dry-run, validate-only)
      if (config.options.dryRun) {
        return this.createDryRunResult(
          deploymentId,
          assetType,
          assetId,
          config,
          startTime,
          validationResults
        );
      }

      if (config.options.validateOnly) {
        return this.createValidationOnlyResult(
          deploymentId,
          assetType,
          assetId,
          config,
          startTime,
          validationResults
        );
      }

      // Execute deployment
      const result = await strategy.deploy(assetType, assetId, assetData, config);
      this.deploymentHistory.set(deploymentId, result);
      this.logDeploymentSuccess(deploymentId, assetType, assetId, result);

      return result;
    } catch (error: any) {
      const endTime = new Date();
      const errorResult: DeploymentResult = {
        deploymentId,
        success: false,
        deploymentType: config.deploymentType,
        assetType,
        sourceId: assetId,
        targetId: config.options.id || assetId,
        targetName: config.options.name || 'Unknown',
        accountId: config.target.accountId || this.awsAccountId,
        region: config.target.region || this.awsRegion,
        startTime,
        endTime,
        durationMs: endTime.getTime() - startTime.getTime(),
        status: 'failed',
        error: error.message || 'Unknown error',
      };

      // Store failed deployment in history
      this.deploymentHistory.set(deploymentId, errorResult);

      logger.error(`Deployment ${deploymentId} failed`, {
        assetType,
        assetId,
        error: error.message,
      });

      return errorResult;
    }
  }

  /**
   * Deploy multiple assets from a manifest
   */
  public async deployManifest(manifest: DeploymentManifest): Promise<DeploymentResult[]> {
    logger.info('Starting manifest deployment', {
      version: manifest.version,
      deploymentCount: manifest.deployments.length,
      options: manifest.options,
    });

    const results: DeploymentResult[] = [];
    const deploymentItems = this.sortByPriority(manifest.deployments);

    if (manifest.options.parallel) {
      // Parallel deployment
      const promises = deploymentItems.map((item) =>
        this.deployAsset(item.assetType, item.assetId, item.config).catch((error) => {
          if (manifest.options.stopOnError) {
            throw error;
          }
          return error;
        })
      );

      const parallelResults = await Promise.allSettled(promises);
      results.push(...parallelResults.map((r) => (r.status === 'fulfilled' ? r.value : r.reason)));
    } else {
      // Sequential deployment
      for (const item of deploymentItems) {
        try {
          const result = await this.deployAsset(item.assetType, item.assetId, item.config);
          results.push(result);

          if (!result.success && manifest.options.stopOnError) {
            logger.warn('Stopping manifest deployment due to error');
            break;
          }
        } catch (error: any) {
          if (manifest.options.stopOnError) {
            logger.error('Manifest deployment failed', { error });
            break;
          }
        }
      }
    }

    // Rollback on error if configured
    if (manifest.options.rollbackOnError) {
      const hasErrors = results.some((r) => !r.success);
      if (hasErrors) {
        await this.rollbackDeployments(results.filter((r) => r.success));
      }
    }

    return results;
  }

  /**
   * Get account ID
   */
  public getAccountId(): string {
    return this.awsAccountId;
  }

  /**
   * Get bucket name
   */
  public getBucketName(): string {
    return this.bucketName;
  }

  /**
   * Get deployment by ID
   */
  public getDeployment(deploymentId: string): DeploymentResult | undefined {
    return this.deploymentHistory.get(deploymentId);
  }

  /**
   * Get deployment history
   */
  public getDeploymentHistory(limit?: number): DeploymentResult[] {
    const history = Array.from(this.deploymentHistory.values()).sort(
      (a, b) => b.startTime.getTime() - a.startTime.getTime()
    );

    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Register a deployment strategy
   */
  public registerStrategy(type: DeploymentType, strategy: IDeploymentStrategy): void {
    this.strategies.set(type, strategy);
  }

  /**
   * Create dry run result
   */
  private createDryRunResult(
    deploymentId: string,
    assetType: AssetType,
    assetId: string,
    config: DeploymentConfig,
    startTime: Date,
    validationResults: ValidationResult[]
  ): DeploymentResult {
    const endTime = new Date();
    return {
      deploymentId,
      success: true,
      deploymentType: config.deploymentType,
      assetType,
      sourceId: assetId,
      targetId: config.options.id || assetId,
      targetName: config.options.name || 'Dry Run',
      accountId: config.target.accountId || this.awsAccountId,
      region: config.target.region || this.awsRegion,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      status: 'completed',
      validationResults,
      metadata: { dryRun: true },
    };
  }

  /**
   * Create validation only result
   */
  private createValidationOnlyResult(
    deploymentId: string,
    assetType: AssetType,
    assetId: string,
    config: DeploymentConfig,
    startTime: Date,
    validationResults: ValidationResult[]
  ): DeploymentResult {
    const endTime = new Date();
    const hasErrors = validationResults.some((v) => v.severity === 'error' && !v.passed);

    return {
      deploymentId,
      success: !hasErrors,
      deploymentType: config.deploymentType,
      assetType,
      sourceId: assetId,
      targetId: config.options.id || assetId,
      targetName: config.options.name || 'Validation Only',
      accountId: config.target.accountId || this.awsAccountId,
      region: config.target.region || this.awsRegion,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      status: hasErrors ? 'failed' : 'completed',
      validationResults,
      metadata: { validationOnly: true },
    };
  }

  /**
   * Format validation errors
   */
  private formatValidationErrors(validationResults: ValidationResult[]): string {
    return `Validation failed: ${validationResults
      .filter((v) => !v.passed)
      .map((v) => v.message)
      .join(', ')}`;
  }

  /**
   * Generate unique deployment ID
   */
  private generateDeploymentId(): string {
    return `deploy-${Date.now()}-${Math.random().toString(DEPLOYMENT_CONSTANTS.ID_GENERATION.RADIX_BASE36).substr(2, DEPLOYMENT_CONSTANTS.ID_GENERATION.RANDOM_STRING_LENGTH)}`;
  }

  /**
   * Get deployment strategy
   */
  private getStrategy(deploymentType: DeploymentType): IDeploymentStrategy {
    const strategy = this.strategies.get(deploymentType);
    if (!strategy) {
      throw new Error(`No strategy registered for deployment type: ${deploymentType}`);
    }
    return strategy;
  }

  /**
   * Load and validate asset data
   */
  private async loadAndValidateAssetData(
    assetType: AssetType,
    assetId: string,
    config: DeploymentConfig
  ): Promise<any> {
    logger.info('Loading asset data', { assetType, assetId, source: config.source });
    const assetData = await this.loadAssetData(assetType, assetId, config);

    if (!assetData) {
      logger.error('Asset data not found', { assetType, assetId, source: config.source });
      throw new Error(`Asset ${assetType}/${assetId} not found in source: ${config.source}`);
    }

    logger.info('Asset data loaded successfully', { assetType, assetId, hasData: !!assetData });
    return assetData;
  }

  /**
   * Load asset data based on deployment source
   */
  private async loadAssetData(
    assetType: AssetType,
    assetId: string,
    config: DeploymentConfig
  ): Promise<any> {
    switch (config.source) {
      case 'archive':
        return await this.loadFromArchive(assetType, assetId);

      case 'active':
        return await this.loadFromActive(assetType, assetId);

      case 's3':
        // Load from custom S3 location
        // Implementation would depend on config.options.s3Path
        throw new Error('S3 source not yet implemented');

      case 'template':
        // Load from template library
        throw new Error('Template source not yet implemented');

      case 'external':
        // Load from external source
        throw new Error('External source not yet implemented');

      default:
        throw new Error(`Unknown deployment source: ${config.source}`);
    }
  }

  /**
   * Load asset from active storage
   */
  private async loadFromActive(assetType: AssetType, assetId: string): Promise<any> {
    const activePath = `assets/${getPluralForm(assetType)}/${assetId}.json`;
    try {
      return await this.s3Service.getObject(this.bucketName, activePath);
    } catch (error) {
      logger.error(`Failed to load active asset ${assetType}/${assetId}`, { error });
      return null;
    }
  }

  /**
   * Load asset from archive
   */
  private async loadFromArchive(assetType: AssetType, assetId: string): Promise<any> {
    const archivePath = `archived/${getPluralForm(assetType)}/${assetId}.json`;
    try {
      return await this.s3Service.getObject(this.bucketName, archivePath);
    } catch (error) {
      logger.error(`Failed to load archived asset ${assetType}/${assetId}`, { error });
      return null;
    }
  }

  /**
   * Log deployment start
   */
  private logDeploymentStart(
    deploymentId: string,
    assetType: AssetType,
    assetId: string,
    config: DeploymentConfig
  ): void {
    logger.info(`Starting deployment ${deploymentId}`, {
      assetType,
      assetId,
      deploymentType: config.deploymentType,
      target: config.target,
    });
  }

  /**
   * Log deployment success
   */
  private logDeploymentSuccess(
    deploymentId: string,
    assetType: AssetType,
    assetId: string,
    result: DeploymentResult
  ): void {
    logger.info(`Deployment ${deploymentId} completed successfully`, {
      assetType,
      sourceId: assetId,
      targetId: result.targetId,
      duration: result.durationMs,
    });
  }

  /**
   * Rollback successful deployments
   */
  private async rollbackDeployments(deployments: DeploymentResult[]): Promise<void> {
    logger.info(`Rolling back ${deployments.length} deployments`);

    for (const deployment of deployments) {
      try {
        const strategy = this.strategies.get(deployment.deploymentType);
        if (strategy?.rollback) {
          await strategy.rollback(deployment);
          logger.info(`Rolled back deployment ${deployment.deploymentId}`);
        }
      } catch (error) {
        logger.error(`Failed to rollback deployment ${deployment.deploymentId}`, { error });
      }
    }
  }

  /**
   * Run validation
   */
  private async runValidation(
    strategy: IDeploymentStrategy,
    assetType: AssetType,
    assetId: string,
    assetData: any,
    config: DeploymentConfig
  ): Promise<ValidationResult[]> {
    logger.info('Running validation', {
      assetType,
      assetId,
      validateOnly: config.options.validateOnly,
    });

    const validationResults = await strategy.validate(assetType, assetId, assetData, config);

    logger.info('Validation results received', {
      count: validationResults.length,
      results: validationResults,
    });

    return validationResults;
  }

  /**
   * Sort deployment items by priority
   */
  private sortByPriority(items: DeploymentItem[]): DeploymentItem[] {
    return [...items].sort(
      (a, b) =>
        (a.priority || DEPLOYMENT_CONSTANTS.PRIORITY.DEFAULT_MAX) -
        (b.priority || DEPLOYMENT_CONSTANTS.PRIORITY.DEFAULT_MAX)
    );
  }
}
