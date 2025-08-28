import {
  BaseAssetParser,
  type ParserCapabilities,
  type CalculatedField,
  type Field,
} from './BaseAssetParser';
import { type AssetExportData } from '../../models/asset-export.model';
import { ASSET_TYPES } from '../../types/assetTypes';

/**
 * Dataset metadata extracted from API responses
 */
export interface DatasetMetadata {
  assetId: string;
  name: string;
  arn: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  importMode?: string;
  consumedSpiceCapacityInBytes?: number;
  rowCount?: number;
  fieldCount: number;
  datasourceArns?: string[];
  fields?: any[];
  calculatedFields?: any[];
  lineageData?: any;
  refreshData?: {
    hasRefreshProperties: boolean;
    dataSetRefreshProperties?: any;
    refreshScheduleCount: number;
    refreshSchedules?: any;
  };
}

/**
 * Dataset-specific parser implementation
 */
export class DatasetParser extends BaseAssetParser {
  public readonly assetType = ASSET_TYPES.dataset;

  public readonly capabilities: ParserCapabilities = {
    hasDataSets: false, // Datasets don't reference other datasets
    hasCalculatedFields: true,
    hasParameters: false,
    hasFilters: false,
    hasSheets: false,
    hasVisuals: false,
    hasFields: true,
    hasDatasourceInfo: true,
  };

  /**
   * Extract comprehensive dataset metadata from individual data components
   */
  public extractDatasetMetadata(
    listData: any,
    describeData: any,
    refreshSchedulesData?: any,
    refreshPropertiesData?: any
  ): DatasetMetadata {
    const definition = describeData ? this.extractDefinition(describeData) : null;
    const fields = definition ? this.parseFields(definition) : [];
    const calculatedFields = definition ? this.parseCalculatedFields(definition) : [];

    const metadata = this.buildBaseMetadata(listData, describeData, fields);

    // Add field-related metadata
    this.addFieldMetadata(metadata, definition, fields, calculatedFields);

    // Add refresh data if available
    if (refreshSchedulesData || refreshPropertiesData) {
      metadata.refreshData = this.extractRefreshData(refreshSchedulesData, refreshPropertiesData);
    }

    return metadata;
  }

  /**
   * Extract definition from dataset response
   */
  protected override extractDefinition(datasetDefinition: any): any {
    return datasetDefinition;
  }

  /**
   * Extract comprehensive dataset metadata from API responses and transformed data
   */
  public extractMetadata(assetData: AssetExportData): DatasetMetadata {
    const listData = assetData.apiResponses?.list?.data;
    const describeData = assetData.apiResponses?.describe?.data;
    const refreshSchedulesData = assetData.apiResponses?.refreshSchedules?.data;
    const refreshPropertiesData = assetData.apiResponses?.dataSetRefreshProperties?.data;

    return this.extractDatasetMetadata(
      listData,
      describeData,
      refreshSchedulesData,
      refreshPropertiesData
    );
  }

  /**
   * Extract refresh schedule data from dataset
   */
  public extractRefreshData(
    refreshSchedulesData?: any,
    refreshPropertiesData?: any
  ): DatasetMetadata['refreshData'] {
    const refreshData: NonNullable<DatasetMetadata['refreshData']> = {
      hasRefreshProperties: false,
      refreshScheduleCount: 0,
    };

    // Include actual refresh properties
    if (refreshPropertiesData) {
      refreshData.hasRefreshProperties = true;
      refreshData.dataSetRefreshProperties = refreshPropertiesData;
    }

    // Include actual refresh schedules
    if (refreshSchedulesData) {
      refreshData.refreshScheduleCount = Array.isArray(refreshSchedulesData)
        ? refreshSchedulesData.length
        : 0;
      refreshData.refreshSchedules = refreshSchedulesData;
    }

    return refreshData;
  }

  /**
   * Parse calculated fields from dataset definition
   */
  protected override parseCalculatedFields(definition: any): CalculatedField[] {
    if (!definition.LogicalTableMap) {
      return [];
    }

    const calculatedFields: CalculatedField[] = [];

    Object.values(definition.LogicalTableMap).forEach((logicalTable: any) => {
      if (logicalTable.DataTransforms) {
        logicalTable.DataTransforms.forEach((transform: any) => {
          if (transform.CreateColumnsOperation?.Columns) {
            transform.CreateColumnsOperation.Columns.forEach((col: any) => {
              if (this.isValidFieldName(col.ColumnName) && col.Expression) {
                calculatedFields.push({
                  name: col.ColumnName,
                  expression: col.Expression,
                });
              }
            });
          }
        });
      }
    });

    return calculatedFields;
  }

  /**
   * Parse fields from dataset definition
   */
  protected override parseFields(definition: any): Field[] {
    const fields: Field[] = [];

    // First priority: Use OutputColumns if available (these have the final transformed field names and types)
    if (definition.OutputColumns && definition.OutputColumns.length > 0) {
      definition.OutputColumns.forEach((col: any) => {
        if (this.isValidFieldName(col.Name)) {
          fields.push({
            fieldId: col.Name,
            fieldName: col.Name,
            name: col.Name,
            dataType: col.Type,
            type: col.Type,
          });
        }
      });

      // If we got fields from OutputColumns, return them (they're the most accurate)
      if (fields.length > 0) {
        // Parsing completed - found fields from OutputColumns
        return fields;
      }
    }

    // Extract physical table fields
    if (definition.PhysicalTableMap) {
      Object.values(definition.PhysicalTableMap).forEach((table: any) => {
        if (table.RelationalTable?.Columns) {
          table.RelationalTable.Columns.forEach((col: any) => {
            if (this.isValidFieldName(col.Name)) {
              fields.push({
                fieldId: col.Name,
                fieldName: col.Name,
                name: col.Name,
                dataType: col.Type,
                type: col.Type,
              });
            }
          });
        } else if (table.CustomSql?.Columns) {
          table.CustomSql.Columns.forEach((col: any) => {
            if (this.isValidFieldName(col.Name)) {
              fields.push({
                fieldId: col.Name,
                fieldName: col.Name,
                name: col.Name,
                dataType: col.Type,
                type: col.Type,
              });
            }
          });
        } else if (table.S3Source?.InputColumns) {
          // Handle S3 source columns
          table.S3Source.InputColumns.forEach((col: any) => {
            if (this.isValidFieldName(col.Name)) {
              fields.push({
                fieldId: col.Name,
                fieldName: col.Name,
                name: col.Name,
                dataType: col.Type,
                type: col.Type,
              });
            }
          });
        }
      });
    }

    // Extract logical table fields (transformed columns)
    if (definition.LogicalTableMap) {
      Object.values(definition.LogicalTableMap).forEach((logicalTable: any) => {
        if (logicalTable.DataTransforms) {
          logicalTable.DataTransforms.forEach((transform: any) => {
            // Cast operations
            if (transform.CastColumnTypeOperation) {
              const col = transform.CastColumnTypeOperation;
              if (this.isValidFieldName(col.ColumnName)) {
                // Find existing field and update its type
                const existingField = fields.find((f) => f.fieldName === col.ColumnName);
                if (existingField) {
                  existingField.dataType = col.NewColumnType;
                  existingField.type = col.NewColumnType;
                }
              }
            }

            // Rename operations
            if (transform.RenameColumnOperation) {
              const col = transform.RenameColumnOperation;
              if (
                this.isValidFieldName(col.ColumnName) &&
                this.isValidFieldName(col.NewColumnName)
              ) {
                const existingField = fields.find((f) => f.fieldName === col.ColumnName);
                if (existingField) {
                  existingField.fieldName = col.NewColumnName;
                  existingField.name = col.NewColumnName;
                  existingField.fieldId = col.NewColumnName;
                }
              }
            }

            // Tag operations (for field metadata)
            if (transform.TagColumnOperation) {
              const col = transform.TagColumnOperation;
              if (this.isValidFieldName(col.ColumnName)) {
                const existingField = fields.find((f) => f.fieldName === col.ColumnName);
                if (existingField) {
                  // Could add tag information to field metadata here
                }
              }
            }
          });
        }
      });
    }

    // Parsing completed - found fields from table maps

    return fields;
  }

  /**
   * Add datasource information to collections
   */
  private addDatasourceInfo(
    arn: string,
    physicalTable: any | null,
    datasourceArns: string[],
    datasourceIds: string[],
    fieldName: string | null
  ): void {
    if (physicalTable && fieldName) {
      physicalTable[fieldName] = arn;
    }
    datasourceArns.push(arn);
    const datasourceId = arn.split('/').pop();
    if (datasourceId) {
      datasourceIds.push(datasourceId);
    }
  }

  /**
   * Add field-related metadata
   */
  private addFieldMetadata(
    metadata: DatasetMetadata,
    definition: any,
    fields: Field[],
    calculatedFields: CalculatedField[]
  ): void {
    // Extract datasource ARNs for cache service to resolve actual datasource types
    metadata.datasourceArns = this.extractDatasourceArns(definition);
    // Include parsed fields for field extraction
    metadata.fields = this.transformFieldsForCache(fields);
    metadata.calculatedFields = this.transformCalculatedFieldsForCache(calculatedFields);
    // Extract lineage data
    metadata.lineageData = this.extractLineageData(definition);
  }

  /**
   * Build base metadata from list and describe data
   */
  private buildBaseMetadata(listData: any, describeData: any, fields: Field[]): DatasetMetadata {
    return {
      assetId: listData?.DataSetId || describeData?.DataSetId,
      name: listData?.Name || describeData?.Name,
      arn: listData?.Arn || describeData?.Arn,
      createdTime: listData?.CreatedTime || describeData?.CreatedTime,
      lastUpdatedTime: listData?.LastUpdatedTime || describeData?.LastUpdatedTime,
      importMode: listData?.ImportMode || describeData?.ImportMode,
      consumedSpiceCapacityInBytes:
        listData?.ConsumedSpiceCapacityInBytes || describeData?.ConsumedSpiceCapacityInBytes,
      rowCount: describeData?.RowLevelPermissionDataSet?.RowCount,
      fieldCount: fields.length,
    };
  }

  /**
   * Build physical table object
   */
  private buildPhysicalTable(tableId: string, tableData: any): any {
    return {
      tableId,
      type: tableData.S3Source
        ? 'S3'
        : tableData.RelationalTable
          ? 'RELATIONAL'
          : tableData.CustomSql
            ? 'CUSTOM_SQL'
            : 'UNKNOWN',
    };
  }

  /**
   * Extract datasource ARNs for cache service lookup
   */
  private extractDatasourceArns(definition: any): string[] {
    if (!definition?.PhysicalTableMap) {
      return [];
    }

    const datasourceArns: string[] = [];
    for (const table of Object.values(definition.PhysicalTableMap)) {
      const tableData = table as any;
      if (tableData?.RelationalTable?.DataSourceArn) {
        datasourceArns.push(tableData.RelationalTable.DataSourceArn);
      } else if (tableData?.CustomSql?.DataSourceArn) {
        datasourceArns.push(tableData.CustomSql.DataSourceArn);
      } else if (tableData?.S3Source?.DataSourceArn) {
        datasourceArns.push(tableData.S3Source.DataSourceArn);
      }
    }

    return [...new Set(datasourceArns)]; // Remove duplicates
  }

  /**
   * Extract lineage data including datasource and dataset relationships
   */
  private extractLineageData(definition: any): any {
    if (!definition) {
      return undefined;
    }

    const datasourceArns: string[] = [];
    const datasourceIds: string[] = [];
    const lineageData: any = {
      datasourceIds: [],
      datasourceArns: [],
      physicalTables: [],
      logicalTables: [],
    };

    // Extract physical table information
    if (definition.PhysicalTableMap) {
      this.extractPhysicalTables(
        definition.PhysicalTableMap,
        lineageData,
        datasourceArns,
        datasourceIds
      );
    }

    // Extract logical table information
    if (definition.LogicalTableMap) {
      this.extractLogicalTables(definition.LogicalTableMap, lineageData);
    }

    // Set datasourceIds and datasourceArns to unique lists
    lineageData.datasourceIds = [...new Set(datasourceIds)];
    lineageData.datasourceArns = [...new Set(datasourceArns)];

    // Return undefined if no lineage data found (allows fuzzy matching for flat files)
    if (lineageData.datasourceIds.length === 0 && lineageData.physicalTables.length === 0) {
      return undefined;
    }

    return lineageData;
  }

  /**
   * Extract logical table information
   */
  private extractLogicalTables(logicalTableMap: any, lineageData: any): void {
    for (const [tableId, table] of Object.entries(logicalTableMap)) {
      const tableData = table as any;
      lineageData.logicalTables.push({
        tableId,
        source: tableData.Source,
        alias: tableData.Alias,
        dataTransforms: tableData.DataTransforms?.length || 0,
      });
    }
  }

  /**
   * Extract physical table information
   */
  private extractPhysicalTables(
    physicalTableMap: any,
    lineageData: any,
    datasourceArns: string[],
    datasourceIds: string[]
  ): void {
    for (const [tableId, table] of Object.entries(physicalTableMap)) {
      const tableData = table as any;
      const physicalTable = this.buildPhysicalTable(tableId, tableData);

      // Process datasource information based on table type
      this.processDatasourceInfo(tableData, physicalTable, datasourceArns, datasourceIds);

      lineageData.physicalTables.push(physicalTable);
    }
  }

  /**
   * Process datasource information for a physical table
   */
  private processDatasourceInfo(
    tableData: any,
    physicalTable: any,
    datasourceArns: string[],
    datasourceIds: string[]
  ): void {
    if (tableData.RelationalTable?.DataSourceArn) {
      this.addDatasourceInfo(
        tableData.RelationalTable.DataSourceArn,
        physicalTable,
        datasourceArns,
        datasourceIds,
        'datasourceArn'
      );
    } else if (tableData.CustomSql?.DataSourceArn) {
      this.addDatasourceInfo(
        tableData.CustomSql.DataSourceArn,
        physicalTable,
        datasourceArns,
        datasourceIds,
        'datasourceArn'
      );
    } else if (tableData.S3Source) {
      physicalTable.s3Source = {
        dataSourceArn: tableData.S3Source.DataSourceArn,
        inputColumns: tableData.S3Source.InputColumns?.length || 0,
      };
      if (tableData.S3Source.DataSourceArn) {
        this.addDatasourceInfo(
          tableData.S3Source.DataSourceArn,
          null,
          datasourceArns,
          datasourceIds,
          null
        );
      }
    }
  }

  /**
   * Transform calculated fields for cache storage
   */
  private transformCalculatedFieldsForCache(calculatedFields: CalculatedField[]): any[] {
    return calculatedFields.map((field) => ({
      name: field.name,
      expression: field.expression,
    }));
  }

  /**
   * Transform parsed fields for cache storage
   */
  private transformFieldsForCache(fields: Field[]): any[] {
    return fields.map((field) => ({
      fieldId: field.fieldId,
      fieldName: field.fieldName,
      name: field.name,
      dataType: field.dataType,
      type: field.type,
    }));
  }
}
