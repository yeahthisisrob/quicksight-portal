import { AnalysisRestoreStrategy } from './AnalysisRestoreStrategy';
import { type BaseAssetRestoreStrategy } from './BaseAssetRestoreStrategy';
import { DashboardRestoreStrategy } from './DashboardRestoreStrategy';
import { DatasetRestoreStrategy } from './DatasetRestoreStrategy';
import { DatasourceRestoreStrategy } from './DatasourceRestoreStrategy';
import { UnsupportedRestoreStrategy } from './UnsupportedRestoreStrategy';
import { type QuickSightService } from '../../../../../../shared/services/aws/QuickSightService';
import { type S3Service } from '../../../../../../shared/services/aws/S3Service';
import type { AssetType } from '../../../../../data-export/types';

/**
 * Factory for creating asset-specific restore strategies
 */
export class RestoreStrategyFactory {
  private readonly awsAccountId: string;
  private readonly bucketName?: string;
  private readonly quickSightService: QuickSightService;
  private readonly s3Service: S3Service;
  private readonly strategies: Map<AssetType, BaseAssetRestoreStrategy>;

  constructor(
    quickSightService: QuickSightService,
    s3Service: S3Service,
    awsAccountId: string,
    bucketName?: string
  ) {
    this.quickSightService = quickSightService;
    this.s3Service = s3Service;
    this.awsAccountId = awsAccountId;
    this.bucketName = bucketName;
    this.strategies = new Map();
    this.initializeStrategies();
  }

  /**
   * Get strategy for a specific asset type
   */
  public getStrategy(assetType: AssetType): BaseAssetRestoreStrategy {
    const strategy = this.strategies.get(assetType);
    if (!strategy) {
      throw new Error(`No restore strategy available for asset type: ${assetType}`);
    }
    return strategy;
  }

  /**
   * Check if a strategy exists for the asset type
   */
  public hasStrategy(assetType: AssetType): boolean {
    return this.strategies.has(assetType);
  }

  /**
   * Initialize all strategy instances
   */
  private initializeStrategies(): void {
    this.strategies.set(
      'dashboard',
      new DashboardRestoreStrategy(
        this.quickSightService,
        this.s3Service,
        this.awsAccountId,
        'dashboard',
        this.bucketName
      )
    );

    this.strategies.set(
      'analysis',
      new AnalysisRestoreStrategy(
        this.quickSightService,
        this.s3Service,
        this.awsAccountId,
        'analysis',
        this.bucketName
      )
    );

    this.strategies.set(
      'dataset',
      new DatasetRestoreStrategy(
        this.quickSightService,
        this.s3Service,
        this.awsAccountId,
        'dataset',
        this.bucketName
      )
    );

    this.strategies.set(
      'datasource',
      new DatasourceRestoreStrategy(
        this.quickSightService,
        this.s3Service,
        this.awsAccountId,
        'datasource',
        this.bucketName
      )
    );

    // Add unsupported types
    const unsupportedTypes: AssetType[] = ['folder', 'group', 'user'];
    for (const type of unsupportedTypes) {
      this.strategies.set(
        type,
        new UnsupportedRestoreStrategy(
          this.quickSightService,
          this.s3Service,
          this.awsAccountId,
          type,
          this.bucketName
        )
      );
    }
  }
}
