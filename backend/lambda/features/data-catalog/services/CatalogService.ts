import { type CacheEntry } from '../../../shared/models/asset.model';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { type FieldInfo } from '../../../shared/services/cache/types';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { PORTAL_EXCLUDE_TAGS } from '../../../shared/utils/constants';
import { logger } from '../../../shared/utils/logger';
import { FolderService } from '../../organization/services/FolderService';
import { type CatalogField, type DataCatalogResult } from '../types';

export class CatalogService {
  private readonly folderService: FolderService;

  constructor() {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    this.folderService = new FolderService(accountId);
  }

  public async buildVisualFieldCatalog(): Promise<{
    visualFields: Array<{
      fieldId: string;
      visualId: string;
      visualName: string;
      sheetId: string;
      sheetName: string;
      dashboardId: string;
      dashboardName: string;
      fieldName: string;
      dataType: string;
      isCalculated: boolean;
      lastUpdated: string;
    }>;
    summary: {
      totalVisualFields: number;
      totalVisuals: number;
      totalSheets: number;
      totalDashboards: number;
      lastUpdated: Date;
      processingTimeMs: number;
    };
  }> {
    const startTime = Date.now();

    // Get all dashboards and analyses using shared cache service
    const allAssets = await this.getAllAssets();
    const visualAssets = allAssets.filter(
      (asset) =>
        asset.assetType === ASSET_TYPES.dashboard || asset.assetType === ASSET_TYPES.analysis
    );

    const visualFields: any[] = [];
    const visualSet = new Set<string>();
    const sheetSet = new Set<string>();
    const dashboardSet = new Set<string>();

    // Process each visual asset
    for (const asset of visualAssets) {
      const sheets = asset.metadata.sheets || [];

      for (const sheet of sheets) {
        sheetSet.add(`${asset.assetId}:${sheet.sheetId}`);
        dashboardSet.add(asset.assetId);

        const visuals = sheet.visuals || [];
        for (const visual of visuals) {
          visualSet.add(`${asset.assetId}:${sheet.sheetId}:${visual.visualId}`);

          // For this simplified implementation, we'll create placeholder visual fields
          // In a real implementation, this would extract fields from visual definitions
          const fields = asset.metadata.fields || [];
          const calculatedFields = asset.metadata.calculatedFields || [];

          [...fields, ...calculatedFields].forEach((field) => {
            // Check if this is a calculated field (has expression property)
            const isCalculated = 'expression' in field && !!field.expression;

            visualFields.push({
              fieldId: field.fieldId || field.fieldName,
              visualId: visual.visualId,
              visualName: visual.title || `Visual ${visual.visualId}`,
              sheetId: sheet.sheetId,
              sheetName: sheet.name || `Sheet ${sheet.sheetId}`,
              dashboardId: asset.assetId,
              dashboardName: asset.assetName,
              fieldName: field.fieldName,
              dataType: field.dataType || 'STRING',
              isCalculated,
              lastUpdated: new Date().toISOString(),
            });
          });
        }
      }
    }

    return {
      visualFields,
      summary: {
        totalVisualFields: visualFields.length,
        totalVisuals: visualSet.size,
        totalSheets: sheetSet.size,
        totalDashboards: dashboardSet.size,
        lastUpdated: new Date(),
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  public async clearCatalog(): Promise<void> {
    try {
      const bucketName = process.env.BUCKET_NAME;
      if (!bucketName) {
        logger.warn('No bucket name configured, skipping catalog clear');
        return;
      }

      const { ClientFactory } = await import('../../../shared/services/aws/ClientFactory');
      const s3Service = ClientFactory.getS3Service();

      await s3Service.deleteObject(bucketName, 'catalog/data-catalog.json');
      await s3Service.deleteObject(bucketName, 'catalog/visual-field-catalog.json');

      logger.info('Data catalog and visual field catalog cleared');
    } catch (error) {
      logger.debug('Catalog clear failed (may not exist):', error);
    }
  }

  public async getAllAssets(): Promise<CacheEntry[]> {
    const { assets } = await cacheService.getAssets({
      statusFilter: AssetStatusFilter.ALL,
    });
    return assets;
  }

  /**
   * Get available assets for filtering (dashboards, analyses, datasets with field counts)
   */
  public async getAvailableAssets(): Promise<
    Array<{ id: string; name: string; type: string; fieldCount: number }>
  > {
    const allAssets = await this.getAllAssets();
    const fieldData = await cacheService.searchFields({});

    // Count fields per asset
    const fieldCounts = new Map<string, number>();
    for (const field of fieldData) {
      fieldCounts.set(field.sourceAssetId, (fieldCounts.get(field.sourceAssetId) || 0) + 1);
    }

    // Filter to assets that have fields and are relevant types
    const relevantTypes = new Set([
      ASSET_TYPES.dashboard,
      ASSET_TYPES.analysis,
      ASSET_TYPES.dataset,
    ]);

    return allAssets
      .filter((asset) => relevantTypes.has(asset.assetType) && fieldCounts.has(asset.assetId))
      .map((asset) => ({
        id: asset.assetId,
        name: asset.assetName,
        type: asset.assetType,
        fieldCount: fieldCounts.get(asset.assetId) || 0,
      }))
      .sort((a, b) => b.fieldCount - a.fieldCount);
  }

  /**
   * Get available tags from all assets with usage counts
   */
  public async getAvailableTags(): Promise<Array<{ key: string; value: string; count: number }>> {
    const allAssets = await this.getAllAssets();
    const tagCounts = new Map<string, number>();

    // Count occurrences of each tag key-value pair
    for (const asset of allAssets) {
      const tags = asset.tags || [];
      for (const tag of tags) {
        const tagKey = `${tag.key}:${tag.value}`;
        tagCounts.set(tagKey, (tagCounts.get(tagKey) || 0) + 1);
      }
    }

    // Convert to array and sort by count
    return Array.from(tagCounts.entries())
      .map(([tagKey, count]) => {
        const parts = tagKey.split(':', 2);
        return {
          key: parts[0] || '',
          value: parts[1] || '',
          count,
        };
      })
      .filter((tag) => tag.key && tag.value) // Filter out malformed tags
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get catalog statistics
   */
  public async getCatalogStats(): Promise<{
    totalAssets: number;
    assetsByType: Record<string, number>;
    totalFields: number;
    totalTags: number;
    lastUpdated: Date;
  }> {
    const allAssets = await this.getAllAssets();
    const fieldData = await cacheService.searchFields({});
    const tags = await this.getAvailableTags();

    // Count assets by type
    const assetsByType: Record<string, number> = {};
    for (const asset of allAssets) {
      assetsByType[asset.assetType] = (assetsByType[asset.assetType] || 0) + 1;
    }

    return {
      totalAssets: allAssets.length,
      assetsByType,
      totalFields: fieldData.length,
      totalTags: tags.length,
      lastUpdated: new Date(),
    };
  }

  /**
   * Get catalog summary (lightweight stats)
   */
  public async getCatalogSummary(): Promise<{
    totalAssets: number;
    totalFields: number;
    lastUpdated: Date;
  }> {
    const stats = await this.getCatalogStats();
    return {
      totalAssets: stats.totalAssets,
      totalFields: stats.totalFields,
      lastUpdated: stats.lastUpdated,
    };
  }

  public async getDataCatalog(
    tagFilter?: { key: string; value: string },
    includeTags?: Array<{ key: string; value: string }>,
    excludeTags?: Array<{ key: string; value: string }>,
    assetIds?: string[]
  ): Promise<DataCatalogResult> {
    const startTime = Date.now();

    try {
      const allFieldData = await cacheService.searchFields({});
      const { assets: allCachedAssets } = await cacheService.getAssets({
        statusFilter: AssetStatusFilter.ACTIVE,
      });

      const excludedAssets = await this.folderService.getExcludedAssets(
        PORTAL_EXCLUDE_TAGS.EXCLUDE_FROM_PORTAL
      );

      let includedAssets = allCachedAssets.filter(
        (asset: CacheEntry) => !excludedAssets.has(asset.assetId)
      );

      // Legacy single tag filter (backwards compatible)
      if (tagFilter) {
        includedAssets = includedAssets.filter((asset: CacheEntry) => {
          const tags = asset.tags || [];
          return tags.some(
            (tag: { key: string; value: string }) =>
              tag.key === tagFilter.key && tag.value === tagFilter.value
          );
        });
        logger.info(
          `Applied tag filter ${tagFilter.key}=${tagFilter.value}: ${includedAssets.length} assets`
        );
      }

      // Include tags filter: asset must have at least one of these tags (OR logic)
      if (includeTags && includeTags.length > 0) {
        includedAssets = includedAssets.filter((asset: CacheEntry) => {
          const assetTags = asset.tags || [];
          return includeTags.some((includeTag) =>
            assetTags.some(
              (tag: { key: string; value: string }) =>
                tag.key === includeTag.key && tag.value === includeTag.value
            )
          );
        });
        logger.info(
          `Applied include tags filter (${includeTags.length} tags): ${includedAssets.length} assets`
        );
      }

      // Exclude tags filter: asset must not have any of these tags (AND NOT logic)
      if (excludeTags && excludeTags.length > 0) {
        includedAssets = includedAssets.filter((asset: CacheEntry) => {
          const assetTags = asset.tags || [];
          return !excludeTags.some((excludeTag) =>
            assetTags.some(
              (tag: { key: string; value: string }) =>
                tag.key === excludeTag.key && tag.value === excludeTag.value
            )
          );
        });
        logger.info(
          `Applied exclude tags filter (${excludeTags.length} tags): ${includedAssets.length} assets`
        );
      }

      // Asset IDs filter: only include fields from specific assets (OR logic)
      if (assetIds && assetIds.length > 0) {
        const assetIdSet = new Set(assetIds);
        includedAssets = includedAssets.filter((asset: CacheEntry) =>
          assetIdSet.has(asset.assetId)
        );
        logger.info(`Applied asset filter (${assetIds.length} assets): ${includedAssets.length} assets`);
      }

      if (includedAssets.length === 0) {
        return this.buildEmptyCatalog(startTime);
      }

      const fieldMap = this.transformFieldsToCatalog(allFieldData, includedAssets);
      return this.buildCatalogResult(fieldMap, startTime);
    } catch (error) {
      logger.error('Error getting data catalog:', error);
      return this.buildEmptyCatalog(startTime);
    }
  }

  public async getFieldsPaginated(
    page: number,
    pageSize: number,
    filters?: {
      dataType?: string;
      assetType?: string;
      isCalculated?: boolean;
      query?: string;
    }
  ): Promise<{
    fields: CatalogField[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasMore: boolean;
    };
  }> {
    const allFieldData = await cacheService.searchFields({});
    const allAssets = await this.getAllAssets();
    const assetLookup = new Map(allAssets.map((asset) => [asset.assetId, asset]));

    let catalogFields: CatalogField[] = [];
    const fieldMap = new Map<string, CatalogField>();

    for (const field of allFieldData) {
      const asset = assetLookup.get(field.sourceAssetId);
      if (asset) {
        this.addFieldToCatalog(field, asset, fieldMap);
      }
    }

    catalogFields = Array.from(fieldMap.values());

    // Apply filters
    if (filters) {
      if (filters.dataType) {
        catalogFields = catalogFields.filter((f) => f.dataType === filters.dataType);
      }
      if (filters.assetType) {
        catalogFields = catalogFields.filter((f) => f.sourceAssetType === filters.assetType);
      }
      if (filters.isCalculated !== undefined) {
        catalogFields = catalogFields.filter((f) => f.isCalculated === filters.isCalculated);
      }
      if (filters.query) {
        const query = filters.query.toLowerCase();
        catalogFields = catalogFields.filter(
          (f) =>
            f.fieldName.toLowerCase().includes(query) || f.description.toLowerCase().includes(query)
        );
      }
    }

    // Calculate pagination
    const totalItems = catalogFields.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const offset = (page - 1) * pageSize;
    const paginatedFields = catalogFields.slice(offset, offset + pageSize);

    return {
      fields: paginatedFields,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Add field to catalog, handling variants and deduplication
   */
  private addFieldToCatalog(
    field: FieldInfo,
    asset: CacheEntry,
    fieldMap: Map<string, CatalogField>
  ): void {
    let catalogField = fieldMap.get(field.fieldName);

    if (!catalogField) {
      // Create new catalog field using shared FieldInfo
      catalogField = this.createCatalogFieldFromSharedData(field, asset);
      fieldMap.set(field.fieldName, catalogField);
    } else {
      // Add variant using shared data
      this.addFieldVariantFromSharedData(catalogField, field, asset);
    }
  }

  /**
   * Add variant to existing field using shared data and calculate usage counts (business logic)
   */
  private addFieldVariantFromSharedData(
    catalogField: CatalogField,
    field: FieldInfo,
    asset: CacheEntry
  ): void {
    const sourceInfo = {
      assetType: asset.assetType,
      assetId: asset.assetId,
      assetName: asset.assetName,
      dataType: field.dataType || 'STRING',
      lastUpdated: field.lastUpdated || new Date().toISOString(),
    };

    catalogField.variants = catalogField.variants || [];
    catalogField.variants.push(sourceInfo);

    catalogField.sources = catalogField.sources || [];
    catalogField.sources.push(sourceInfo);

    // Handle calculated field expressions
    if (field.isCalculated) {
      catalogField.isCalculated = true;

      if (field.expression) {
        catalogField.expressions = catalogField.expressions || [];

        const existingExpr = catalogField.expressions.find(
          (e) => e.expression === field.expression
        );
        if (existingExpr) {
          existingExpr.sources.push(sourceInfo);
        } else {
          catalogField.expressions.push({
            expression: field.expression,
            sources: [sourceInfo],
          });
        }
      }
    }

    // Calculate usage counts based on actual asset types (business logic)
    catalogField.usageCount = (catalogField.usageCount || 0) + 1;
    if (asset.assetType === ASSET_TYPES.analysis) {
      catalogField.analysisCount = (catalogField.analysisCount || 0) + 1;
    } else if (asset.assetType === ASSET_TYPES.dashboard) {
      catalogField.dashboardCount = (catalogField.dashboardCount || 0) + 1;
    }

    catalogField.hasVariants = catalogField.variants.length > 1;
  }

  private buildCatalogResult(
    fieldMap: Map<string, CatalogField>,
    startTime: number
  ): DataCatalogResult {
    const fields = Array.from(fieldMap.values());
    const calculatedFields = fields.filter((f) => f.isCalculated);
    const regularFields = fields.filter((f) => !f.isCalculated);

    // Build data type summary
    const fieldsByDataType: Record<string, number> = {};
    for (const field of fields) {
      fieldsByDataType[field.dataType] = (fieldsByDataType[field.dataType] || 0) + 1;
    }

    return {
      fields: regularFields,
      calculatedFields,
      summary: {
        totalFields: fields.length,
        distinctFields: fieldMap.size,
        totalCalculatedFields: calculatedFields.length,
        calculatedDatasetFields: calculatedFields.filter(
          (f) => f.sourceAssetType === ASSET_TYPES.dataset
        ).length,
        calculatedAnalysisFields: calculatedFields.filter(
          (f) => f.sourceAssetType === ASSET_TYPES.analysis
        ).length,
        visualFields: fields.filter((f) => f.dashboardCount && f.dashboardCount > 0).length,
        fieldsByDataType,
        lastUpdated: new Date(),
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Build empty catalog result
   */
  private buildEmptyCatalog(startTime: number): DataCatalogResult {
    return {
      fields: [],
      calculatedFields: [],
      summary: {
        totalFields: 0,
        distinctFields: 0,
        totalCalculatedFields: 0,
        calculatedDatasetFields: 0,
        calculatedAnalysisFields: 0,
        visualFields: 0,
        fieldsByDataType: {},
        lastUpdated: new Date(),
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Create catalog field from shared FieldInfo and CacheEntry types with proper usage counting
   */
  private createCatalogFieldFromSharedData(field: FieldInfo, asset: CacheEntry): CatalogField {
    const sourceInfo = {
      assetType: asset.assetType,
      assetId: asset.assetId,
      assetName: asset.assetName,
      dataType: field.dataType || 'STRING',
      lastUpdated: field.lastUpdated || new Date().toISOString(),
    };

    return {
      fieldId: field.fieldName,
      fieldName: field.fieldName,
      dataType: field.dataType || 'STRING',
      description: field.description || '',
      isCalculated: field.isCalculated || false,
      sourceAssetType: asset.assetType,
      sourceAssetId: asset.assetId,
      sourceAssetName: asset.assetName,
      datasetId: asset.assetType === ASSET_TYPES.dataset ? asset.assetId : field.datasetId,
      datasetName: asset.assetType === ASSET_TYPES.dataset ? asset.assetName : field.datasetName,
      columnName: field.columnName || null,
      expression: field.expression || null,
      expressions:
        field.isCalculated && field.expression
          ? [
              {
                expression: field.expression,
                sources: [sourceInfo],
              },
            ]
          : [],
      dependencies: field.dependencies || [],
      lastUpdated: field.lastUpdated || new Date().toISOString(),
      sources: [sourceInfo],
      variants: [sourceInfo],
      hasVariants: false,
      // Calculate usage counts based on actual asset types (business logic)
      usageCount: 1,
      analysisCount: asset.assetType === ASSET_TYPES.analysis ? 1 : 0,
      dashboardCount: asset.assetType === ASSET_TYPES.dashboard ? 1 : 0,
    };
  }

  private transformFieldsToCatalog(
    fieldData: FieldInfo[],
    includedAssets: CacheEntry[]
  ): Map<string, CatalogField> {
    const fieldMap = new Map<string, CatalogField>();
    const includedAssetIds = new Set(includedAssets.map((a) => a.assetId));
    const assetLookup = new Map(includedAssets.map((asset) => [asset.assetId, asset]));

    for (const field of fieldData) {
      if (includedAssetIds.has(field.sourceAssetId)) {
        const asset = assetLookup.get(field.sourceAssetId);
        if (asset) {
          this.addFieldToCatalog(field, asset, fieldMap);
        }
      }
    }

    logger.info(
      `Transformed ${fieldMap.size} unique fields from ${fieldData.length} cached field entries`
    );
    return fieldMap;
  }
}

export const catalogService = new CatalogService();
