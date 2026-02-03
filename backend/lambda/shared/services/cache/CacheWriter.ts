/**
 * CacheWriter - VSA View Layer for Cache Write Operations
 */
import pLimit from 'p-limit';

import { type MemoryCacheAdapter } from './adapters/MemoryCacheAdapter';
import { type S3CacheAdapter } from './adapters/S3CacheAdapter';
import { CacheReader } from './CacheReader';
import { type FieldInfo } from './types';
import { EXPORT_CONFIG } from '../../config/exportConfig';
import { TIME_UNITS } from '../../constants';
import * as mappers from '../../mappers/quicksight.mapper';
import { type CacheEntry, type MasterCache, type AssetType } from '../../models/asset.model';
import { getAssetName } from '../../models/quicksight-domain.model';
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import {
  ASSET_TYPES,
  ASSET_TYPES_WITH_FIELDS,
  ASSET_TYPES_PLURAL,
  isCollectionType,
} from '../../types/assetTypes';
import { pascalToCamel } from '../../utils/caseConverter';
import { logger } from '../../utils/logger';
import { AssetParserService } from '../parsing/AssetParserService';

export class CacheWriter {
  private readonly assetParser: AssetParserService;
  private readonly cacheReader: CacheReader;

  constructor(
    private readonly s3Adapter: S3CacheAdapter,
    private readonly memoryAdapter: MemoryCacheAdapter,
    private readonly s3Service: any,
    private readonly bucketName: string
  ) {
    this.assetParser = new AssetParserService();
    this.cacheReader = new CacheReader(this.s3Adapter, this.memoryAdapter);
  }

  public async bulkUpdateAssetTags(
    assetType: AssetType,
    assetIds: string[],
    tags: Array<{ key: string; value: string }>
  ): Promise<void> {
    try {
      const updatePromises = assetIds.map((assetId) =>
        this.updateAssetTags(assetType, assetId, tags)
      );

      await Promise.all(updatePromises);
      logger.info(`Bulk updated tags for ${assetIds.length} ${assetType} assets`);
    } catch (error) {
      logger.error(`Failed to bulk update tags for ${assetType}`, { error });
      throw error;
    }
  }

  public async clearAllCaches(): Promise<void> {
    try {
      // Clear S3 caches
      await this.s3Adapter.clearAllCaches();

      // Clear memory cache
      this.memoryAdapter.clear();

      logger.info('Cleared all caches');
    } catch (error) {
      logger.error('Failed to clear all caches', { error });
      throw error;
    }
  }

  public async clearPendingSync(
    assetType: AssetType,
    assetId: string,
    components: string[]
  ): Promise<void> {
    try {
      const entries = await this.cacheReader.getCacheEntries({
        assetType,
        statusFilter: AssetStatusFilter.ALL,
      });
      const asset = entries.find((a: CacheEntry) => a.assetId === assetId);

      if (asset && asset.enrichmentTimestamps) {
        // Mark these components as freshly synced
        for (const component of components) {
          if (
            component === 'definition' ||
            component === 'permissions' ||
            component === 'tags' ||
            component === 'lineage' ||
            component === 'views'
          ) {
            asset.enrichmentTimestamps[component] = new Date();
          }
        }

        await this.saveTypeCache(assetType, entries);
      }
    } catch (error) {
      logger.error(`Failed to clear pending sync for asset ${assetType}/${assetId}`, { error });
      throw error;
    }
  }

  public async markForSync(
    assetType: AssetType,
    assetIds: string[],
    components: string[]
  ): Promise<void> {
    try {
      const updatePromises = assetIds.map(async (assetId) => {
        const updates: Partial<CacheEntry> = {
          enrichedAt: new Date(), // Mark as recently updated but may need re-export
        };

        // Update enrichment timestamps to indicate what needs refresh
        if (!updates.enrichmentTimestamps) {
          updates.enrichmentTimestamps = {};
        }

        // Mark these components as needing refresh by clearing their timestamps
        for (const component of components) {
          if (
            component === 'definition' ||
            component === 'permissions' ||
            component === 'tags' ||
            component === 'lineage' ||
            component === 'views'
          ) {
            delete updates.enrichmentTimestamps[component];
          }
        }

        await this.updateAsset(assetType, assetId, updates);
      });

      await Promise.all(updatePromises);
      logger.debug(
        `Marked ${assetIds.length} ${assetType} assets for sync: ${components.join(', ')}`
      );
    } catch (error) {
      logger.error(`Failed to mark assets for sync`, { error });
      throw error;
    }
  }

  public async rebuildCache(
    forceRefresh = false,
    rebuildLineage = true,
    exportStateService?: any
  ): Promise<void> {
    try {
      logger.info('Starting cache rebuild', { forceRefresh, rebuildLineage });

      if (forceRefresh) {
        // Clear all caches
        await this.clearAllCaches();
      }

      // Rebuild cache from S3 asset files
      logger.info(
        'Building cache from S3 asset files - this may take several minutes for large accounts'
      );
      const startTime = Date.now();
      const newCache = await this.buildCacheFromS3Assets(exportStateService);

      // Resolve folder paths after all folders are loaded
      await this.resolveFolderPaths(newCache);

      // Resolve lineage names (dataset/datasource names) for searchability
      await this.resolveLineageNames(newCache);

      // Save the rebuilt cache
      await this.saveMasterCache(newCache);

      // Only rebuild lineage if requested (default true for backward compatibility)
      if (rebuildLineage) {
        logger.info('Rebuilding lineage cache...');
        // Use dynamic import to avoid circular dependency
        // eslint-disable-next-line import/no-cycle
        const { LineageService } = await import('../lineage/LineageService');
        const lineageService = new LineageService();
        await lineageService.rebuildLineage();
      }

      const duration = Date.now() - startTime;
      logger.info('Cache rebuild completed', {
        duration: `${(duration / TIME_UNITS.SECOND).toFixed(2)}s`,
        totalAssets: Object.values(newCache.assetCounts).reduce(
          (sum: number, count: number) => sum + count,
          0
        ),
        assetsByType: newCache.assetCounts,
        lineageRebuilt: rebuildLineage,
      });
    } catch (error) {
      logger.error('Failed to rebuild cache', { error });
      throw error;
    }
  }

  /**
   * Rebuild cache for a single asset type only
   * Handles both full rebuilds and metadata-only updates (permissions/tags)
   */
  public async rebuildCacheForAssetType(
    assetType: AssetType,
    _exportStateService?: any
  ): Promise<void> {
    try {
      logger.info(`Starting cache rebuild for ${assetType} only`);
      const startTime = Date.now();

      // Load existing cache entries for this asset type first
      // This allows us to preserve data during metadata-only updates
      const existingCache = await this.loadTypeCache(assetType);
      const existingEntriesMap = new Map<string, CacheEntry>();

      if (existingCache && Array.isArray(existingCache)) {
        existingCache.forEach((entry: CacheEntry) => {
          existingEntriesMap.set(entry.assetId, entry);
        });
      }

      // List all active asset files for this type
      const assets = await this.s3Adapter.listAssets(assetType);

      // Also get archived assets
      const archivedAssets = await this.listArchivedAssets(assetType);

      logger.info(
        `Found ${assets.length} active and ${archivedAssets.length} archived ${assetType} assets`
      );

      // Process active assets in batches
      const newEntries: CacheEntry[] = [];
      if (assets.length > 0) {
        const activeEntries = await this.processActiveAssetsWithMerge(
          assetType,
          assets,
          existingEntriesMap
        );
        newEntries.push(...activeEntries);
      }

      // Process archived assets similarly
      if (archivedAssets.length > 0) {
        const archivedEntries = await this.processArchivedAssets(assetType, archivedAssets);
        newEntries.push(...archivedEntries);
      }

      // Resolve folder paths if we're rebuilding folders
      if (assetType === ASSET_TYPES.folder && newEntries.length > 0) {
        await this.resolveFolderPathsForEntries(newEntries);
      }

      // Resolve lineage names for dashboard, analysis, or dataset types
      if (
        (assetType === ASSET_TYPES.dashboard ||
          assetType === ASSET_TYPES.analysis ||
          assetType === ASSET_TYPES.dataset) &&
        newEntries.length > 0
      ) {
        await this.resolveLineageNamesForEntries(newEntries, assetType);
      }

      // Save the type cache
      await this.saveTypeCache(assetType, newEntries);

      // Update metadata
      await this.updateCacheMetadata(assetType, newEntries.length);

      // Clear any cached master cache to force refresh
      this.memoryAdapter.delete('master-cache');

      const duration = Date.now() - startTime;
      logger.info(`Cache rebuild for ${assetType} completed`, {
        duration: `${(duration / TIME_UNITS.SECOND).toFixed(2)}s`,
        assetCount: newEntries.length,
      });
    } catch (error) {
      logger.error(`Failed to rebuild cache for ${assetType}`, { error });
      throw error;
    }
  }

  public async removeAssetFromCache(assetType: AssetType, assetId: string): Promise<boolean> {
    try {
      // Get current master cache
      const masterCache = await this.getMasterCache();

      // Find and remove the asset
      const assets = masterCache.entries[assetType] || [];
      const assetIndex = assets.findIndex((asset: CacheEntry) => asset.assetId === assetId);

      if (assetIndex >= 0) {
        assets.splice(assetIndex, 1);
        masterCache.entries[assetType] = assets;

        // Update counts
        masterCache.assetCounts[assetType] = assets.length;

        // Save the type-specific cache
        await this.s3Adapter.saveTypeCache(assetType, assets);

        // Update metadata
        const metadata = (await this.s3Adapter.getCacheMetadata()) || {
          version: '2.0',
          lastUpdated: new Date(),
          assetCounts: {},
          assetTimestamps: {},
        };
        metadata.assetCounts[assetType] = assets.length;
        metadata.lastUpdated = new Date();
        await this.s3Adapter.saveCacheMetadata(metadata);

        logger.debug(`Removed ${assetType} ${assetId} from cache`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to remove asset from cache: ${assetType}/${assetId}`, { error });
      throw error;
    }
  }

  public async updateAsset(
    assetType: AssetType,
    assetId: string,
    updates: Partial<CacheEntry>
  ): Promise<void> {
    try {
      // Get current master cache
      const masterCache = await this.getMasterCache();

      // Find and update the asset
      const assets = masterCache.entries[assetType] || [];

      // Remove ALL existing entries with this assetId to prevent duplicates
      const existingAssets = assets.filter((asset: CacheEntry) => asset.assetId === assetId);
      const otherAssets = assets.filter((asset: CacheEntry) => asset.assetId !== assetId);

      if (existingAssets.length > 0) {
        // Update existing asset - use the most recent one as base
        const baseAsset = existingAssets.reduce((latest, current) => {
          const latestTime = latest.lastUpdatedTime?.getTime() || 0;
          const currentTime = current.lastUpdatedTime?.getTime() || 0;
          return currentTime > latestTime ? current : latest;
        });

        if (existingAssets.length > 1) {
          logger.info(
            `Removing ${existingAssets.length - 1} duplicate cache entries for ${assetType}/${assetId}`
          );
        }

        // Special handling for enrichmentTimestamps - merge instead of replace
        const updatedAsset = { ...baseAsset, ...updates };

        if (updates.enrichmentTimestamps && baseAsset.enrichmentTimestamps) {
          updatedAsset.enrichmentTimestamps = {
            ...baseAsset.enrichmentTimestamps,
            ...updates.enrichmentTimestamps,
          };
        }

        // Replace the entire assets array with deduplicated version + updated asset
        masterCache.entries[assetType] = [...otherAssets, updatedAsset];
      } else {
        // Add new asset
        const newAsset: CacheEntry = {
          assetId: assetId,
          assetType: assetType,
          assetName: updates.assetName || '',
          arn: updates.arn || '',
          status: updates.status || 'active',
          enrichmentStatus: updates.enrichmentStatus || 'skeleton',
          createdTime: updates.createdTime || new Date(),
          lastUpdatedTime: updates.lastUpdatedTime || new Date(),
          exportedAt: updates.exportedAt || new Date(),
          enrichedAt: updates.enrichedAt,
          enrichmentTimestamps: updates.enrichmentTimestamps,
          exportFilePath:
            updates.exportFilePath ||
            (isCollectionType(assetType)
              ? `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
              : `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`),
          storageType: updates.storageType || 'individual',
          tags: updates.tags || [],
          permissions: updates.permissions || [],
          metadata: updates.metadata || {},
          ...updates,
        };
        masterCache.entries[assetType] = [...otherAssets, newAsset];
      }

      // Update summary counts
      masterCache.assetCounts[assetType] = masterCache.entries[assetType]?.length || 0;
      masterCache.lastUpdated = new Date();

      // Save to adapters
      await this.saveMasterCache(masterCache);
    } catch (error) {
      logger.error(`Failed to update asset ${assetType}/${assetId}`, { error });
      throw error;
    }
  }

  public async updateAssetPermissions(
    assetType: AssetType,
    assetId: string,
    permissions: any[]
  ): Promise<void> {
    try {
      await this.updateAsset(assetType, assetId, {
        permissions,
      });

      logger.debug(`Updated permissions for asset ${assetType}/${assetId}`);
    } catch (error) {
      logger.error(`Failed to update permissions for asset ${assetType}/${assetId}`, { error });
      throw error;
    }
  }

  public async updateAssetTags(
    assetType: AssetType,
    assetId: string,
    tags: Array<{ key: string; value: string }>
  ): Promise<void> {
    try {
      // Update the master cache with enrichment timestamp
      const now = new Date();
      await this.updateAsset(assetType, assetId, {
        tags,
        enrichmentTimestamps: {
          tags: now,
        },
      });

      // Also update the exported JSON file
      const exportFilePath = isCollectionType(assetType)
        ? `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
        : `assets/${ASSET_TYPES_PLURAL[assetType]}/${assetId}.json`;

      try {
        // Get the existing export file
        const exportData = await this.s3Service.getObject(this.bucketName, exportFilePath);

        if (exportData) {
          // Update tags in the export data
          if (exportData.apiResponses && exportData.apiResponses.tags) {
            exportData.apiResponses.tags = {
              timestamp: now.toISOString(),
              data: tags,
            };
          } else if (exportData.apiResponses) {
            // Add tags if they didn't exist
            exportData.apiResponses.tags = {
              timestamp: now.toISOString(),
              data: tags,
            };
          }

          // Update enrichment timestamps in export
          if (!exportData.enrichmentTimestamps) {
            exportData.enrichmentTimestamps = {};
          }
          exportData.enrichmentTimestamps.tags = now.toISOString();

          // Save the updated export file
          await this.s3Service.putObject(this.bucketName, exportFilePath, exportData);
          logger.info(`Updated tags in export file for ${assetType}/${assetId}`);
        } else {
          logger.warn(`Export file not found for ${assetType}/${assetId}, skipping export update`);
        }
      } catch (exportError) {
        logger.error(`Failed to update export file for ${assetType}/${assetId}`, { exportError });
        // Don't throw - we still updated the cache successfully
      }

      logger.debug(`Updated tags for asset ${assetType}/${assetId}`);
    } catch (error) {
      logger.error(`Failed to update tags for asset ${assetType}/${assetId}`, { error });
      throw error;
    }
  }

  public async updateFieldCache(fieldCache: FieldInfo[] | null): Promise<void> {
    try {
      // If null is passed, it means we should rebuild from assets
      if (fieldCache === null) {
        logger.info('Rebuilding field cache from assets');
        const rebuiltFieldCache = await this.buildFieldCacheFromAssets();
        await this.s3Adapter.saveFieldCache(rebuiltFieldCache);
        this.memoryAdapter.delete('field-cache');
        return;
      }

      await this.s3Adapter.saveFieldCache(fieldCache);

      // Clear memory cache to force reload
      this.memoryAdapter.delete('field-cache');
    } catch (error) {
      logger.error('Failed to update field cache', { error });
      throw error;
    }
  }

  /**
   * Update group membership after adding/removing users
   */
  public async updateGroupMembership(
    groupName: string,
    operation: 'add' | 'remove',
    userName: string,
    userArn?: string,
    userEmail?: string
  ): Promise<void> {
    try {
      // Get current group data from cache
      const groupEntries = await this.cacheReader.getCacheEntries({
        assetType: ASSET_TYPES.group as AssetType,
        statusFilter: AssetStatusFilter.ACTIVE,
      });

      const groupEntry = groupEntries.find(
        (g) => g.assetName === groupName || g.assetId === groupName
      );

      if (!groupEntry) {
        logger.warn(`Group ${groupName} not found in cache for membership update`);
        return;
      }

      // Update members list
      const currentMembers = groupEntry.metadata?.members || [];
      const updatedMembers = this.updateMembersList(
        currentMembers,
        operation,
        userName,
        userArn,
        userEmail
      );
      const memberCount = updatedMembers.length;

      // Update the cache entry
      await this.updateAsset(ASSET_TYPES.group as AssetType, groupEntry.assetId, {
        metadata: {
          ...groupEntry.metadata,
          members: updatedMembers,
          memberCount,
        },
        lastUpdatedTime: new Date(),
      });

      // Update the exported JSON file
      await this.updateGroupExportedJson(groupName, updatedMembers, memberCount);

      logger.info(`Updated group ${groupName} membership: ${operation} user ${userName}`);
    } catch (error) {
      logger.error(`Failed to update group membership for ${groupName}`, { error });
      throw error;
    }
  }

  private buildCacheEntry(params: {
    assetType: AssetType;
    assetKey: string;
    status: 'active' | 'archived';
    metadata: any;
    transformedData: any;
    enrichmentTimestamps: any;
    enrichmentStatus: any;
    assetData: any;
  }): CacheEntry {
    const {
      assetType,
      assetKey,
      status,
      metadata,
      transformedData,
      enrichmentTimestamps,
      enrichmentStatus,
      assetData,
    } = params;
    const isCollection = isCollectionType(assetType);
    const pathPrefix = status === 'archived' ? 'archived' : 'assets';

    const domainSummary = transformedData.apiResponses?.list?.data || metadata;
    const assetName = getAssetName(domainSummary);

    return {
      assetId: metadata.assetId || assetKey,
      assetType,
      assetName,
      arn: metadata.arn || '',
      status: status as any,
      lastUpdatedTime: this.getDateValue(metadata.lastUpdatedTime),
      createdTime: this.getDateValue(metadata.createdTime),
      exportedAt: this.getDateValue(assetData.apiResponses?.list?.timestamp),
      enrichmentStatus,
      enrichmentTimestamps,
      tags: transformedData.apiResponses?.tags?.data || [],
      permissions: this.getCacheEntryPermissions(status, transformedData),
      metadata: this.buildEntryMetadata(metadata, enrichmentStatus, assetData, status),
      exportFilePath: this.buildExportFilePath(isCollection, pathPrefix, assetType, assetKey),
      storageType: isCollection ? 'collection' : 'individual',
    };
  }

  private async buildCacheFromS3Assets(exportStateService?: any): Promise<MasterCache> {
    const newCache = this.getEmptyMasterCache();
    const assetTypes: AssetType[] = [
      ASSET_TYPES.dashboard,
      ASSET_TYPES.dataset,
      ASSET_TYPES.analysis,
      ASSET_TYPES.datasource,
      ASSET_TYPES.folder,
      ASSET_TYPES.user,
      ASSET_TYPES.group,
    ];

    for (const assetType of assetTypes) {
      try {
        const startTime = Date.now();

        if (isCollectionType(assetType)) {
          await this.processCollectionAssetType(assetType, newCache, exportStateService);
        } else {
          await this.processIndividualAssetType(assetType, newCache, exportStateService);
        }

        const duration = Date.now() - startTime;
        await this.logAssetTypeCompletion(assetType, newCache, duration, exportStateService);
      } catch (error) {
        logger.warn(`Failed to process asset type ${assetType}:`, error);
      }
    }

    // Update summary counts
    for (const assetType of assetTypes) {
      newCache.assetCounts[assetType] = newCache.entries[assetType].length;
    }

    return newCache;
  }

  /**
   * Build entry metadata
   */
  private buildEntryMetadata(
    metadata: any,
    enrichmentStatus: any,
    assetData: any,
    status: 'active' | 'archived'
  ): any {
    return {
      ...metadata,
      enrichmentStatus,
      exportTime: assetData.apiResponses?.list?.timestamp,
      ...(status === 'archived' && assetData.archivedMetadata
        ? { archived: assetData.archivedMetadata }
        : {}),
    };
  }

  /**
   * Build export file path
   */
  private buildExportFilePath(
    isCollection: boolean,
    pathPrefix: string,
    assetType: AssetType,
    assetKey: string
  ): string {
    return isCollection
      ? `${pathPrefix}/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
      : `${pathPrefix}/${ASSET_TYPES_PLURAL[assetType]}/${assetKey}.json`;
  }

  /**
   * Build field cache from all assets in the master cache
   */
  private async buildFieldCacheFromAssets(): Promise<FieldInfo[]> {
    const fieldMap = new Map<string, FieldInfo>();

    try {
      logger.info('Starting field cache build from type caches');

      // Process assets that have field data - only active assets
      for (const assetType of ASSET_TYPES_WITH_FIELDS) {
        const activeAssets = await this.cacheReader.getCacheEntries({
          assetType,
          statusFilter: AssetStatusFilter.ACTIVE,
        });
        logger.info(
          `Processing ${activeAssets.length} active ${assetType} assets for field extraction`
        );

        let processedCount = 0;
        let extractedFieldsCount = 0;

        // Process assets using the fields already in metadata
        for (const asset of activeAssets) {
          try {
            // Get fields from the cache entry metadata
            const metadata = asset.metadata || {};
            const fields = metadata.fields || [];
            const calculatedFields = metadata.calculatedFields || [];

            // Combine regular and calculated fields
            const allFields = [
              ...fields.map((f) => ({ ...f, isCalculated: false })),
              ...calculatedFields.map((f) => ({ ...f, isCalculated: true })),
            ];

            if (allFields.length > 0) {
              processedCount++;
              extractedFieldsCount += allFields.length;

              // Transform to FieldInfo format and add to map
              for (const field of allFields) {
                // Handle the field based on whether it's calculated or not
                const fieldInfo: FieldInfo = {
                  fieldId: field.fieldId,
                  fieldName: field.fieldName,
                  displayName: field.displayName || field.fieldName,
                  dataType: field.dataType,
                  description: field.isCalculated ? '' : (field as any).description || '',
                  isCalculated: field.isCalculated,
                  expression: field.isCalculated ? (field as any).expression : undefined,
                  sourceAssetType: assetType,
                  sourceAssetId: asset.assetId,
                  sourceAssetName: asset.assetName,
                  datasetId:
                    field.sourceDatasetId || (assetType === 'dataset' ? asset.assetId : undefined),
                  datasetName:
                    field.sourceDatasetName ||
                    (assetType === 'dataset' ? asset.assetName : undefined),
                  columnName: field.isCalculated
                    ? undefined
                    : (field as any).columnName || field.fieldName,
                  dependencies: field.isCalculated ? (field as any).dependencies || [] : [],
                  usageCount: 0,
                  analysisCount: 0,
                  dashboardCount: 0,
                  lastUpdated: asset.lastUpdatedTime.toISOString(),
                  tags: asset.tags || [],
                };

                const fieldKey = `${field.fieldId}:${asset.assetId}`;
                fieldMap.set(fieldKey, fieldInfo);
              }
            }
          } catch (error) {
            logger.error(
              `Failed to extract fields from cached ${assetType}/${asset.assetId}:`,
              error
            );
          }
        }

        logger.info(`Completed processing ${assetType} assets`, {
          totalAssets: activeAssets.length,
          processedAssets: processedCount,
          extractedFields: extractedFieldsCount,
        });
      }

      const fieldsArray = Array.from(fieldMap.values());
      logger.info(`Field cache built successfully with ${fieldsArray.length} total unique fields`);

      return fieldsArray;
    } catch (error) {
      logger.error('Failed to build field cache from assets:', error);
      return [];
    }
  }

  private buildIndividualCacheEntryObject(params: {
    assetType: AssetType;
    assetKey: string;
    status: 'active' | 'archived';
    metadata: any;
    transformedData: any;
    enrichmentTimestamps: any;
    enrichmentStatus: any;
    assetData: any;
  }): CacheEntry {
    const {
      assetType,
      assetKey,
      status,
      metadata,
      transformedData,
      enrichmentTimestamps,
      enrichmentStatus,
      assetData,
    } = params;
    const isCollection = isCollectionType(assetType);
    const pathPrefix = status === 'archived' ? 'archived' : 'assets';

    const userFields =
      assetType === ASSET_TYPES.user
        ? {
            email: metadata.email,
            role: metadata.role,
            active: metadata.active,
            principalId: metadata.principalId,
          }
        : {};

    const domainSummary = transformedData.apiResponses?.list?.data || metadata;
    const assetName = getAssetName(domainSummary);

    return {
      assetId: metadata.assetId || assetKey,
      assetType,
      assetName,
      arn: metadata.arn || '',
      ...userFields,
      status: status as any,
      lastUpdatedTime: this.getDateValue(metadata.lastUpdatedTime),
      createdTime: this.getDateValue(metadata.createdTime),
      exportedAt: this.getDateValue(assetData.apiResponses?.list?.timestamp),
      enrichmentStatus,
      enrichmentTimestamps,
      tags: transformedData.apiResponses?.tags?.data || [],
      permissions: this.transformPermissions(
        transformedData.apiResponses?.permissions?.data || null
      ),
      metadata: {
        ...metadata,
        enrichmentStatus,
        exportTime: assetData.apiResponses?.list?.timestamp,
        ...(status === 'archived' && assetData.archivedMetadata
          ? { archived: assetData.archivedMetadata }
          : {}),
      },
      exportFilePath: isCollection
        ? `${pathPrefix}/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
        : `${pathPrefix}/${ASSET_TYPES_PLURAL[assetType]}/${assetKey}.json`,
      storageType: isCollection ? 'collection' : 'individual',
    };
  }

  /**
   * Convert SDK format data to domain format based on asset type
   */
  private convertSDKToDomainFormat(assetType: AssetType, sdkData: any): any {
    // Get the summary data from SDK format
    const sdkSummary = sdkData?.apiResponses?.list?.data;
    if (!sdkSummary) {
      return sdkData;
    }

    // Convert based on asset type
    // We're using the SDK -> Domain mappers (the ones that already exist)
    let domainSummary;
    switch (assetType) {
      case ASSET_TYPES.dashboard:
        domainSummary = mappers.mapSDKDashboardSummaryToDomain(sdkSummary);
        break;
      case ASSET_TYPES.analysis:
        domainSummary = mappers.mapSDKAnalysisSummaryToDomain(sdkSummary);
        break;
      case ASSET_TYPES.dataset:
        domainSummary = mappers.mapSDKDataSetSummaryToDomain(sdkSummary);
        break;
      case ASSET_TYPES.datasource:
        domainSummary = mappers.mapSDKDataSourceSummaryToDomain(sdkSummary);
        break;
      case ASSET_TYPES.folder:
        domainSummary = mappers.mapSDKFolderSummaryToDomain(sdkSummary);
        break;
      case ASSET_TYPES.user:
        domainSummary = mappers.mapSDKUserSummaryToDomain(sdkSummary);
        break;
      case ASSET_TYPES.group:
        domainSummary = mappers.mapSDKGroupSummaryToDomain(sdkSummary);
        break;
      default:
        domainSummary = sdkSummary;
    }

    // Return the data with converted summary
    return {
      ...sdkData,
      apiResponses: {
        ...sdkData.apiResponses,
        list: {
          ...sdkData.apiResponses.list,
          data: domainSummary,
        },
      },
    };
  }

  /**
   * Helper to create cache entry from asset data
   */
  private async createCacheEntryFromAsset(
    assetType: AssetType,
    assetKey: string,
    status: 'active' | 'archived'
  ): Promise<CacheEntry | null> {
    try {
      const assetData = await this.loadAssetData(assetType, assetKey, status);
      if (!assetData) {
        return null;
      }

      const { metadata, transformedData, enrichmentTimestamps, enrichmentStatus } =
        this.extractAssetMetadata(assetType, assetData);

      return this.buildCacheEntry({
        assetType,
        assetKey,
        status,
        metadata,
        transformedData,
        enrichmentTimestamps,
        enrichmentStatus,
        assetData,
      });
    } catch (error) {
      logger.warn(`Failed to process ${status} asset ${assetType}/${assetKey}:`, error);
      return null;
    }
  }

  private createCollectionCacheEntry(
    assetType: AssetType,
    assetKey: string,
    assetData: any,
    status: 'active' | 'archived'
  ): CacheEntry | null {
    const domainData = this.convertSDKToDomainFormat(assetType, assetData);
    const transformedData = pascalToCamel(domainData);
    const metadata = this.assetParser.extractMetadata(assetType, assetData, transformedData);

    if (!metadata) {
      logger.warn(`Failed to extract metadata for ${status} asset ${assetType}/${assetKey}`);
      return null;
    }

    const enrichmentTimestamps = this.assetParser.extractEnrichmentTimestamps(assetData);
    const enrichmentStatus = this.assetParser.determineEnrichmentStatus(assetData);

    const pathPrefix = status === 'archived' ? 'archived' : 'assets';

    const domainSummary = transformedData.apiResponses?.list?.data || metadata;
    const assetName = getAssetName(domainSummary);

    return {
      assetId: metadata.assetId || assetKey,
      assetType,
      assetName,
      arn: metadata.arn || '',
      status: status as any,
      lastUpdatedTime: this.getDateValue(metadata.lastUpdatedTime),
      createdTime: this.getDateValue(metadata.createdTime),
      exportedAt: new Date(),
      enrichmentStatus,
      enrichmentTimestamps,
      tags: transformedData.apiResponses?.tags?.data || [],
      permissions: transformedData.apiResponses?.permissions?.data || [],
      metadata: {
        ...metadata,
        enrichmentStatus,
        exportTime: assetData.apiResponses?.list?.timestamp,
      },
      exportFilePath: `${pathPrefix}/organization/${ASSET_TYPES_PLURAL[assetType]}.json`,
      storageType: 'collection',
    };
  }

  private async createIndividualCacheEntry(
    assetType: AssetType,
    assetKey: string,
    status: 'active' | 'archived'
  ): Promise<CacheEntry | null> {
    try {
      const assetData = await this.loadAssetData(assetType, assetKey, status);
      if (!assetData) {
        return null;
      }

      const { metadata, transformedData, enrichmentTimestamps, enrichmentStatus } =
        this.extractAssetMetadata(assetType, assetData);

      if (!metadata) {
        logger.warn(`Failed to extract metadata for ${status} asset ${assetType}/${assetKey}`);
        return null;
      }

      return this.buildIndividualCacheEntryObject({
        assetType,
        assetKey,
        status,
        metadata,
        transformedData,
        enrichmentTimestamps,
        enrichmentStatus,
        assetData,
      });
    } catch (error) {
      logger.warn(`Failed to process ${status} asset ${assetType}/${assetKey}:`, error);
      return null;
    }
  }

  private determinePrincipalType(principal: string): 'USER' | 'GROUP' | 'NAMESPACE' | 'PUBLIC' {
    if (!principal) {
      return 'USER';
    }

    // Check for public permissions (wildcard from LinkSharingConfiguration)
    if (principal === '*') {
      return 'PUBLIC';
    }
    // Check for namespace permissions (from LinkSharingConfiguration)
    if (principal.includes(':namespace/')) {
      return 'NAMESPACE';
    }

    // Check for group permissions
    if (principal.includes(':group/')) {
      return 'GROUP';
    }

    // Default to user
    return 'USER';
  }

  private extractAssetMetadata(
    assetType: AssetType,
    assetData: any
  ): {
    metadata: any;
    transformedData: any;
    enrichmentTimestamps: any;
    enrichmentStatus: any;
  } {
    const domainData = this.convertSDKToDomainFormat(assetType, assetData);
    const transformedData = this.transformAssetData(domainData);
    const metadata = this.assetParser.extractMetadata(assetType, assetData, transformedData);
    const enrichmentTimestamps = this.assetParser.extractEnrichmentTimestamps(assetData);
    const enrichmentStatus = this.assetParser.determineEnrichmentStatus(assetData);

    return { metadata, transformedData, enrichmentTimestamps, enrichmentStatus };
  }

  private async getArchivedAsset(assetType: AssetType, assetKey: string): Promise<any> {
    const bucketName = this.bucketName;

    if (isCollectionType(assetType)) {
      const collection = await this.s3Service.getObject(
        bucketName,
        `archived/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
      );
      return collection ? collection[assetKey] : null;
    }

    return await this.s3Service.getObject(
      bucketName,
      `archived/${ASSET_TYPES_PLURAL[assetType]}/${assetKey}.json`
    );
  }

  private getCacheEntryPermissions(status: 'active' | 'archived', transformedData: any): any {
    return status === 'active'
      ? this.transformPermissions(transformedData.apiResponses?.permissions?.data || null)
      : transformedData.apiResponses?.permissions?.data || [];
  }

  private async getCacheMetadata(): Promise<any> {
    try {
      const cached = this.memoryAdapter.get<any>('cache-metadata');
      if (cached) {
        return cached;
      }

      const metadata = await this.s3Adapter.getCacheMetadata();
      if (metadata) {
        this.memoryAdapter.set('cache-metadata', metadata);
        return metadata;
      }
      return {
        version: '2.0',
        lastUpdated: new Date(),
        assetCounts: {
          dashboard: 0,
          analysis: 0,
          dataset: 0,
          datasource: 0,
          folder: 0,
          user: 0,
          group: 0,
        },
        assetTimestamps: {},
      };
    } catch (error) {
      logger.error('Failed to get cache metadata', { error });
      return {
        version: '2.0',
        lastUpdated: new Date(),
        assetCounts: {},
        assetTimestamps: {},
      };
    }
  }

  private getDateValue(dateValue: any): Date {
    return dateValue ? new Date(dateValue) : new Date();
  }

  private getEmptyMasterCache(): MasterCache {
    return {
      version: '2.0',
      lastUpdated: new Date(),
      assetCounts: {
        dashboard: 0,
        dataset: 0,
        analysis: 0,
        datasource: 0,
        folder: 0,
        user: 0,
        group: 0,
      },
      entries: {
        dashboard: [],
        dataset: [],
        analysis: [],
        datasource: [],
        folder: [],
        user: [],
        group: [],
      },
    };
  }

  private async getMasterCache(): Promise<MasterCache> {
    const metadata = await this.getCacheMetadata();
    const entries: any = {};

    const assetTypes = Object.values(ASSET_TYPES);
    const promises = assetTypes.map(async (assetType) => {
      const typeEntries = await this.cacheReader.getCacheEntries({
        assetType,
        statusFilter: AssetStatusFilter.ALL,
      });
      entries[assetType] = typeEntries;
    });

    await Promise.all(promises);

    return {
      version: metadata.version || '2.0',
      lastUpdated: metadata.lastUpdated || new Date(),
      assetCounts: metadata.assetCounts || {},
      entries,
    };
  }

  /**
   * List archived assets for a specific type
   */
  private async listArchivedAssets(assetType: AssetType): Promise<string[]> {
    try {
      const bucketName = this.bucketName;

      // For collection assets, read the archived collection file
      if (isCollectionType(assetType)) {
        try {
          const collection = await this.s3Service.getObject(
            bucketName,
            `archived/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
          );
          return collection ? Object.keys(collection) : [];
        } catch {
          return [];
        }
      }

      // For individual assets, list the archived directory
      const objects = await this.s3Service.listObjects(
        bucketName,
        `archived/${ASSET_TYPES_PLURAL[assetType]}/`
      );

      return (
        objects
          .filter((obj: any) => obj.key.endsWith('.json'))
          // Filter out backup copies (they contain -previous-archive- in the name)
          .filter((obj: any) => !obj.key.includes('-previous-archive-'))
          .map((obj: any) => {
            const filename = obj.key.split('/').pop();
            return filename ? filename.replace('.json', '') : '';
          })
          .filter((id: string) => id !== '')
      );
    } catch {
      logger.debug(`No archived assets found for ${assetType}`);
      return [];
    }
  }

  /**
   * Load asset data based on status
   */
  private async loadAssetData(
    assetType: AssetType,
    assetKey: string,
    status: 'active' | 'archived'
  ): Promise<any> {
    return status === 'active'
      ? await this.s3Adapter.getAsset(assetType, assetKey)
      : await this.getArchivedAsset(assetType, assetKey);
  }

  /**
   * Load existing type cache
   */
  private async loadTypeCache(assetType: AssetType): Promise<CacheEntry[] | null> {
    return await this.s3Adapter.getTypeCache(assetType);
  }

  /**
   * Log asset type completion
   */
  private async logAssetTypeCompletion(
    assetType: AssetType,
    newCache: MasterCache,
    duration: number,
    exportStateService?: any
  ): Promise<void> {
    const totalCached = newCache.entries[assetType].length;

    logger.info(`Completed processing ${assetType} assets`, {
      duration: `${(duration / TIME_UNITS.SECOND).toFixed(2)}s`,
      totalCached,
    });

    if (exportStateService) {
      await exportStateService.appendLog(
        `Completed ${assetType}: ${totalCached} assets in ${(duration / TIME_UNITS.SECOND).toFixed(1)}s`,
        'info'
      );
      await exportStateService.checkpoint();
    }
  }

  /**
   * Log progress if needed
   */
  private logProgressIfNeeded(
    index: number,
    total: number,
    assetType: AssetType,
    status: 'active' | 'archived',
    exportStateService?: any
  ): void {
    const shouldLog =
      status === 'active'
        ? (index + 1) % EXPORT_CONFIG.cacheRebuild.progressLogInterval === 0 || index + 1 === total
        : total > EXPORT_CONFIG.cacheRebuild.progressLogInterval &&
          ((index + 1) % EXPORT_CONFIG.cacheRebuild.progressLogInterval === 0 ||
            index + 1 === total);

    if (shouldLog) {
      const message = `Cache build progress: ${index + 1}/${total} ${status} ${assetType} assets processed`;
      logger.info(message);
      if (exportStateService) {
        exportStateService.appendLog(message, 'info');
      }
    }
  }

  /**
   * Process active assets with merge support for metadata updates
   * Preserves existing data when doing permissions-only or tags-only updates
   */
  private async processActiveAssetsWithMerge(
    assetType: AssetType,
    assets: string[],
    existingEntriesMap: Map<string, CacheEntry>
  ): Promise<CacheEntry[]> {
    const entries: CacheEntry[] = [];
    const BATCH_SIZE = EXPORT_CONFIG.cacheRebuild.batchSize;
    const MAX_CONCURRENT_READS = EXPORT_CONFIG.cacheRebuild.maxConcurrentReads;

    const batches = [];
    for (let i = 0; i < assets.length; i += BATCH_SIZE) {
      batches.push(assets.slice(i, i + BATCH_SIZE));
    }

    // Process batches with concurrency control
    const limit = pLimit(MAX_CONCURRENT_READS);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (!batch) {
        logger.warn(`Batch ${i} is undefined, skipping`);
        continue;
      }

      const batchPromises = batch.map((assetPath) =>
        limit(async () => {
          // Create cache entry from current asset data
          const newEntry = await this.createCacheEntryFromAsset(assetType, assetPath, 'active');
          if (!newEntry) {
            return null;
          }

          // Check if this is a metadata-only update
          if (
            newEntry.enrichmentStatus === 'metadata-update' ||
            newEntry.enrichmentStatus === 'skeleton'
          ) {
            const existingEntry = existingEntriesMap.get(newEntry.assetId);
            if (
              existingEntry &&
              (existingEntry.enrichmentStatus === 'enriched' ||
                existingEntry.enrichmentStatus === 'partial')
            ) {
              // Merge: Keep existing enrichment status and data, update only permissions/tags
              return {
                ...existingEntry,
                permissions:
                  newEntry.permissions.length > 0
                    ? newEntry.permissions
                    : existingEntry.permissions,
                tags: newEntry.tags.length > 0 ? newEntry.tags : existingEntry.tags,
                exportedAt: newEntry.exportedAt,
                enrichmentTimestamps: {
                  ...existingEntry.enrichmentTimestamps,
                  ...newEntry.enrichmentTimestamps,
                },
              };
            }
          }

          return newEntry;
        })
      );

      const results = await Promise.all(batchPromises);
      results.forEach((entry) => {
        if (entry) {
          entries.push(entry);
        }
      });
    }

    return entries;
  }

  /**
   * Process active collection assets
   */
  private async processActiveCollection(
    assetType: AssetType,
    newCache: MasterCache,
    exportStateService?: any
  ): Promise<void> {
    try {
      const collectionData = await this.s3Service.getObject(
        this.bucketName,
        `assets/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
      );

      if (collectionData) {
        const assetIds = Object.keys(collectionData);
        const foundMessage = `Found ${assetIds.length} active ${assetType} assets in collection`;
        logger.info(foundMessage);

        if (exportStateService && assetIds.length > 0) {
          await exportStateService.appendLog(foundMessage, 'info');
        }

        for (const assetKey of assetIds) {
          const assetData = collectionData[assetKey];
          if (!assetData) {
            continue;
          }

          const entry = this.createCollectionCacheEntry(assetType, assetKey, assetData, 'active');
          if (entry) {
            newCache.entries[assetType].push(entry);
          }
        }
      }
    } catch (error) {
      logger.warn(`Failed to read collection file for ${assetType}:`, error);
    }
  }

  /**
   * Process archived assets
   */
  private async processArchivedAssets(
    assetType: AssetType,
    archivedAssets: string[]
  ): Promise<CacheEntry[]> {
    const entries: CacheEntry[] = [];
    const MAX_CONCURRENT_READS = EXPORT_CONFIG.cacheRebuild.maxConcurrentReads;
    const limit = pLimit(MAX_CONCURRENT_READS);

    const archivedPromises = archivedAssets.map((assetKey) =>
      limit(() => this.createCacheEntryFromAsset(assetType, assetKey, 'archived'))
    );

    const archivedResults = await Promise.all(archivedPromises);
    archivedResults.forEach((entry) => {
      if (entry) {
        entries.push(entry);
      }
    });

    return entries;
  }

  /**
   * Process archived collection assets
   */
  private async processArchivedCollection(
    assetType: AssetType,
    newCache: MasterCache,
    exportStateService?: any
  ): Promise<void> {
    try {
      const archivedCollectionData = await this.s3Service.getObject(
        this.bucketName,
        `archived/organization/${ASSET_TYPES_PLURAL[assetType]}.json`
      );

      if (archivedCollectionData) {
        const archivedAssetIds = Object.keys(archivedCollectionData);
        logger.info(`Found ${archivedAssetIds.length} archived ${assetType} assets in collection`);

        if (exportStateService && archivedAssetIds.length > 0) {
          await exportStateService.appendLog(
            `Found ${archivedAssetIds.length} archived ${assetType} assets in collection`,
            'info'
          );
        }

        for (const assetKey of archivedAssetIds) {
          const assetData = archivedCollectionData[assetKey];
          if (!assetData) {
            continue;
          }

          const entry = this.createCollectionCacheEntry(assetType, assetKey, assetData, 'archived');
          if (entry) {
            newCache.entries[assetType].push(entry);
          }
        }
      }
    } catch {
      logger.debug(`No archived collection file for ${assetType}`);
    }
  }

  /**
   * Process collection asset type
   */
  private async processCollectionAssetType(
    assetType: AssetType,
    newCache: MasterCache,
    exportStateService?: any
  ): Promise<void> {
    logger.info(`Processing ${assetType} assets for cache rebuild`);

    // Process active collection
    await this.processActiveCollection(assetType, newCache, exportStateService);

    // Process archived collection
    await this.processArchivedCollection(assetType, newCache, exportStateService);
  }

  /**
   * Process individual active assets
   */
  private async processIndividualActiveAssets(
    assetType: AssetType,
    assets: string[],
    newCache: MasterCache,
    exportStateService?: any
  ): Promise<void> {
    const MAX_CONCURRENT_READS = EXPORT_CONFIG.cacheRebuild.maxConcurrentReads;
    const limit = pLimit(MAX_CONCURRENT_READS);

    const activePromises = assets.map((assetKey) =>
      limit(() => this.createIndividualCacheEntry(assetType, assetKey, 'active'))
    );

    const activeResults = await Promise.all(activePromises);

    activeResults.forEach((entry, index) => {
      if (entry) {
        newCache.entries[assetType].push(entry);
      }
      this.logProgressIfNeeded(index, assets.length, assetType, 'active', exportStateService);
    });
  }

  /**
   * Process individual archived assets
   */
  private async processIndividualArchivedAssets(
    assetType: AssetType,
    archivedAssets: string[],
    newCache: MasterCache,
    exportStateService?: any
  ): Promise<void> {
    if (archivedAssets.length === 0) {
      return;
    }

    logger.info(`Processing ${archivedAssets.length} archived ${assetType} assets`);

    const MAX_CONCURRENT_READS = EXPORT_CONFIG.cacheRebuild.maxConcurrentReads;
    const limit = pLimit(MAX_CONCURRENT_READS);

    const archivedPromises = archivedAssets.map((assetKey) =>
      limit(() => this.createIndividualCacheEntry(assetType, assetKey, 'archived'))
    );

    const archivedResults = await Promise.all(archivedPromises);

    archivedResults.forEach((entry, index) => {
      if (entry) {
        newCache.entries[assetType].push(entry);
      }
      this.logProgressIfNeeded(
        index,
        archivedAssets.length,
        assetType,
        'archived',
        exportStateService
      );
    });
  }

  /**
   * Process individual asset type
   */
  private async processIndividualAssetType(
    assetType: AssetType,
    newCache: MasterCache,
    exportStateService?: any
  ): Promise<void> {
    logger.info(`Processing ${assetType} assets for cache rebuild`);

    const assets = await this.s3Adapter.listAssets(assetType);
    const archivedAssets = await this.listArchivedAssets(assetType);

    const foundMessage = `Found ${assets.length} active and ${archivedAssets.length} archived ${assetType} assets`;
    logger.info(foundMessage);

    if (exportStateService && (assets.length > 0 || archivedAssets.length > 0)) {
      await exportStateService.appendLog(foundMessage, 'info');
    }

    // Process active assets
    await this.processIndividualActiveAssets(assetType, assets, newCache, exportStateService);

    // Process archived assets
    await this.processIndividualArchivedAssets(
      assetType,
      archivedAssets,
      newCache,
      exportStateService
    );
  }

  /**
   * Resolve folder paths by looking up parent folder names
   * This must be done after all folders are loaded in the cache
   */
  private async resolveFolderPaths(cache: MasterCache): Promise<void> {
    const folderEntries = cache.entries.folder || [];
    if (folderEntries.length === 0) {
      return await Promise.resolve();
    }

    logger.info(`Resolving folder paths for ${folderEntries.length} folders`);

    // Create a map of folder ID to folder entry for quick lookup
    const folderMap = new Map<string, CacheEntry>();
    folderEntries.forEach((entry) => {
      folderMap.set(entry.assetId, entry);
    });

    // Resolve paths for each folder
    folderEntries.forEach((entry) => {
      if (!entry.metadata?.folderPath || !Array.isArray(entry.metadata.folderPath)) {
        // No parent folders, this is a root folder
        entry.metadata.fullPath = `/${entry.assetName}`;
        return;
      }

      // Build the full path by resolving parent folder names
      const pathSegments: string[] = [];

      // Process each parent folder ARN in the folderPath
      for (const parentArn of entry.metadata.folderPath) {
        // Extract folder ID from ARN
        const parentId = parentArn.split('/').pop();
        if (!parentId) {
          continue;
        }

        // Look up the parent folder
        const parentFolder = folderMap.get(parentId);
        if (parentFolder) {
          pathSegments.push(parentFolder.assetName);
        } else {
          // Parent folder not found, use ID as fallback
          pathSegments.push(parentId);
        }
      }

      // Add the current folder name
      pathSegments.push(entry.assetName);

      // Build the full path
      entry.metadata.fullPath = '/' + pathSegments.join('/');

      // Also set the parent ID (last item in folderPath)
      if (entry.metadata.folderPath && entry.metadata.folderPath.length > 0) {
        const lastParentArn = entry.metadata.folderPath[entry.metadata.folderPath.length - 1];
        if (lastParentArn) {
          entry.metadata.parentId = lastParentArn.split('/').pop();
        }
      }
    });

    logger.info('Folder path resolution completed');
  }

  /**
   * Resolve folder paths for a specific set of folder entries
   * Used when rebuilding cache for just the folder asset type
   */
  private async resolveFolderPathsForEntries(folderEntries: CacheEntry[]): Promise<void> {
    if (folderEntries.length === 0) {
      return;
    }

    logger.info(`Resolving folder paths for ${folderEntries.length} folders`);

    // Get all existing folders from cache to handle parent folders that might not be in this batch
    const existingFolders = await this.cacheReader.getCacheEntries({
      assetType: ASSET_TYPES.folder,
      statusFilter: AssetStatusFilter.ALL,
    });

    // Create a map of folder ID to folder entry for quick lookup
    const folderMap = new Map<string, CacheEntry>();

    // Add existing folders first
    existingFolders.forEach((entry) => {
      folderMap.set(entry.assetId, entry);
    });

    // Override with new entries (in case they're updated)
    folderEntries.forEach((entry) => {
      folderMap.set(entry.assetId, entry);
    });

    // Resolve paths for each folder
    folderEntries.forEach((entry) => {
      if (!entry.metadata?.folderPath || !Array.isArray(entry.metadata.folderPath)) {
        // No parent folders, this is a root folder
        entry.metadata.fullPath = `/${entry.assetName}`;
        return;
      }

      // Build the full path by resolving parent folder names
      const pathSegments: string[] = [];

      // Process each parent folder ARN in the folderPath
      for (const parentArn of entry.metadata.folderPath) {
        // Extract folder ID from ARN
        const parentId = parentArn.split('/').pop();
        if (!parentId) {
          continue;
        }

        // Look up the parent folder
        const parentFolder = folderMap.get(parentId);
        if (parentFolder) {
          pathSegments.push(parentFolder.assetName);
        } else {
          // Parent folder not found, use ID as fallback
          pathSegments.push(parentId);
        }
      }

      // Add the current folder name
      pathSegments.push(entry.assetName);

      // Build the full path
      entry.metadata.fullPath = '/' + pathSegments.join('/');

      // Also set the parent ID (last item in folderPath)
      if (entry.metadata.folderPath && entry.metadata.folderPath.length > 0) {
        const lastParentArn = entry.metadata.folderPath[entry.metadata.folderPath.length - 1];
        if (lastParentArn) {
          entry.metadata.parentId = lastParentArn.split('/').pop();
        }
      }
    });

    logger.info('Folder path resolution completed');
  }

  /**
   * Resolve lineage names by looking up dataset and datasource names
   * This enriches lineageData with human-readable names for searchability
   * Must be called after all datasets and datasources are loaded in the cache
   */
  private async resolveLineageNames(cache: MasterCache): Promise<void> {
    const datasetEntries = cache.entries.dataset || [];
    const datasourceEntries = cache.entries.datasource || [];
    const dashboardEntries = cache.entries.dashboard || [];
    const analysisEntries = cache.entries.analysis || [];

    if (datasetEntries.length === 0 && datasourceEntries.length === 0) {
      return await Promise.resolve();
    }

    logger.info('Resolving lineage names for searchability', {
      datasets: datasetEntries.length,
      datasources: datasourceEntries.length,
      dashboards: dashboardEntries.length,
      analyses: analysisEntries.length,
    });

    // Build lookup maps: id → name
    const datasetNameMap = new Map<string, string>();
    datasetEntries.forEach((entry) => {
      datasetNameMap.set(entry.assetId, entry.assetName);
    });

    const datasourceNameMap = new Map<string, string>();
    datasourceEntries.forEach((entry) => {
      datasourceNameMap.set(entry.assetId, entry.assetName);
    });

    // Enrich dashboards and analyses with dataset names
    const enrichDashboardOrAnalysis = (entry: CacheEntry): void => {
      const lineage = entry.metadata?.lineageData;
      if (!lineage) {
        return;
      }

      // Enrich dataset names
      if (lineage.datasetIds && lineage.datasetIds.length > 0) {
        lineage.datasets = lineage.datasetIds.map((id) => ({
          id,
          name: datasetNameMap.get(id) || id, // Fallback to ID if name not found
        }));
      }
    };

    dashboardEntries.forEach(enrichDashboardOrAnalysis);
    analysisEntries.forEach(enrichDashboardOrAnalysis);

    // Enrich datasets with datasource names
    datasetEntries.forEach((entry) => {
      const lineage = entry.metadata?.lineageData;
      if (!lineage) {
        return;
      }

      // Enrich datasource names
      if (lineage.datasourceIds && lineage.datasourceIds.length > 0) {
        lineage.datasources = lineage.datasourceIds.map((id) => ({
          id,
          name: datasourceNameMap.get(id) || id, // Fallback to ID if name not found
        }));
      }
    });

    logger.info('Lineage name resolution completed');
  }

  /**
   * Resolve lineage names for a specific set of entries
   * Used when rebuilding cache for a single asset type
   */
  private async resolveLineageNamesForEntries(
    entries: CacheEntry[],
    assetType: AssetType
  ): Promise<void> {
    // Only relevant for dashboard, analysis, and dataset types
    if (
      assetType !== ASSET_TYPES.dashboard &&
      assetType !== ASSET_TYPES.analysis &&
      assetType !== ASSET_TYPES.dataset
    ) {
      return;
    }

    logger.info(`Resolving lineage names for ${entries.length} ${assetType} entries`);

    // Get all datasets and datasources from cache for lookup
    const allDatasets = await this.cacheReader.getCacheEntries({
      assetType: ASSET_TYPES.dataset,
      statusFilter: AssetStatusFilter.ALL,
    });

    const allDatasources = await this.cacheReader.getCacheEntries({
      assetType: ASSET_TYPES.datasource,
      statusFilter: AssetStatusFilter.ALL,
    });

    // Build lookup maps
    const datasetNameMap = new Map<string, string>();
    allDatasets.forEach((entry) => {
      datasetNameMap.set(entry.assetId, entry.assetName);
    });

    const datasourceNameMap = new Map<string, string>();
    allDatasources.forEach((entry) => {
      datasourceNameMap.set(entry.assetId, entry.assetName);
    });

    // Enrich entries based on asset type
    entries.forEach((entry) => {
      const lineage = entry.metadata?.lineageData;
      if (!lineage) {
        return;
      }

      if (assetType === ASSET_TYPES.dashboard || assetType === ASSET_TYPES.analysis) {
        // Enrich with dataset names
        if (lineage.datasetIds && lineage.datasetIds.length > 0) {
          lineage.datasets = lineage.datasetIds.map((id) => ({
            id,
            name: datasetNameMap.get(id) || id,
          }));
        }
      } else if (assetType === ASSET_TYPES.dataset) {
        // Enrich with datasource names
        if (lineage.datasourceIds && lineage.datasourceIds.length > 0) {
          lineage.datasources = lineage.datasourceIds.map((id) => ({
            id,
            name: datasourceNameMap.get(id) || id,
          }));
        }
      }
    });

    logger.info(`Lineage name resolution completed for ${assetType}`);
  }

  private async saveMasterCache(cache: MasterCache): Promise<void> {
    // Save each type cache individually with concurrency control
    const limit = pLimit(EXPORT_CONFIG.cacheRebuild.maxConcurrentWrites);
    const promises = Object.values(ASSET_TYPES).map((assetType) =>
      limit(async () => {
        const entries = cache.entries[assetType] || [];
        await this.saveTypeCache(assetType, entries);
      })
    );

    await Promise.all(promises);

    // Update metadata
    const metadata = {
      version: cache.version,
      lastUpdated: new Date(),
      assetCounts: cache.assetCounts,
      assetTimestamps: {},
    };

    // Add timestamps for each asset type
    for (const assetType of Object.values(ASSET_TYPES)) {
      metadata.assetTimestamps = metadata.assetTimestamps || {};
      (metadata.assetTimestamps as any)[assetType] = new Date();
    }

    await this.s3Adapter.saveCacheMetadata(metadata);
  }

  private async saveTypeCache(assetType: AssetType, entries: CacheEntry[]): Promise<void> {
    await this.s3Adapter.saveTypeCache(assetType, entries);

    // Clear memory cache to force reload
    const memoryKey = `cache-${assetType}`;
    this.memoryAdapter.delete(memoryKey);
  }

  private transformAssetData(assetData: any): any {
    // Transform PascalCase to camelCase
    return pascalToCamel(assetData);
  }

  /**
   * Transform camelCase domain permissions to the cache format
   * Handles both array format and object format with linkSharingConfiguration
   */
  private transformPermissions(permissions: any): any[] {
    // Handle the camelCase domain format with permissions and linkSharingConfiguration
    if (permissions && typeof permissions === 'object' && !Array.isArray(permissions)) {
      const allPermissions = [];

      // Add regular permissions (camelCase)
      if (permissions.permissions && Array.isArray(permissions.permissions)) {
        allPermissions.push(...permissions.permissions);
      }

      // Add linkSharingConfiguration permissions (camelCase)
      if (
        permissions.linkSharingConfiguration?.permissions &&
        Array.isArray(permissions.linkSharingConfiguration.permissions)
      ) {
        allPermissions.push(...permissions.linkSharingConfiguration.permissions);
      }

      // Transform the combined permissions array (already in camelCase)
      const transformed = allPermissions.map((permission) => ({
        principal: permission.principal || '',
        principalType: this.determinePrincipalType(permission.principal || ''),
        actions: permission.actions || [],
      }));
      return transformed;
    }

    // Handle legacy array format
    if (!permissions) {
      return [];
    }

    if (!Array.isArray(permissions)) {
      return [];
    }

    return permissions.map((permission) => ({
      principal: permission.principal || '',
      principalType: this.determinePrincipalType(permission.principal || ''),
      actions: permission.actions || [],
    }));
  }

  private async updateCacheMetadata(assetType: AssetType, count: number): Promise<void> {
    const metadata = await this.getCacheMetadata();

    // Update count for this asset type
    metadata.assetCounts[assetType] = count;
    metadata.assetTimestamps[assetType] = new Date();
    metadata.lastUpdated = new Date();

    await this.s3Adapter.saveCacheMetadata(metadata);

    // Clear memory cache
    this.memoryAdapter.delete('cache-metadata');
  }

  /**
   * Helper method to update exported JSON for group
   */
  private async updateGroupExportedJson(
    groupName: string,
    updatedMembers: any[],
    memberCount: number
  ): Promise<void> {
    const exportFilePath = `assets/organization/groups.json`;
    try {
      const exportData = await this.s3Service.getObject(this.bucketName, exportFilePath);
      if (exportData && exportData.groups) {
        const groupIndex = exportData.groups.findIndex(
          (g: any) => g.name === groupName || g.id === groupName
        );

        if (groupIndex !== -1) {
          // Transform members back to PascalCase for SDK format in exported JSON
          const sdkMembers = updatedMembers.map((m) => ({
            MemberName: m.memberName,
            Arn: m.arn,
            Email: m.email,
          }));
          exportData.groups[groupIndex].members = sdkMembers;
          exportData.groups[groupIndex].memberCount = memberCount;
          exportData.lastUpdated = new Date().toISOString();
          await this.s3Service.putObject(this.bucketName, exportFilePath, exportData);
        }
      }
    } catch (error) {
      logger.warn(`Failed to update exported JSON for group ${groupName}`, { error });
    }
  }

  /**
   * Helper method to update group members list
   */
  private updateMembersList(
    currentMembers: any[],
    operation: 'add' | 'remove',
    userName: string,
    userArn?: string,
    userEmail?: string
  ): any[] {
    if (operation === 'add') {
      const existingMember = currentMembers.find((m: any) => m.memberName === userName);

      if (!existingMember) {
        // Use camelCase for internal domain model (cache)
        const newMember = {
          memberName: userName,
          arn:
            userArn ||
            `arn:aws:quicksight:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:user/default/${userName}`,
          email: userEmail,
        };
        return [...currentMembers, newMember];
      }
      return currentMembers;
    } else {
      return currentMembers.filter((m: any) => m.memberName !== userName);
    }
  }
}
