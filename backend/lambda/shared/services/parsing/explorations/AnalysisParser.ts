/**
 * Analysis-specific parser implementation
 * Extends ExplorationParser for common Dashboard/Analysis functionality
 */

import { ExplorationParser } from './ExplorationParser';
import { type AssetExportData } from '../../../models/asset-export.model';
import { ASSET_TYPES } from '../../../types/assetTypes';

/**
 * Analysis metadata extracted from API responses
 */
export interface AnalysisMetadata {
  assetId: string;
  name: string;
  arn: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  status?: string;
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
}

export class AnalysisParser extends ExplorationParser {
  public readonly assetType = ASSET_TYPES.analysis;

  /**
   * Extract definition from analysis response
   */
  protected override extractDefinition(analysisDefinition: any): any {
    // The definition from DescribeAnalysisDefinition is wrapped in a Definition property
    return analysisDefinition?.Definition || analysisDefinition || {};
  }

  /**
   * Extract comprehensive metadata for analysis from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData, transformedData?: any): AnalysisMetadata {
    const { listData, describeData, definitionData } = this.extractApiData(assetData);
    const basicMetadata = this.extractBasicMetadata(listData, describeData);

    // If no definition data, return just basic metadata with basic counts
    if (!definitionData) {
      return this.createBasicAnalysisMetadata(basicMetadata, listData, describeData);
    }

    // Extract enhanced metadata and combine
    return this.createEnhancedAnalysisMetadata(
      basicMetadata,
      definitionData,
      describeData,
      listData,
      transformedData
    );
  }

  /**
   * Create basic analysis metadata when no definition is available
   */
  private createBasicAnalysisMetadata(
    basicMetadata: any,
    listData: any,
    describeData: any
  ): AnalysisMetadata {
    const counts = this.getCounts(undefined);
    return {
      ...basicMetadata,
      status: listData?.Status || describeData?.Status,
      sheetCount: counts.sheetCount,
      visualCount: counts.visualCount,
      datasetCount: counts.datasetCount,
      sheets: counts.sheets,
    };
  }

  /**
   * Create enhanced analysis metadata with full definition data
   */
  private createEnhancedAnalysisMetadata(
    basicMetadata: any,
    definitionData: any,
    describeData: any,
    listData: any,
    transformedData?: any
  ): AnalysisMetadata {
    const metadata = this.extractExplorationMetadata(definitionData, describeData);
    const status = this.extractStatus(transformedData, listData, describeData);
    const optionalFields = this.extractOptionalFields(metadata);

    return {
      ...basicMetadata,
      status,
      visualCount: metadata.visualCount,
      sheetCount: metadata.sheetCount,
      datasetCount: metadata.datasetCount,
      sheets: metadata.sheets,
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
   * Extract basic metadata common to all analyses
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
  } {
    return {
      assetId: listData?.AnalysisId || describeData?.AnalysisId,
      name: listData?.Name || describeData?.Name,
      arn: listData?.Arn || describeData?.Arn,
      createdTime: listData?.CreatedTime || describeData?.CreatedTime,
      lastUpdatedTime: listData?.LastUpdatedTime || describeData?.LastUpdatedTime,
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
    return fields;
  }

  /**
   * Extract status with fallback chain
   */
  private extractStatus(transformedData: any, listData: any, describeData: any): string {
    return (
      transformedData?.analysis?.status ||
      listData?.Status ||
      describeData?.Status ||
      'CREATION_SUCCESSFUL'
    );
  }
}
