import pLimit from 'p-limit';

import { EXPORT_CONFIG } from '../../config/exportConfig';
import { FIELD_LIMITS } from '../../constants';
import { type AssetType, type CacheEntry } from '../../models/asset.model';
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { ASSET_TYPES } from '../../types/assetTypes';
import { findMatchingFlatFileDatasource } from '../../utils/flatFileDatasetMatcher';
import { logger } from '../../utils/logger';
import { S3Service } from '../aws/S3Service';
import { type CacheService } from '../cache/CacheService';

export interface LineageRelationship {
  sourceAssetId: string;
  sourceAssetType: AssetType;
  sourceAssetName: string;
  sourceIsArchived?: boolean;
  targetAssetId: string;
  targetAssetType: AssetType;
  targetAssetName: string;
  targetIsArchived?: boolean;
  relationshipType: 'uses' | 'used_by';
}

export interface AssetLineage {
  assetId: string;
  assetType: AssetType;
  assetName: string;
  isArchived?: boolean;
  relationships: LineageRelationship[];
  metadata?: {
    datasourceType?: string; // 'S3', 'ATHENA', 'FILE', 'REDSHIFT', 'RDS', 'SNOWFLAKE', etc.
  };
}

// New enhanced field-level lineage interfaces
export interface FieldLineageNode {
  id: string;
  name: string;
  type: 'asset' | 'field';
  assetType?: AssetType;
  assetId?: string; // For fields, the containing asset
  fieldType?: string; // For fields, the data type
  metadata?: Record<string, any>;
}

export interface FieldLineageRelationship {
  sourceNode: FieldLineageNode;
  targetNode: FieldLineageNode;
  relationshipType: 'uses' | 'used_by' | 'derives_from' | 'transforms_to';
  strength?: number; // Relationship strength (0-1)
  metadata?: {
    transformationLogic?: string;
    calculatedFieldExpression?: string;
    joinCondition?: string;
  };
}

export interface EnhancedAssetLineage extends AssetLineage {
  fieldLineage?: FieldLineage[]; // Field-level dependencies
}

export interface FieldLineage {
  fieldNode: FieldLineageNode;
  relationships: FieldLineageRelationship[];
  calculatedFieldDependencies?: string[]; // Fields this calculated field depends on
  usedInVisuals?: boolean;
  usedInCalculatedFields?: boolean;
}

// Create singleton S3 service
const accountId = process.env.AWS_ACCOUNT_ID || '';
const s3Service = new S3Service(accountId);

// Interface for asset information during lineage processing
interface AssetInfo {
  id: string;
  name: string;
  type: AssetType;
  exportFilePath: string;
  isArchived?: boolean;
}

export class LineageService {
  private readonly bucketName: string;
  private readonly CACHE_TTL_MS = FIELD_LIMITS.CACHE_TTL_MS;
  private cacheExpiry: Date | null = null;
  private cacheService: CacheService | null = null;
  private lineageCache: Map<string, AssetLineage> | null = null;
  private readonly s3Service: S3Service;

  constructor(cacheServiceInstance?: CacheService) {
    this.s3Service = s3Service; // Use singleton
    const bucketName = process.env.BUCKET_NAME;
    if (!bucketName) {
      throw new Error('BUCKET_NAME environment variable is not set');
    }
    this.bucketName = bucketName;
    this.cacheService = cacheServiceInstance || null;
  }

  public async getAllLineage(): Promise<AssetLineage[]> {
    try {
      // Check if we have a valid cached lineage
      if (this.lineageCache && this.cacheExpiry && new Date() < this.cacheExpiry) {
        return Array.from(this.lineageCache.values());
      }

      // Try to load lineage from S3 cache first
      const cachedLineage = await this.loadLineageFromCache();
      if (cachedLineage) {
        logger.info('Loaded lineage from S3 cache');
        this.lineageCache = cachedLineage;
        this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);
        return Array.from(cachedLineage.values());
      }

      // If no cache exists, build lineage map from asset files
      logger.info('Building lineage from asset files (no cache found)');
      const lineageMap = await this.buildLineageMap();

      // Save to cache for next time
      await this.saveLineageToCache(lineageMap);

      // Update in-memory cache
      this.lineageCache = lineageMap;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);

      // Convert map to array
      return Array.from(lineageMap.values());
    } catch (error) {
      logger.error('Error getting lineage:', error);
      return [];
    }
  }

  public async getAssetLineage(assetId: string): Promise<AssetLineage | null> {
    try {
      const allLineage = await this.getAllLineage();
      return allLineage.find((lineage) => lineage.assetId === assetId) || null;
    } catch (error) {
      logger.error(`Error getting lineage for asset ${assetId}:`, error);
      return null;
    }
  }

  public async getLineageMapForAssets(
    assetType: string,
    assetIds: string[]
  ): Promise<Map<string, AssetLineage>> {
    try {
      const allLineage = await this.getAllLineage();
      const lineageMap = new Map<string, AssetLineage>();

      for (const assetId of assetIds) {
        // Return map with composite key for AssetService compatibility
        const key = `${assetType}:${assetId}`;
        let assetLineage;

        if (assetType === ASSET_TYPES.datasource) {
          // For datasources, match by assetType === 'datasource'
          assetLineage = allLineage.find(
            (l) => l.assetId === assetId && l.assetType === ASSET_TYPES.datasource
          );
        } else {
          assetLineage = allLineage.find((l) => l.assetId === assetId && l.assetType === assetType);
        }

        if (assetLineage) {
          lineageMap.set(key, assetLineage);
        }
      }

      return lineageMap;
    } catch (error) {
      logger.error(`Error getting lineage map for assets:`, error);
      return new Map();
    }
  }

  public async invalidateCache(): Promise<void> {
    this.lineageCache = null;
    this.cacheExpiry = null;
    logger.info('Lineage cache invalidated');
    return await Promise.resolve();
  }

  public async rebuildLineage(): Promise<AssetLineage[]> {
    try {
      // Invalidate cache to force rebuild
      await this.invalidateCache();

      // Build fresh lineage map
      const lineageMap = await this.buildLineageMap();

      // Save to cache
      await this.saveLineageToCache(lineageMap);

      // Update in-memory cache
      this.lineageCache = lineageMap;
      this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);

      logger.info('Rebuilt lineage cache');
      return Array.from(lineageMap.values());
    } catch (error) {
      logger.error('Error rebuilding lineage:', error);
      return [];
    }
  }

  private async buildLineageMap(): Promise<Map<string, AssetLineage>> {
    const lineageMap = new Map<string, AssetLineage>();

    try {
      const cacheServiceInstance = await this.getCacheService();

      // Collect all assets for lineage processing
      const allAssets = await this.collectAssetsForLineage(cacheServiceInstance);
      logger.info(`Building lineage for ${allAssets.length} assets`);

      // Initialize lineage entries
      await this.initializeLineageEntries(allAssets, lineageMap, cacheServiceInstance);

      // Process relationships for each asset
      const processedCount = await this.processAssetRelationships(
        allAssets,
        lineageMap,
        cacheServiceInstance
      );

      logger.info(`Processed lineage for ${processedCount}/${allAssets.length} assets`);

      // Log summary and build transitive dependencies
      this.logLineageSummary(lineageMap);
      this.buildTransitiveDependencies(lineageMap);

      return lineageMap;
    } catch (error) {
      logger.error('Error building lineage map:', error);
      throw error;
    }
  }

  private buildTransitiveDependencies(lineageMap: Map<string, AssetLineage>): void {
    // Build transitive dependencies in both directions

    // 1. For each datasource, find all transitive dependencies (analyses and dashboards)
    lineageMap.forEach((lineage) => {
      if (lineage.assetType === ASSET_TYPES.datasource) {
        const transitiveRelationships: LineageRelationship[] = [];

        // Find datasets that use this datasource
        const directDatasets = lineage.relationships
          .filter(
            (rel) =>
              rel.relationshipType === 'used_by' && rel.targetAssetType === ASSET_TYPES.dataset
          )
          .map((rel) => rel.targetAssetId);

        // For each dataset, find what uses it (analyses and dashboards)
        directDatasets.forEach((datasetId) => {
          const datasetLineage = lineageMap.get(datasetId);
          if (datasetLineage) {
            datasetLineage.relationships
              .filter(
                (rel) =>
                  rel.relationshipType === 'used_by' &&
                  (rel.targetAssetType === ASSET_TYPES.analysis ||
                    rel.targetAssetType === ASSET_TYPES.dashboard)
              )
              .forEach((rel) => {
                // Add transitive relationship
                transitiveRelationships.push({
                  sourceAssetId: lineage.assetId,
                  sourceAssetType: ASSET_TYPES.datasource,
                  sourceAssetName: lineage.assetName,
                  sourceIsArchived: lineage.isArchived,
                  targetAssetId: rel.targetAssetId,
                  targetAssetType: rel.targetAssetType,
                  targetAssetName: rel.targetAssetName,
                  targetIsArchived: rel.targetIsArchived,
                  relationshipType: 'used_by',
                });
              });
          }
        });

        // Add transitive relationships to datasource (deduplicate)
        transitiveRelationships.forEach((newRel) => {
          const exists = lineage.relationships.some(
            (existingRel) =>
              existingRel.targetAssetId === newRel.targetAssetId &&
              existingRel.targetAssetType === newRel.targetAssetType &&
              existingRel.relationshipType === newRel.relationshipType
          );
          if (!exists) {
            lineage.relationships.push(newRel);
          }
        });
      }
    });

    // 2. For each dashboard and analysis, find datasources they indirectly use through datasets
    lineageMap.forEach((lineage) => {
      if (
        lineage.assetType === ASSET_TYPES.dashboard ||
        lineage.assetType === ASSET_TYPES.analysis
      ) {
        const transitiveRelationships: LineageRelationship[] = [];

        // Find datasets that this asset uses
        const usedDatasets = lineage.relationships
          .filter(
            (rel) => rel.relationshipType === 'uses' && rel.targetAssetType === ASSET_TYPES.dataset
          )
          .map((rel) => rel.targetAssetId);

        // For each dataset, find what datasources it uses
        usedDatasets.forEach((datasetId) => {
          const datasetLineage = lineageMap.get(datasetId);
          if (datasetLineage) {
            datasetLineage.relationships
              .filter(
                (rel) =>
                  rel.relationshipType === 'uses' && rel.targetAssetType === ASSET_TYPES.datasource
              )
              .forEach((rel) => {
                // Add transitive relationship
                transitiveRelationships.push({
                  sourceAssetId: lineage.assetId,
                  sourceAssetType: lineage.assetType,
                  sourceAssetName: lineage.assetName,
                  sourceIsArchived: lineage.isArchived,
                  targetAssetId: rel.targetAssetId,
                  targetAssetType: rel.targetAssetType,
                  targetAssetName: rel.targetAssetName,
                  targetIsArchived: rel.targetIsArchived,
                  relationshipType: 'uses',
                });
              });
          }
        });

        // Add transitive relationships to dashboard/analysis (deduplicate)
        transitiveRelationships.forEach((newRel) => {
          const exists = lineage.relationships.some(
            (existingRel) =>
              existingRel.targetAssetId === newRel.targetAssetId &&
              existingRel.targetAssetType === newRel.targetAssetType &&
              existingRel.relationshipType === newRel.relationshipType
          );
          if (!exists) {
            lineage.relationships.push(newRel);
          }
        });
      }
    });
  }

  /**
   * Collect all assets from cache for lineage processing
   */
  private async collectAssetsForLineage(cacheServiceInstance: CacheService): Promise<AssetInfo[]> {
    const allAssets: AssetInfo[] = [];
    const lineageAssetTypes = [
      ASSET_TYPES.dashboard,
      ASSET_TYPES.analysis,
      ASSET_TYPES.dataset,
      ASSET_TYPES.datasource,
    ];

    for (const assetType of lineageAssetTypes) {
      const assets = await cacheServiceInstance.getCacheEntries({
        assetType,
        statusFilter: AssetStatusFilter.ALL,
      });

      for (const asset of assets) {
        if (!asset.exportFilePath) {
          logger.warn(`Asset ${asset.assetId} of type ${assetType} is missing exportFilePath`, {
            assetId: asset.assetId,
            assetType,
            hasExportFilePath: !!asset.exportFilePath,
          });
          continue;
        }

        allAssets.push({
          id: asset.assetId,
          name: asset.assetName,
          type: assetType,
          exportFilePath: asset.exportFilePath,
          isArchived: asset.status === 'archived',
        });
      }
    }

    return allAssets;
  }

  /**
   * Create a lineage entry for an asset
   */
  private async createLineageEntry(
    asset: any,
    cacheServiceInstance: CacheService
  ): Promise<AssetLineage> {
    const assetType = String(asset.type);
    const lineageEntry: AssetLineage = {
      assetId: asset.id,
      assetType: assetType as AssetType,
      assetName: asset.name,
      isArchived: asset.isArchived,
      relationships: [],
    };

    // For datasources, get the specific type from cache metadata
    if (asset.type === ASSET_TYPES.datasource) {
      const cacheEntry = await cacheServiceInstance.getAsset(ASSET_TYPES.datasource, asset.id);
      if (cacheEntry?.metadata?.sourceType) {
        lineageEntry.metadata = {
          datasourceType: cacheEntry.metadata.sourceType,
        };
      }
    }

    return lineageEntry;
  }

  private async getCacheService(): Promise<CacheService> {
    if (!this.cacheService) {
      // Lazy load to avoid circular dependency
      // eslint-disable-next-line import/no-cycle
      const { cacheService } = await import('../cache/CacheService');
      this.cacheService = cacheService;
    }
    return this.cacheService;
  }

  /**
   * Initialize lineage entries for all assets
   */
  private async initializeLineageEntries(
    allAssets: any[],
    lineageMap: Map<string, AssetLineage>,
    cacheServiceInstance: CacheService
  ): Promise<void> {
    for (const asset of allAssets) {
      const lineageEntry = await this.createLineageEntry(asset, cacheServiceInstance);
      lineageMap.set(asset.id, lineageEntry);
    }
  }

  private async loadLineageFromCache(): Promise<Map<string, AssetLineage> | null> {
    try {
      const cacheKey = 'cache/lineage-cache.json';
      const cachedData = await this.s3Service.getObject(this.bucketName, cacheKey);

      if (cachedData && cachedData.lineageMap) {
        // Convert array back to map with proper keys
        const lineageMap = new Map<string, AssetLineage>();
        for (const lineage of cachedData.lineageMap) {
          const key = `${lineage.assetType}:${lineage.assetId}`;
          lineageMap.set(key, lineage);
        }
        return lineageMap;
      }
    } catch {
      logger.debug('No lineage cache found in S3');
    }
    return null;
  }

  /**
   * Log summary of lineage relationships
   */
  private logLineageSummary(lineageMap: Map<string, AssetLineage>): void {
    let totalRelationships = 0;
    lineageMap.forEach((lineage) => {
      totalRelationships += lineage.relationships.length;
    });
    logger.info(`Found ${totalRelationships} total relationships`);
  }

  private async processAnalysisLineageFromCache(
    analysis: { id: string; name: string; type: AssetType; exportFilePath: string },
    cacheEntry: CacheEntry,
    lineageMap: Map<string, AssetLineage>
  ): Promise<void> {
    const analysisLineage = lineageMap.get(analysis.id);
    if (!analysisLineage) {
      return await Promise.resolve();
    }

    const lineageData = cacheEntry.metadata?.lineageData;
    if (!lineageData) {
      logger.debug(`No lineage data in cache for analysis ${analysis.id}`);
      return await Promise.resolve();
    }

    // Extract dataset usage from cached lineage data
    if (lineageData.datasetIds && lineageData.datasetIds.length > 0) {
      for (const datasetId of lineageData.datasetIds) {
        const datasetLineage = lineageMap.get(datasetId);

        if (datasetLineage) {
          // Analysis uses dataset
          analysisLineage.relationships.push({
            sourceAssetId: analysis.id,
            sourceAssetType: ASSET_TYPES.analysis,
            sourceAssetName: analysis.name,
            sourceIsArchived: analysisLineage.isArchived,
            targetAssetId: datasetId,
            targetAssetType: ASSET_TYPES.dataset,
            targetAssetName: datasetLineage.assetName,
            targetIsArchived: datasetLineage.isArchived,
            relationshipType: 'uses',
          });

          // Dataset used by analysis
          datasetLineage.relationships.push({
            sourceAssetId: datasetId,
            sourceAssetType: ASSET_TYPES.dataset,
            sourceAssetName: datasetLineage.assetName,
            sourceIsArchived: datasetLineage.isArchived,
            targetAssetId: analysis.id,
            targetAssetType: ASSET_TYPES.analysis,
            targetAssetName: analysis.name,
            targetIsArchived: analysisLineage.isArchived,
            relationshipType: 'used_by',
          });
        } else {
          logger.warn(`Dataset ${datasetId} not found in lineage map for analysis ${analysis.id}`);
        }
      }
    }
  }

  /**
   * Process lineage for a single asset based on its type
   */
  private async processAssetLineage(
    asset: any,
    cacheEntry: CacheEntry,
    lineageMap: Map<string, AssetLineage>
  ): Promise<void> {
    if (asset.type === ASSET_TYPES.dashboard) {
      await this.processDashboardLineageFromCache(asset, cacheEntry, lineageMap);
    } else if (asset.type === ASSET_TYPES.analysis) {
      await this.processAnalysisLineageFromCache(asset, cacheEntry, lineageMap);
    } else if (asset.type === ASSET_TYPES.dataset) {
      await this.processDatasetLineageFromCache(asset, cacheEntry, lineageMap);
    }
  }

  /**
   * Process relationships for all assets
   */
  private async processAssetRelationships(
    allAssets: any[],
    lineageMap: Map<string, AssetLineage>,
    cacheServiceInstance: CacheService
  ): Promise<number> {
    const limit = pLimit(EXPORT_CONFIG.concurrency.operations);
    let processedCount = 0;

    const processPromises = allAssets.map((asset) =>
      limit(async () => {
        try {
          const cacheEntry = await cacheServiceInstance.getAsset(asset.type as AssetType, asset.id);

          if (!cacheEntry) {
            logger.warn(`No cache entry found for ${asset.type} ${asset.id}`);
            return;
          }

          await this.processAssetLineage(asset, cacheEntry, lineageMap);
          processedCount++;
        } catch (error: any) {
          logger.warn(`Failed to process lineage for ${asset.type} ${asset.id}:`, error);
        }
      })
    );

    await Promise.all(processPromises);
    return processedCount;
  }

  private async processDashboardLineageFromCache(
    dashboard: { id: string; name: string; type: AssetType; exportFilePath: string },
    cacheEntry: CacheEntry,
    lineageMap: Map<string, AssetLineage>
  ): Promise<void> {
    const dashboardLineage = lineageMap.get(dashboard.id);
    if (!dashboardLineage) {
      return await Promise.resolve();
    }

    const lineageData = cacheEntry.metadata?.lineageData;
    if (!lineageData) {
      logger.debug(`No lineage data in cache for dashboard ${dashboard.id}`);
      return await Promise.resolve();
    }

    // Extract source analysis from cached lineage data
    const sourceAnalysisId = lineageData.sourceAnalysisArn?.split('/').pop();
    if (sourceAnalysisId) {
      const analysisLineage = lineageMap.get(sourceAnalysisId);
      if (analysisLineage) {
        // Dashboard uses analysis
        dashboardLineage.relationships.push({
          sourceAssetId: dashboard.id,
          sourceAssetType: ASSET_TYPES.dashboard,
          sourceAssetName: dashboard.name,
          sourceIsArchived: dashboardLineage.isArchived,
          targetAssetId: sourceAnalysisId,
          targetAssetType: ASSET_TYPES.analysis,
          targetAssetName: analysisLineage.assetName,
          targetIsArchived: analysisLineage.isArchived,
          relationshipType: 'uses',
        });

        // Analysis used by dashboard
        analysisLineage.relationships.push({
          sourceAssetId: sourceAnalysisId,
          sourceAssetType: ASSET_TYPES.analysis,
          sourceAssetName: analysisLineage.assetName,
          sourceIsArchived: analysisLineage.isArchived,
          targetAssetId: dashboard.id,
          targetAssetType: ASSET_TYPES.dashboard,
          targetAssetName: dashboard.name,
          targetIsArchived: dashboardLineage.isArchived,
          relationshipType: 'used_by',
        });
      } else {
        logger.warn(
          `Analysis ${sourceAnalysisId} not found in lineage map for dashboard ${dashboard.id}`
        );
      }
    }

    // Extract dataset usage from cached lineage data
    if (lineageData.datasetIds && lineageData.datasetIds.length > 0) {
      for (const datasetId of lineageData.datasetIds) {
        const datasetLineage = lineageMap.get(datasetId);

        if (datasetLineage) {
          // Dashboard uses dataset
          dashboardLineage.relationships.push({
            sourceAssetId: dashboard.id,
            sourceAssetType: ASSET_TYPES.dashboard,
            sourceAssetName: dashboard.name,
            sourceIsArchived: dashboardLineage.isArchived,
            targetAssetId: datasetId,
            targetAssetType: ASSET_TYPES.dataset,
            targetAssetName: datasetLineage.assetName,
            targetIsArchived: datasetLineage.isArchived,
            relationshipType: 'uses',
          });

          // Dataset used by dashboard
          datasetLineage.relationships.push({
            sourceAssetId: datasetId,
            sourceAssetType: ASSET_TYPES.dataset,
            sourceAssetName: datasetLineage.assetName,
            sourceIsArchived: datasetLineage.isArchived,
            targetAssetId: dashboard.id,
            targetAssetType: ASSET_TYPES.dashboard,
            targetAssetName: dashboard.name,
            targetIsArchived: dashboardLineage.isArchived,
            relationshipType: 'used_by',
          });
        } else {
          logger.warn(
            `Dataset ${datasetId} not found in lineage map for dashboard ${dashboard.id}`
          );
        }
      }
    }
  }

  private async processDatasetLineageFromCache(
    dataset: { id: string; name: string; type: AssetType; exportFilePath: string },
    cacheEntry: CacheEntry,
    lineageMap: Map<string, AssetLineage>
  ): Promise<void> {
    const datasetLineage = lineageMap.get(dataset.id);
    if (!datasetLineage) {
      return;
    }

    const lineageData = cacheEntry.metadata?.lineageData;

    // Process child dataset relationships (for composite datasets)
    if (lineageData && lineageData.datasetIds && lineageData.datasetIds.length > 0) {
      for (const childDatasetId of lineageData.datasetIds) {
        const childDatasetLineage = lineageMap.get(childDatasetId);
        if (childDatasetLineage) {
          // Parent dataset uses child dataset
          datasetLineage.relationships.push({
            sourceAssetId: dataset.id,
            sourceAssetType: ASSET_TYPES.dataset,
            sourceAssetName: dataset.name,
            sourceIsArchived: datasetLineage.isArchived,
            targetAssetId: childDatasetId,
            targetAssetType: ASSET_TYPES.dataset,
            targetAssetName: childDatasetLineage.assetName,
            targetIsArchived: childDatasetLineage.isArchived,
            relationshipType: 'uses',
          });

          // Child dataset used by parent dataset
          childDatasetLineage.relationships.push({
            sourceAssetId: childDatasetId,
            sourceAssetType: ASSET_TYPES.dataset,
            sourceAssetName: childDatasetLineage.assetName,
            sourceIsArchived: childDatasetLineage.isArchived,
            targetAssetId: dataset.id,
            targetAssetType: ASSET_TYPES.dataset,
            targetAssetName: dataset.name,
            targetIsArchived: datasetLineage.isArchived,
            relationshipType: 'used_by',
          });
        } else {
          logger.warn(
            `Child dataset ${childDatasetId} not found in lineage map for composite dataset ${dataset.id}`
          );
        }
      }
    }

    // Process datasource relationships
    if (lineageData && lineageData.datasourceIds && lineageData.datasourceIds.length > 0) {
      // Extract datasource usage from cached lineage data
      for (const datasourceId of lineageData.datasourceIds) {
        const datasourceLineage = lineageMap.get(datasourceId);
        if (datasourceLineage) {
          // Dataset uses datasource
          datasetLineage.relationships.push({
            sourceAssetId: dataset.id,
            sourceAssetType: ASSET_TYPES.dataset,
            sourceAssetName: dataset.name,
            sourceIsArchived: datasetLineage.isArchived,
            targetAssetId: datasourceId,
            targetAssetType: ASSET_TYPES.datasource,
            targetAssetName: datasourceLineage.assetName,
            targetIsArchived: datasourceLineage.isArchived,
            relationshipType: 'uses',
          });

          // Datasource used by dataset
          datasourceLineage.relationships.push({
            sourceAssetId: datasourceId,
            sourceAssetType: ASSET_TYPES.datasource,
            sourceAssetName: datasourceLineage.assetName,
            sourceIsArchived: datasourceLineage.isArchived,
            targetAssetId: dataset.id,
            targetAssetType: ASSET_TYPES.dataset,
            targetAssetName: dataset.name,
            targetIsArchived: datasetLineage.isArchived,
            relationshipType: 'used_by',
          });
        }
      }
    } else if (!lineageData || (!lineageData.datasourceIds && !lineageData.datasetIds)) {
      // No cached lineage data - likely an uploaded file dataset
      // Use fuzzy matching with cache data
      const datasetCreatedTime = cacheEntry.createdTime;

      // Get all datasources from cache
      const cacheServiceInst = await this.getCacheService();
      const datasourceEntries = await cacheServiceInst.getCacheEntries({
        assetType: ASSET_TYPES.datasource,
        statusFilter: AssetStatusFilter.ALL,
      });

      const matchResult = findMatchingFlatFileDatasource({
        datasetName: dataset.name,
        datasetCreatedTime,
        datasetUpdatedTime: cacheEntry.lastUpdatedTime,
        datasources: datasourceEntries.map((ds: any) => ({
          id: ds.assetId,
          name: ds.assetName,
          type: ds.metadata?.sourceType || 'UNKNOWN',
          createdTime: ds.createdTime,
        })),
      });

      if (matchResult) {
        const datasourceId = matchResult.datasourceId;
        const datasourceLineage = lineageMap.get(datasourceId);

        if (datasourceLineage) {
          // Dataset uses datasource
          datasetLineage.relationships.push({
            sourceAssetId: dataset.id,
            sourceAssetType: ASSET_TYPES.dataset,
            sourceAssetName: dataset.name,
            sourceIsArchived: datasetLineage.isArchived,
            targetAssetId: datasourceId,
            targetAssetType: ASSET_TYPES.datasource,
            targetAssetName: datasourceLineage.assetName,
            targetIsArchived: datasourceLineage.isArchived,
            relationshipType: 'uses',
          });

          // Datasource used by dataset
          datasourceLineage.relationships.push({
            sourceAssetId: datasourceId,
            sourceAssetType: ASSET_TYPES.datasource,
            sourceAssetName: datasourceLineage.assetName,
            sourceIsArchived: datasourceLineage.isArchived,
            targetAssetId: dataset.id,
            targetAssetType: ASSET_TYPES.dataset,
            targetAssetName: dataset.name,
            targetIsArchived: datasetLineage.isArchived,
            relationshipType: 'used_by',
          });
        }
      }
    }
  }

  private async saveLineageToCache(lineageMap: Map<string, AssetLineage>): Promise<void> {
    try {
      const cacheData = {
        lastUpdated: new Date().toISOString(),
        assetCount: lineageMap.size,
        relationshipCount: Array.from(lineageMap.values()).reduce(
          (sum, l) => sum + l.relationships.length,
          0
        ),
        lineageMap: Array.from(lineageMap.values()),
      };

      const cacheKey = 'cache/lineage-cache.json';
      await this.s3Service.putObject(this.bucketName, cacheKey, cacheData);
      logger.info(`Saved lineage cache with ${lineageMap.size} assets`);
    } catch (error) {
      logger.error('Failed to save lineage cache:', error);
    }
  }
}
