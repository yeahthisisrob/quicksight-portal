/**
 * CSV Export Processor
 * Handles generation of CSV files from cached asset data
 * Part of the asset-management vertical slice (VSA)
 */
import { cacheService } from '../../../shared/services/cache/CacheService';
import { type JobStateService } from '../../../shared/services/jobs/JobStateService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { getSingularForm } from '../../../shared/types/assetTypes';
import { generateCSV } from '../../../shared/utils/csvExport';
import { logger } from '../../../shared/utils/logger';
import { AssetService } from '../services/AssetService';

export interface CSVExportOptions {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface CSVExportResult {
  csv: string;
  filename: string;
  count: number;
}

// Progress tracking constants
const PROGRESS = {
  START: 10,
  LOADING: 30,
  GENERATING: 70,
  FINALIZING: 90,
} as const;

// Asset query limits
const EXPORT_LIMITS = {
  MAX_RESULTS: 10000, // Maximum number of items to export
  FILENAME_DATE_LENGTH: 10, // YYYY-MM-DD format
} as const;

/**
 * Processor for generating CSV exports of asset data
 * Uses cached data to avoid API rate limits
 */
export class CSVExportProcessor {
  private readonly assetService: AssetService;
  private jobId?: string;
  private jobStateService?: JobStateService;

  constructor(accountId: string) {
    this.assetService = new AssetService(accountId);
  }

  /**
   * Generate CSV export for the specified asset type
   */
  public async generateCSVExport(
    assetType: string,
    options: CSVExportOptions = {}
  ): Promise<CSVExportResult> {
    logger.info('Starting CSV export generation', { assetType, options });

    await this.updateProgress(PROGRESS.START, `Loading ${assetType} data from cache`);

    try {
      // Get all assets from cache (already filtered to active only)
      const cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });

      if (!cache || !cache.entries) {
        throw new Error('No cached data available');
      }

      await this.updateProgress(PROGRESS.LOADING, `Processing ${assetType} data`);

      // Get assets for the specified type
      const assets = await this.getAssetsForExport(assetType, options);

      if (!assets || assets.length === 0) {
        logger.warn('No assets found for export', { assetType });
        return {
          csv: '',
          filename: this.generateFilename(assetType),
          count: 0,
        };
      }

      await this.updateProgress(
        PROGRESS.GENERATING,
        `Generating CSV for ${assets.length} ${assetType}(s)`
      );

      // Normalize to singular form for CSV column config lookup
      const singularType = getSingularForm(assetType) || assetType;

      // Generate CSV from assets using singular type for column config
      const csv = generateCSV(assets, singularType);

      await this.updateProgress(PROGRESS.FINALIZING, 'Finalizing export');

      const result: CSVExportResult = {
        csv,
        filename: this.generateFilename(assetType),
        count: assets.length,
      };

      logger.info('CSV export generated successfully', {
        assetType,
        count: result.count,
        sizeBytes: csv.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to generate CSV export', { assetType, error });
      throw error;
    }
  }

  /**
   * Set job state service for progress tracking
   */
  public setJobStateService(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
  }

  /**
   * Generate filename for CSV export
   */
  private generateFilename(assetType: string): string {
    const date = new Date().toISOString().slice(0, EXPORT_LIMITS.FILENAME_DATE_LENGTH);
    return `quicksight_${assetType}_export_${date}.csv`;
  }

  /**
   * Get assets for export with filtering and sorting
   */
  private async getAssetsForExport(assetType: string, options: CSVExportOptions): Promise<any[]> {
    // Normalize to singular form for AssetService.list
    const singularType = getSingularForm(assetType) || assetType;

    // Use AssetService.list to get properly mapped and enriched assets
    // Pass a very large pageSize to get all items
    const result = await this.assetService.list(singularType, {
      maxResults: EXPORT_LIMITS.MAX_RESULTS,
      startIndex: 0,
      search: options.search,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder?.toUpperCase() as 'ASC' | 'DESC',
      filters: options.filters,
    });

    return result.items || [];
  }

  /**
   * Update job progress
   */
  private async updateProgress(progress: number, message: string): Promise<void> {
    if (this.jobStateService && this.jobId) {
      try {
        await this.jobStateService.updateJobStatus(this.jobId, {
          progress,
          message,
        });
      } catch (error) {
        logger.warn('Failed to update job progress', { error });
      }
    }
  }
}
