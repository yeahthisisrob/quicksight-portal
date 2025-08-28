import { BaseAssetParser, type ParserCapabilities } from './BaseAssetParser';
import { type AssetExportData } from '../../models/asset-export.model';
import { ASSET_TYPES } from '../../types/assetTypes';

/**
 * Datasource metadata extracted from API responses
 */
export interface DatasourceMetadata {
  assetId: string;
  name: string;
  arn: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  datasourceType?: string;
  sourceType?: string;
  connectionMode?: string;
}

/**
 * Datasource-specific parser implementation
 */
export class DatasourceParser extends BaseAssetParser {
  public readonly assetType = ASSET_TYPES.datasource;

  public readonly capabilities: ParserCapabilities = {
    hasDataSets: false,
    hasCalculatedFields: false,
    hasParameters: false,
    hasFilters: false,
    hasSheets: false,
    hasVisuals: false,
    hasFields: false,
    hasDatasourceInfo: true,
  };

  /**
   * Extract comprehensive datasource metadata from individual data components
   */
  public extractDatasourceMetadata(listData: any, describeData: any): DatasourceMetadata {
    return {
      assetId: listData?.DataSourceId || describeData?.DataSourceId,
      name: listData?.Name || describeData?.Name,
      arn: listData?.Arn || describeData?.Arn,
      createdTime: listData?.CreatedTime || describeData?.CreatedTime,
      lastUpdatedTime: listData?.LastUpdatedTime || describeData?.LastUpdatedTime,
      datasourceType: listData?.Type || describeData?.Type,
      sourceType: listData?.Type || describeData?.Type,
      connectionMode: describeData?.DataSourceParameters?.S3Parameters ? 'FILE' : 'DIRECT',
    };
  }

  /**
   * Extract definition from datasource response (not applicable for datasources)
   */
  protected override extractDefinition(datasourceDefinition: any): any {
    return datasourceDefinition;
  }

  /**
   * Extract comprehensive datasource metadata from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData): DatasourceMetadata {
    const listData = assetData.apiResponses?.list?.data;
    const describeData = assetData.apiResponses?.describe?.data;

    return this.extractDatasourceMetadata(listData, describeData);
  }
}
