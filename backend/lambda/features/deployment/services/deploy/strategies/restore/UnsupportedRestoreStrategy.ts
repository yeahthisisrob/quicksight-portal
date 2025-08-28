import { BaseAssetRestoreStrategy } from './BaseAssetRestoreStrategy';
import type { AssetExportData } from '../../../../../../shared/models/asset-export.model';
import { logger } from '../../../../../../shared/utils/logger';
import type { ValidationResult } from '../../types';

/**
 * Strategy for asset types that don't support restore operations
 */
export class UnsupportedRestoreStrategy extends BaseAssetRestoreStrategy {
  /**
   * Delete is not supported for this asset type
   */
  public async deleteExisting(assetId: string): Promise<void> {
    await Promise.resolve();
    logger.debug(`Delete not implemented for asset type: ${this.assetType}`, {
      assetType: this.assetType,
      assetId,
    });
    // No-op for unsupported types
  }

  /**
   * Restore is not supported for this asset type
   */
  public async restore(
    assetId: string,
    assetData: AssetExportData
  ): Promise<{ arn?: string; [key: string]: any }> {
    await Promise.resolve();
    const assetName = assetData.apiResponses?.describe?.data?.Name || assetId;
    const message = `Restore not implemented for asset type: ${this.assetType}`;
    logger.warn(message, { assetType: this.assetType, assetId, assetName });
    throw new Error(message);
  }

  /**
   * Unsupported asset types cannot be validated
   */
  protected async validateDependencies(
    assetId: string,
    assetData: AssetExportData
  ): Promise<ValidationResult[]> {
    const assetName = assetData.apiResponses?.describe?.data?.Name || assetId;
    return await Promise.resolve([
      {
        validator: 'dependencies',
        passed: false,
        message: `Cannot validate dependencies for unsupported asset type ${this.assetType}: ${assetName}`,
        severity: 'warning',
        details: { assetId, assetType: this.assetType },
      },
    ]);
  }
}
