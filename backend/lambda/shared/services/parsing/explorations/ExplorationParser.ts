/**
 * Base parser for Exploration assets (Dashboard and Analysis)
 * Handles common parsing logic for these similar asset types
 */

import { type AssetType } from '../../../types/assetTypes';
import { logger } from '../../../utils/logger';
import {
  BaseAssetParser,
  type CalculatedField,
  type DataSetInfo,
  type Field,
  type Filter,
  type Parameter,
  type ParsedAssetInfo,
  type ParserCapabilities,
  type Sheet,
  type Visual,
} from '../BaseAssetParser';

/**
 * Extracted metadata specific to explorations
 */
export interface ExplorationMetadata {
  sheetCount: number;
  visualCount: number;
  datasetCount: number;
  sheets?: Array<{
    sheetId: string;
    name: string;
    visualCount: number;
    visuals?: Array<{
      visualId: string;
      type: string;
      title: string;
      hasTitle: boolean;
    }>;
  }>;
  fields?: Array<{
    fieldId: string;
    fieldName: string;
    displayName: string;
    dataType: string;
    sourceDatasetId?: string;
    sourceDatasetName?: string;
    columnName?: string;
  }>;
  calculatedFields?: Array<{
    fieldId: string;
    fieldName: string;
    displayName: string;
    dataType: string;
    expression: string;
    sourceDatasetId?: string;
    sourceDatasetName?: string;
  }>;
  lineageData?: {
    sourceAnalysisArn?: string;
    datasetIds?: string[];
  };
  definitionErrors?: Array<{
    type: string;
    message: string;
    violatedEntities?: Array<{ path: string }>;
  }>;
  themeArn?: string;
  dashboardPublishOptions?: any;
}

/**
 * Abstract base class for Dashboard and Analysis parsers
 * Provides common exploration parsing functionality
 */
export abstract class ExplorationParser extends BaseAssetParser {
  public abstract override readonly assetType: AssetType;

  public override readonly capabilities: ParserCapabilities = {
    hasDataSets: true,
    hasCalculatedFields: true,
    hasParameters: true,
    hasFilters: true,
    hasSheets: true,
    hasVisuals: true,
    hasFields: true,
    hasDatasourceInfo: false,
  };

  /**
   * Extract complete metadata for the exploration
   */
  public extractExplorationMetadata(definitionData: any, describeData?: any): ExplorationMetadata {
    try {
      // Parse the definition to get structured data
      const parsedInfo = this.parse(definitionData);

      // Transform sheets to metadata format
      const sheets = parsedInfo.sheets?.map((sheet) => ({
        sheetId: sheet.sheetId,
        name: sheet.name,
        visualCount: sheet.visualCount,
        visuals: sheet.visuals?.map((visual) => ({
          visualId: visual.visualId,
          type: visual.type,
          title: visual.title,
          hasTitle: visual.hasTitle,
        })),
      }));

      // Extract fields and calculated fields
      const fields = this.extractFieldsForMetadata(parsedInfo);
      const calculatedFields = this.extractCalculatedFieldsForMetadata(parsedInfo);

      // Extract lineage data
      const lineageData = this.extractLineageData(definitionData, describeData);

      // Extract definition errors
      const definitionErrors = this.extractDefinitionErrors(definitionData);

      // Extract theme and publish options
      const themeArn = definitionData?.ThemeArn;
      const dashboardPublishOptions = this.extractDashboardPublishOptions(definitionData);

      return {
        sheetCount: parsedInfo.sheets?.length || 0,
        visualCount: parsedInfo.visuals?.length || 0,
        datasetCount: parsedInfo.dataSets?.length || 0,
        sheets,
        fields,
        calculatedFields,
        ...(definitionErrors?.length && { definitionErrors }),
        ...(Object.keys(lineageData).length > 0 && { lineageData }),
        ...(themeArn && { themeArn }),
        ...(dashboardPublishOptions && { dashboardPublishOptions }),
      };
    } catch (error) {
      logger.error(`Failed to extract ${this.assetType} metadata`, { error });
      return {
        sheetCount: 0,
        visualCount: 0,
        datasetCount: 0,
      };
    }
  }

  /**
   * Get summary counts for the exploration
   */
  public getCounts(definitionData: any): {
    sheetCount: number;
    visualCount: number;
    datasetCount: number;
    sheets?: any[];
  } {
    if (!definitionData) {
      return { sheetCount: 0, visualCount: 0, datasetCount: 0 };
    }

    try {
      const metadata = this.extractExplorationMetadata(definitionData);
      return {
        sheetCount: metadata.sheetCount,
        visualCount: metadata.visualCount,
        datasetCount: metadata.datasetCount,
        sheets: metadata.sheets,
      };
    } catch (error) {
      logger.warn(`Failed to get counts for ${this.assetType}`, { error });
      return { sheetCount: 0, visualCount: 0, datasetCount: 0 };
    }
  }

  /**
   * Parse the exploration and extract comprehensive metadata
   */
  public override parse(assetDefinition: any): ParsedAssetInfo {
    const parsedInfo = super.parse(assetDefinition);

    // Extract visual field mappings
    const definition = this.extractDefinition(assetDefinition);
    parsedInfo.visualFieldMappings = this.extractVisualFieldMappings(definition);

    return parsedInfo;
  }

  /**
   * Parse calculated fields from exploration definition
   */
  protected override parseCalculatedFields(definition: any): CalculatedField[] {
    return this.extractCalculatedFieldsFromArray(definition);
  }

  /**
   * Parse data sets from exploration definition
   */
  protected override parseDataSets(definition: any): DataSetInfo[] {
    return this.extractDataSetsFromDeclarations(definition);
  }

  /**
   * Parse fields from exploration visuals
   */
  protected override parseFields(definition: any): Field[] {
    return this.extractFieldsFromVisuals(definition);
  }

  /**
   * Parse filters from exploration definition
   */
  protected override parseFilters(definition: any): Filter[] {
    return this.extractFiltersFromGroups(definition);
  }

  /**
   * Parse parameters from exploration definition
   */
  protected override parseParameters(definition: any): Parameter[] {
    return this.extractParametersFromDeclarations(definition);
  }

  /**
   * Parse sheets from exploration definition
   */
  protected override parseSheets(definition: any): Sheet[] {
    const { sheets } = this.extractSheetsAndVisuals(definition);
    return sheets;
  }

  /**
   * Parse visuals from exploration definition
   */
  protected override parseVisuals(definition: any): Visual[] {
    const { visuals } = this.extractSheetsAndVisuals(definition);
    return visuals;
  }

  /**
   * Extract calculated fields in metadata format
   */
  private extractCalculatedFieldsForMetadata(parsedInfo: ParsedAssetInfo): any[] {
    const calculatedFields: any[] = [];

    if (parsedInfo.calculatedFields && parsedInfo.calculatedFields.length > 0) {
      parsedInfo.calculatedFields.forEach((calcField) => {
        calculatedFields.push({
          fieldId: calcField.name,
          fieldName: calcField.name,
          displayName: calcField.name,
          dataType: 'STRING', // Default since not provided by parser
          expression: calcField.expression,
          sourceDatasetId: calcField.dataSetIdentifier,
          sourceDatasetName: parsedInfo.dataSets?.find(
            (ds) => ds.identifier === calcField.dataSetIdentifier
          )?.name,
        });
      });
    }

    return calculatedFields;
  }

  /**
   * Extract dashboard publish options (for dashboards only)
   */
  private extractDashboardPublishOptions(definitionData: any): any {
    if (this.assetType !== 'dashboard') {
      return undefined;
    }
    return definitionData?.DashboardPublishOptions;
  }

  /**
   * Extract definition errors
   */
  private extractDefinitionErrors(definitionData: any): any[] | undefined {
    const errors = definitionData?.Errors;
    if (!errors || !Array.isArray(errors) || errors.length === 0) {
      return undefined;
    }

    return errors.map((error: any) => ({
      type: error.Type,
      message: error.Message,
      violatedEntities: error.ViolatedEntities?.map((entity: any) => ({
        path: entity.Path,
      })),
    }));
  }

  /**
   * Extract fields in metadata format
   */
  private extractFieldsForMetadata(parsedInfo: ParsedAssetInfo): any[] {
    const fields: any[] = [];

    if (parsedInfo.fields && parsedInfo.fields.length > 0) {
      parsedInfo.fields.forEach((field) => {
        fields.push({
          fieldId: field.fieldId,
          fieldName: field.fieldName,
          displayName: field.name || field.fieldName,
          dataType: field.dataType || field.type || 'STRING',
          sourceDatasetId: field.dataSetIdentifier,
          sourceDatasetName: parsedInfo.dataSets?.find(
            (ds) => ds.identifier === field.dataSetIdentifier
          )?.name,
          columnName: field.fieldName,
        });
      });
    }

    return fields;
  }

  /**
   * Extract lineage data for the exploration
   */
  private extractLineageData(definitionData: any, describeData?: any): any {
    const lineageData: any = {};

    // For dashboards, extract source analysis ARN from describe data
    if (this.assetType === 'dashboard' && describeData?.Version?.SourceEntityArn) {
      lineageData.sourceAnalysisArn = describeData.Version.SourceEntityArn;
    }

    // Extract dataset IDs from definition
    const datasetIds: string[] = [];
    const declarations = definitionData?.Definition?.DataSetIdentifierDeclarations;

    if (declarations && Array.isArray(declarations)) {
      declarations.forEach((ds: { Identifier: string; DataSetArn: string }) => {
        if (ds.DataSetArn) {
          const datasetId = ds.DataSetArn.split('/').pop();
          if (datasetId && !datasetIds.includes(datasetId)) {
            datasetIds.push(datasetId);
          }
        }
      });
    }

    if (datasetIds.length > 0) {
      lineageData.datasetIds = datasetIds;
    }

    return lineageData;
  }
}
