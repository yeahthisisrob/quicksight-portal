/**
 * Dashboard-specific parser implementation
 * Extends ExplorationParser for common Dashboard/Analysis functionality
 */

import { ExplorationParser } from './ExplorationParser';
import { type AssetExportData } from '../../../models/asset-export.model';
import { ASSET_TYPES } from '../../../types/assetTypes';

/**
 * Dashboard metadata extracted from API responses
 */
export interface DashboardMetadata {
  assetId: string;
  name: string;
  arn: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  status?: string;
  publishedVersionNumber?: number;
  sheetCount: number;
  visualCount: number;
  datasetCount: number;
  sheets?: any[];
  activity?: any;
  fields?: any[];
  calculatedFields?: any[];
  definitionErrors?: any[];
  lineageData?: any;
  themeArn?: string;
  dashboardPublishOptions?: any;
}

export class DashboardParser extends ExplorationParser {
  public readonly assetType = ASSET_TYPES.dashboard;

  /**
   * Extract definition from dashboard response
   */
  protected override extractDefinition(dashboardDefinition: any): any {
    // The definition from DescribeDashboardDefinition is wrapped in a Definition property
    return dashboardDefinition?.Definition || dashboardDefinition || {};
  }

  /**
   * Extract comprehensive metadata for dashboard from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData, transformedData?: any): DashboardMetadata {
    const { listData, describeData, definitionData } = this.extractApiData(assetData);
    const basicMetadata = this.extractBasicMetadata(listData, describeData);

    // If no definition data, return just basic metadata
    if (!definitionData) {
      return this.createBasicDashboardMetadata(basicMetadata, describeData);
    }

    // Extract enhanced metadata and combine
    return this.createEnhancedDashboardMetadata(
      basicMetadata,
      definitionData,
      describeData,
      transformedData
    );
  }

  /**
   * Create basic dashboard metadata when no definition is available
   */
  private createBasicDashboardMetadata(basicMetadata: any, describeData: any): DashboardMetadata {
    const counts = this.getCounts(undefined);
    return {
      ...basicMetadata,
      status: describeData?.Version?.Status,
      sheetCount: counts.sheetCount,
      visualCount: counts.visualCount,
      datasetCount: counts.datasetCount,
      sheets: counts.sheets,
    };
  }

  /**
   * Create enhanced dashboard metadata with full definition data
   */
  private createEnhancedDashboardMetadata(
    basicMetadata: any,
    definitionData: any,
    describeData: any,
    transformedData?: any
  ): DashboardMetadata {
    const metadata = this.extractExplorationMetadata(definitionData, describeData);
    const status = this.extractStatus(transformedData, describeData);
    const publishedVersion = this.extractPublishedVersion(transformedData, describeData);
    const optionalFields = this.extractOptionalFields(metadata);

    return {
      ...basicMetadata,
      status,
      visualCount: metadata.visualCount,
      sheetCount: metadata.sheetCount,
      datasetCount: metadata.datasetCount,
      sheets: metadata.sheets,
      publishedVersionNumber: publishedVersion,
      activity: transformedData?.activity,
      fields: metadata.fields,
      calculatedFields: metadata.calculatedFields,
      ...optionalFields,
    };
  }

  /**
   * Extract API response data
   */
  private extractApiData(assetData: AssetExportData): {
    listData: any;
    describeData: any;
    definitionData: any;
  } {
    return {
      listData: assetData.apiResponses?.list?.data,
      describeData: assetData.apiResponses?.describe?.data,
      definitionData: assetData.apiResponses?.definition?.data,
    };
  }

  /**
   * Extract basic metadata common to all dashboards
   */
  private extractBasicMetadata(
    listData: any,
    describeData: any
  ): {
    assetId: string | undefined;
    name: string | undefined;
    arn: string | undefined;
    createdTime: Date | undefined;
    lastUpdatedTime: Date | undefined;
    publishedVersionNumber: number | undefined;
  } {
    return {
      assetId: listData?.DashboardId || describeData?.DashboardId,
      name: listData?.Name || describeData?.Name,
      arn: listData?.Arn || describeData?.Arn,
      createdTime: listData?.CreatedTime || describeData?.CreatedTime,
      lastUpdatedTime: listData?.LastUpdatedTime || describeData?.LastUpdatedTime,
      publishedVersionNumber: describeData?.PublishedVersionNumber,
    };
  }

  /**
   * Extract optional fields from metadata
   */
  private extractOptionalFields(metadata: any): any {
    const fields: any = {};
    if (metadata.definitionErrors) {
      fields.definitionErrors = metadata.definitionErrors;
    }
    if (metadata.lineageData) {
      fields.lineageData = metadata.lineageData;
    }
    if (metadata.themeArn) {
      fields.themeArn = metadata.themeArn;
    }
    if (metadata.dashboardPublishOptions) {
      fields.dashboardPublishOptions = metadata.dashboardPublishOptions;
    }
    return fields;
  }

  /**
   * Extract published version number
   */
  private extractPublishedVersion(transformedData: any, describeData: any): number | undefined {
    return (
      transformedData?.dashboard?.publishedVersionNumber || describeData?.PublishedVersionNumber
    );
  }

  /**
   * Extract status with fallback chain
   */
  private extractStatus(transformedData: any, describeData: any): string {
    return (
      transformedData?.dashboard?.status || describeData?.Version?.Status || 'CREATION_SUCCESSFUL'
    );
  }
}
