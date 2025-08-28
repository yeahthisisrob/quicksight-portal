import { ArchiveService } from '../../../shared/services/archive/ArchiveService';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';

// Demo cleanup detection constants
const DEMO_DETECTION = {
  MIN_MATCHING_FIELDS: 3, // Minimum matching dataset fields to classify as demo
  MIN_VISUAL_COUNT: 5, // Minimum visuals for demo analysis detection
  LOG_VISUAL_TITLES_LIMIT: 3, // Number of visual titles to log for verification
} as const;

// Demo dataset patterns
const DEMO_DATASET_PATTERNS = [
  {
    name: 'Sales Pipeline',
    fields: [
      'Salesperson',
      'Lead Name',
      'Opportunity Stage',
      'Weighted Revenue',
      'Forecasted Monthly Revenue',
    ],
  },
  {
    name: 'People Overview',
    fields: [
      'Employee Name',
      'Employee ID',
      'Monthly Compensation',
      'Business Function',
      'Job Family',
    ],
  },
  {
    name: 'Business Review',
    fields: ['Customer ID', 'Customer Name', 'Service Line', 'Revenue Goal', 'Billed Amount'],
  },
  {
    name: 'Web and Social Media Analytics',
    fields: [
      'Website Pageviews',
      'Website Visits',
      'Twitter mentions',
      'Twitter followers',
      'New visitors Social Media',
    ],
  },
];

interface DemoAssets {
  datasources: Array<{ id: string; name: string; bucket?: string }>;
  datasets: Array<{ id: string; name: string; datasourceIds: string[] }>;
  analyses: Array<{ id: string; name: string }>;
  totalCount: number;
}

interface CleanupResult {
  deleted: {
    datasources: number;
    datasets: number;
    analyses: number;
    total: number;
  };
  archived: {
    datasources: number;
    datasets: number;
    analyses: number;
    total: number;
  };
  errors: Array<{ assetType: string; assetId: string; error: string }>;
}

export class DemoCleanupService {
  private readonly archiveService: ArchiveService;
  private readonly quickSightService;

  constructor(private readonly accountId: string) {
    const bucketName = process.env.BUCKET_NAME || 'quicksight-metadata-bucket';
    this.archiveService = new ArchiveService(bucketName, cacheService);
    this.quickSightService = ClientFactory.getQuickSightService(this.accountId);
  }

  /**
   * Delete and archive all demo assets
   */
  public async executeDemoCleanup(): Promise<CleanupResult> {
    const result: CleanupResult = {
      deleted: { datasources: 0, datasets: 0, analyses: 0, total: 0 },
      archived: { datasources: 0, datasets: 0, analyses: 0, total: 0 },
      errors: [],
    };

    try {
      // First find all demo assets
      const demoAssets = await this.findDemoAssets();

      if (demoAssets.totalCount === 0) {
        logger.info('No demo assets found to clean up');
        return result;
      }

      this.logFoundAssets(demoAssets);

      // Delete in reverse order: analyses first, then datasets, then datasources
      await this.deleteAnalyses(demoAssets.analyses, result);
      await this.deleteDatasets(demoAssets.datasets, result);
      await this.deleteDatasources(demoAssets.datasources, result);

      // Update totals
      result.deleted.total =
        result.deleted.analyses + result.deleted.datasets + result.deleted.datasources;
      result.archived.total =
        result.archived.analyses + result.archived.datasets + result.archived.datasources;

      logger.info('Demo cleanup completed', {
        deleted: result.deleted,
        archived: result.archived,
        errors: result.errors.length,
      });
    } catch (error) {
      logger.error('Failed to execute demo cleanup', { error });
      throw error;
    }

    return result;
  }

  /**
   * Find all demo assets by checking datasources for spaceneedle-samplefiles bucket
   * and their related datasets and analyses
   */
  public async findDemoAssets(): Promise<DemoAssets> {
    const result: DemoAssets = {
      datasources: [],
      datasets: [],
      analyses: [],
      totalCount: 0,
    };

    try {
      const cache = await this.ensureCache();
      if (!cache) {
        return result;
      }

      // Find demo assets in order
      const demoDatasourceIds = this.findDemoDatasources(cache, result);
      const demoDatasetIds = this.findDemoDatasets(cache, result, demoDatasourceIds);
      this.findDemoAnalyses(cache, result, demoDatasetIds);

      result.totalCount =
        result.datasources.length + result.datasets.length + result.analyses.length;

      logger.info(`Found ${result.totalCount} demo assets`, {
        datasources: result.datasources.length,
        datasets: result.datasets.length,
        analyses: result.analyses.length,
      });

      return result;
    } catch (error) {
      logger.error('Failed to find demo assets', { error });
      return result;
    }
  }

  /**
   * Check if dataset is a demo dataset
   */
  private checkIfDemoDataset(dataset: any, demoDatasourceIds: Set<string>): boolean {
    const datasourceIds = this.extractDatasourceIds(dataset);
    const usesDemoDatasource = datasourceIds.some((id) => demoDatasourceIds.has(id));

    const fieldNames = (dataset.metadata?.fields || []).map((f: any) => f.fieldName);
    const matchesPattern = DEMO_DATASET_PATTERNS.some((pattern) => {
      const matchingFields = pattern.fields.filter((field) =>
        fieldNames.some((fn: string) => fn.includes(field))
      );
      return matchingFields.length >= DEMO_DETECTION.MIN_MATCHING_FIELDS;
    });

    return usesDemoDatasource || matchesPattern;
  }

  /**
   * Delete and archive analyses
   */
  private async deleteAnalyses(
    analyses: Array<{ id: string; name: string }>,
    result: CleanupResult
  ): Promise<void> {
    for (const analysis of analyses) {
      try {
        await this.quickSightService.deleteAnalysis(analysis.id);
        result.deleted.analyses++;

        await this.archiveService.archiveAsset(
          ASSET_TYPES.analysis,
          analysis.id,
          'Demo asset cleanup',
          'system'
        );
        result.archived.analyses++;
      } catch (error: any) {
        logger.error(`Failed to delete analysis ${analysis.id}`, { error });
        result.errors.push({
          assetType: 'analysis',
          assetId: analysis.id,
          error: error.message,
        });
      }
    }
  }

  /**
   * Delete and archive datasets
   */
  private async deleteDatasets(
    datasets: Array<{ id: string; name: string; datasourceIds: string[] }>,
    result: CleanupResult
  ): Promise<void> {
    for (const dataset of datasets) {
      try {
        await this.quickSightService.deleteDataset(dataset.id);
        result.deleted.datasets++;

        await this.archiveService.archiveAsset(
          ASSET_TYPES.dataset,
          dataset.id,
          'Demo asset cleanup',
          'system'
        );
        result.archived.datasets++;
      } catch (error: any) {
        logger.error(`Failed to delete dataset ${dataset.id}`, { error });
        result.errors.push({
          assetType: 'dataset',
          assetId: dataset.id,
          error: error.message,
        });
      }
    }
  }

  /**
   * Delete and archive datasources
   */
  private async deleteDatasources(
    datasources: Array<{ id: string; name: string; bucket?: string }>,
    result: CleanupResult
  ): Promise<void> {
    for (const datasource of datasources) {
      try {
        await this.quickSightService.deleteDatasource(datasource.id);
        result.deleted.datasources++;

        await this.archiveService.archiveAsset(
          ASSET_TYPES.datasource,
          datasource.id,
          'Demo asset cleanup - spaceneedle-samplefiles',
          'system'
        );
        result.archived.datasources++;
      } catch (error: any) {
        logger.error(`Failed to delete datasource ${datasource.id}`, { error });
        result.errors.push({
          assetType: 'datasource',
          assetId: datasource.id,
          error: error.message,
        });
      }
    }
  }

  /**
   * Ensure cache is available, building if necessary
   */
  private async ensureCache(): Promise<any> {
    let cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });

    if (!cache || !cache.entries || Object.keys(cache.entries).length === 0) {
      logger.warn('No cached data found, building cache first...');
      await cacheService.rebuildCache(false, true);

      cache = await cacheService.getMasterCache({ statusFilter: AssetStatusFilter.ACTIVE });
      if (!cache || !cache.entries || Object.keys(cache.entries).length === 0) {
        logger.error('Failed to build cache, cannot identify demo assets');
        return null;
      }

      logger.info('Cache rebuilt successfully, proceeding with demo asset identification');
    }

    return cache;
  }

  /**
   * Extract datasource IDs from dataset
   */
  private extractDatasourceIds(dataset: any): string[] {
    const datasourceArns = dataset.metadata?.datasourceArns || [];
    return datasourceArns
      .map((arn: string) => {
        const parts = arn.split('/');
        return parts[parts.length - 1];
      })
      .filter((id: string | undefined): id is string => id !== undefined);
  }

  /**
   * Find demo analyses
   */
  private findDemoAnalyses(cache: any, result: DemoAssets, _demoDatasetIds: Set<string>): void {
    const analyses = cache.entries[ASSET_TYPES.analysis] || [];
    const demoAnalysisNames = [
      'People Overview analysis',
      'Business Review analysis',
      'Sales Pipeline analysis',
      'Web and Social Media Analytics analysis',
    ];

    logger.info(`Checking ${analyses.length} analyses for demo assets`);

    for (const analysis of analyses) {
      if (this.isDemoAnalysis(analysis, demoAnalysisNames)) {
        result.analyses.push({
          id: analysis.assetId,
          name: analysis.assetName,
        });

        logger.info(`Identified demo analysis: ${analysis.assetName}`, {
          assetId: analysis.assetId,
          sheetCount: analysis.metadata?.sheetCount,
          visualCount: analysis.metadata?.visualCount,
        });
      }
    }
  }

  /**
   * Find demo datasets
   */
  private findDemoDatasets(
    cache: any,
    result: DemoAssets,
    demoDatasourceIds: Set<string>
  ): Set<string> {
    const demoDatasetIds = new Set<string>();
    const datasets = cache.entries[ASSET_TYPES.dataset] || [];

    logger.info(`Checking ${datasets.length} datasets for demo assets`);

    for (const dataset of datasets) {
      const isDemoDataset = this.checkIfDemoDataset(dataset, demoDatasourceIds);

      if (isDemoDataset) {
        const datasourceIds = this.extractDatasourceIds(dataset);
        result.datasets.push({
          id: dataset.assetId,
          name: dataset.assetName,
          datasourceIds,
        });
        demoDatasetIds.add(dataset.assetId);
        logger.info(`Found demo dataset: ${dataset.assetName}`);
      }
    }

    return demoDatasetIds;
  }

  /**
   * Find demo datasources
   */
  private findDemoDatasources(cache: any, result: DemoAssets): Set<string> {
    const demoDatasourceIds = new Set<string>();
    const datasources = cache.entries[ASSET_TYPES.datasource] || [];

    logger.info(`Checking ${datasources.length} datasources for demo assets`);

    for (const ds of datasources) {
      const metadata = ds.metadata;
      const bucket = metadata?.bucket;

      if (this.isDemoDatasource(bucket)) {
        result.datasources.push({
          id: ds.assetId,
          name: ds.assetName,
          bucket,
        });
        demoDatasourceIds.add(ds.assetId);
        logger.info(`Found demo datasource: ${ds.assetName}`, { bucket });
      }
    }

    return demoDatasourceIds;
  }

  /**
   * Check if analysis is a demo analysis
   */
  private isDemoAnalysis(analysis: any, demoAnalysisNames: string[]): boolean {
    // Primary check: exact name match
    const hasExactName = demoAnalysisNames.includes(analysis.assetName);
    if (!hasExactName) {
      return false;
    }

    // Secondary verification: check metadata patterns
    const metadata = analysis.metadata;
    const hasValidStructure =
      metadata?.sheetCount === 1 &&
      metadata?.sheets?.[0]?.name === 'Sheet 1' &&
      (metadata?.sheets?.[0]?.visualCount || 0) >= DEMO_DETECTION.MIN_VISUAL_COUNT;

    // Tertiary verification: check for demo-specific visual titles
    const demoVisualTitlePatterns = [
      'Employees by Region',
      'Hiring by Region',
      'Gender diversity',
      'Historical  opportunity pipeline',
      'Revenues vs Goals',
      'Website pageviews and visits',
    ];

    const visualTitles =
      metadata?.sheets?.[0]?.visuals?.map((v: any) => v.title).filter(Boolean) || [];
    const hasDemoVisuals = visualTitles.some((title: string) =>
      demoVisualTitlePatterns.some((pattern) => title?.includes(pattern))
    );

    // Only mark as demo if it passes name match AND at least one other verification
    return hasExactName && (hasValidStructure || hasDemoVisuals);
  }

  /**
   * Check if datasource is a demo datasource
   */
  private isDemoDatasource(bucket: string | undefined): boolean {
    return !!(
      bucket &&
      (bucket.includes('spaceneedle-samplefiles') || bucket.includes('spaceneedle'))
    );
  }

  /**
   * Log found demo assets
   */
  private logFoundAssets(demoAssets: DemoAssets): void {
    logger.info(`Found ${demoAssets.totalCount} demo assets to clean up`, {
      datasources: demoAssets.datasources.length,
      datasets: demoAssets.datasets.length,
      analyses: demoAssets.analyses.length,
    });
  }
}
