import { type BaseAssetParser, type ParsedAssetInfo } from './BaseAssetParser';
import { DatasetParser } from './DatasetParser';
import { DatasourceParser } from './DatasourceParser';
import { AnalysisParser } from './explorations/AnalysisParser';
import { DashboardParser } from './explorations/DashboardParser';
import { FolderParser } from './organization/FolderParser';
import { GroupParser } from './organization/GroupParser';
import { UserParser } from './organization/UserParser';
import {
  type AssetExportData,
  isDashboardExport,
  isAnalysisExport,
  isFolderExport,
} from '../../models/asset-export.model';
import { type AssetType, ASSET_TYPES } from '../../types/assetTypes';
import { logger } from '../../utils/logger';

// Re-export types for convenience
export type {
  CalculatedField,
  Field,
  ParsedAssetInfo,
  DataSetInfo,
  Parameter,
  Filter,
  Sheet,
  Visual,
} from './BaseAssetParser';

/**
 * Unified asset parser service
 * Handles all asset parsing and metadata extraction
 */
export class AssetParserService {
  private readonly analysisParser: AnalysisParser;
  private readonly dashboardParser: DashboardParser;
  private readonly datasetParser: DatasetParser;
  private readonly datasourceParser: DatasourceParser;
  private readonly folderParser: FolderParser;
  private readonly groupParser: GroupParser;
  private readonly parsers: Map<AssetType, BaseAssetParser>;
  private readonly userParser: UserParser;

  constructor() {
    this.dashboardParser = new DashboardParser();
    this.analysisParser = new AnalysisParser();
    this.datasetParser = new DatasetParser();
    this.datasourceParser = new DatasourceParser();
    this.folderParser = new FolderParser();
    this.groupParser = new GroupParser();
    this.userParser = new UserParser();

    this.parsers = new Map<AssetType, BaseAssetParser>();
    this.parsers.set(ASSET_TYPES.dashboard, this.dashboardParser);
    this.parsers.set(ASSET_TYPES.analysis, this.analysisParser);
    this.parsers.set(ASSET_TYPES.dataset, this.datasetParser);
    this.parsers.set(ASSET_TYPES.datasource, this.datasourceParser);
    this.parsers.set(ASSET_TYPES.folder, this.folderParser);
    this.parsers.set(ASSET_TYPES.group, this.groupParser);
    this.parsers.set(ASSET_TYPES.user, this.userParser);
  }

  /**
   * Determine enrichment status based on API responses
   */
  public determineEnrichmentStatus(
    assetData: AssetExportData
  ): 'skeleton' | 'enriched' | 'partial' | 'metadata-update' {
    // Check if this is a metadata-only update (permissions or tags only)
    const hasPermissions = assetData.apiResponses?.permissions?.data;
    const hasTags = assetData.apiResponses?.tags?.data;
    const hasDescribe = assetData.apiResponses?.describe?.data;
    const hasDefinition = assetData.apiResponses?.definition?.data;
    const hasList = assetData.apiResponses?.list?.data;

    // If we only have permissions and/or tags (no describe/definition), it's a metadata update
    // This should NOT downgrade the enrichment status
    if ((hasPermissions || hasTags) && !hasDescribe && !hasDefinition) {
      return 'metadata-update';
    }

    if (isDashboardExport(assetData) || isAnalysisExport(assetData)) {
      if (hasDefinition) {
        return 'enriched';
      } else if (hasDescribe) {
        return 'partial';
      }
    } else if (isFolderExport(assetData)) {
      if (hasList) {
        return 'enriched';
      }
    } else {
      if (hasDescribe) {
        return 'enriched';
      }
    }
    return 'skeleton';
  }

  /**
   * Extract enrichment timestamps from API responses
   */
  public extractEnrichmentTimestamps(assetData: AssetExportData): Record<string, any> {
    const enrichmentTimestamps: any = {};

    if (assetData.apiResponses) {
      for (const [key, value] of Object.entries(assetData.apiResponses)) {
        if (key !== 'list' && value && typeof value === 'object' && 'timestamp' in value) {
          enrichmentTimestamps[key] = (value as any).timestamp;
        }
      }
    }

    return enrichmentTimestamps;
  }

  /**
   * Extract metadata for cache storage
   */
  public extractMetadata(
    assetType: AssetType,
    assetData: AssetExportData,
    transformedData?: any
  ): any {
    try {
      if (!assetData?.apiResponses) {
        return null;
      }

      switch (assetType) {
        case ASSET_TYPES.dashboard:
          return this.dashboardParser.extractMetadata(assetData, transformedData);
        case ASSET_TYPES.analysis:
          return this.analysisParser.extractMetadata(assetData, transformedData);
        case ASSET_TYPES.dataset:
          return this.datasetParser.extractMetadata(assetData);
        case ASSET_TYPES.datasource:
          return this.datasourceParser.extractMetadata(assetData);
        case ASSET_TYPES.folder:
          return this.folderParser.extractMetadata(assetData);
        case ASSET_TYPES.user:
          return this.userParser.extractMetadata(assetData);
        case ASSET_TYPES.group:
          return this.groupParser.extractMetadata(assetData);
        default:
          return null;
      }
    } catch (error) {
      logger.error(`Failed to extract metadata for ${assetType}`, { error });
      return null;
    }
  }

  /**
   * Get parser capabilities for a specific asset type
   */
  public getParserCapabilities(assetType: AssetType): any {
    const parser = this.parsers.get(assetType);
    return parser?.capabilities;
  }

  /**
   * Get a list of supported asset types
   */
  public getSupportedAssetTypes(): AssetType[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Generic parse method that routes to the appropriate parser
   */
  public parse(assetType: AssetType, assetDefinition: any): ParsedAssetInfo {
    const parser = this.parsers.get(assetType);
    if (!parser) {
      logger.error(`Parser for ${assetType} not found`);
      return this.getEmptyResult();
    }

    try {
      return parser.parse(assetDefinition);
    } catch (error) {
      logger.error(`Error parsing ${assetType}:`, error);
      return this.getEmptyResult();
    }
  }

  /**
   * Parse an analysis definition to extract fields, calculated fields, and other metadata
   */
  public parseAnalysis(analysisDefinition: any): ParsedAssetInfo {
    const parser = this.parsers.get(ASSET_TYPES.analysis);
    if (!parser) {
      logger.error('Analysis parser not found');
      return this.getEmptyResult();
    }

    try {
      return parser.parse(analysisDefinition);
    } catch (error) {
      logger.error('Error parsing analysis:', error);
      return this.getEmptyResult();
    }
  }

  /**
   * Parse asset from the new apiResponses structure
   * Extracts the definition/describe data and parses it appropriately
   */
  public parseAsset(assetType: AssetType, assetData: any): ParsedAssetInfo | null {
    try {
      // Different asset types store their data in different places within apiResponses
      let definitionData: any = null;

      if (assetType === ASSET_TYPES.dataset) {
        // Datasets: fields are in describe response
        definitionData = assetData.apiResponses?.describe?.data?.DataSet;
      } else if (assetType === ASSET_TYPES.dashboard || assetType === ASSET_TYPES.analysis) {
        // Dashboards/Analyses: fields are in definition response
        definitionData = assetData.apiResponses?.definition?.data;
      }

      if (!definitionData) {
        logger.debug(`No definition data found for ${assetType}`);
        return null;
      }

      return this.parse(assetType, definitionData);
    } catch (error) {
      logger.error(`Error parsing asset ${assetType}:`, error);
      return null;
    }
  }

  /**
   * Parse a dashboard definition to extract fields, calculated fields, and other metadata
   */
  public parseDashboard(dashboardDefinition: any): ParsedAssetInfo {
    const parser = this.parsers.get(ASSET_TYPES.dashboard);
    if (!parser) {
      logger.error('Dashboard parser not found');
      return this.getEmptyResult();
    }

    try {
      return parser.parse(dashboardDefinition);
    } catch (error) {
      logger.error('Error parsing dashboard:', error);
      return this.getEmptyResult();
    }
  }

  /**
   * Parse a dataset definition to extract fields, calculated fields, and other metadata
   */
  public parseDataset(datasetDefinition: any): ParsedAssetInfo {
    const parser = this.parsers.get(ASSET_TYPES.dataset);
    if (!parser) {
      logger.error('Dataset parser not found');
      return this.getEmptyResult();
    }

    try {
      return parser.parse(datasetDefinition);
    } catch (error) {
      logger.error('Error parsing dataset:', error);
      return this.getEmptyResult();
    }
  }

  /**
   * Add or replace a parser for a specific asset type
   */
  public registerParser(assetType: AssetType, parser: BaseAssetParser): void {
    this.parsers.set(assetType, parser);
  }

  /**
   * Get empty result structure
   */
  private getEmptyResult(): ParsedAssetInfo {
    return {
      calculatedFields: [],
      fields: [],
      dataSets: [],
      parameters: [],
      filters: [],
      sheets: [],
      visuals: [],
    };
  }
}
