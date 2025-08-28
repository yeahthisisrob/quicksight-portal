import { BaseAssetRestoreStrategy } from './BaseAssetRestoreStrategy';
import type { AssetExportData } from '../../../../../../shared/models/asset-export.model';
import { logger } from '../../../../../../shared/utils/logger';
import type { ValidationResult } from '../../types';

/**
 * Dataset-specific restore strategy
 */
export class DatasetRestoreStrategy extends BaseAssetRestoreStrategy {
  /**
   * Delete existing dataset
   */
  public async deleteExisting(assetId: string): Promise<void> {
    await this.handleDeletion(assetId, () => this.quickSightService.deleteDataset(assetId));
  }

  /**
   * Restore dataset to QuickSight
   */
  public async restore(
    assetId: string,
    assetData: AssetExportData
  ): Promise<{ arn?: string; [key: string]: any }> {
    const datasetData = this.extractDatasetData(assetData);

    this.validateRequiredData(assetId, datasetData.physicalTableMap, 'PhysicalTableMap');

    this.logRestoreOperation(assetId, {
      name: datasetData.name,
      importMode: datasetData.importMode,
      hasPhysicalTableMap: !!datasetData.physicalTableMap,
      hasLogicalTableMap: !!datasetData.logicalTableMap,
      permissionCount: datasetData.permissions.length,
      tagCount: datasetData.tags.length,
    });

    const result = await this.quickSightService.createDataSet({
      dataSetId: assetId,
      name: datasetData.name,
      physicalTableMap: datasetData.physicalTableMap,
      logicalTableMap: datasetData.logicalTableMap,
      importMode: datasetData.importMode as 'SPICE' | 'DIRECT_QUERY',
      permissions: datasetData.permissions,
      ...this.getTagsForApi(datasetData.tags),
      columnGroups: datasetData.columnGroups,
      fieldFolders: datasetData.fieldFolders,
      rowLevelPermissionDataSet: datasetData.rowLevelPermissionDataSet,
      rowLevelPermissionTagConfiguration: datasetData.rowLevelPermissionTagConfiguration,
      columnLevelPermissionRules: datasetData.columnLevelPermissionRules,
      dataSetUsageConfiguration: datasetData.dataSetUsageConfiguration,
    });

    // For composite datasets, refresh child datasets to recreate internal QuickSight IDs
    await this.refreshChildDatasetsForComposite(assetId, assetData);

    return result;
  }

  /**
   * Validate dataset dependencies (datasources and other datasets for composite)
   */
  protected async validateDependencies(
    assetId: string,
    assetData: AssetExportData
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    // Check datasource dependencies
    const datasourceIds = this.extractDatasourceIds(assetData);
    for (const datasourceId of datasourceIds) {
      const exists = await this.assetExists('datasource', datasourceId);
      if (!exists) {
        results.push({
          validator: 'dependencies',
          passed: false,
          message: `Required datasource ${datasourceId} not found`,
          severity: 'warning',
          details: { assetId, datasourceId },
        });
      }
    }

    // Check composite dataset dependencies
    const referencedDatasetIds = this.extractReferencedDatasetIds(assetData);
    for (const datasetId of referencedDatasetIds) {
      const exists = await this.assetExists('dataset', datasetId);
      if (!exists) {
        results.push({
          validator: 'dependencies',
          passed: false,
          message: `Required dataset ${datasetId} not found (composite dataset dependency)`,
          severity: 'warning',
          details: { assetId, datasetId, type: 'composite' },
        });
      }
    }

    return results;
  }

  /**
   * Extract dataset-specific data from export
   */
  private extractDatasetData(assetData: AssetExportData): {
    name: string;
    permissions: any[];
    tags: any[];
    physicalTableMap: any;
    logicalTableMap?: any;
    importMode: string;
    columnGroups?: any;
    fieldFolders?: any;
    rowLevelPermissionDataSet?: any;
    rowLevelPermissionTagConfiguration?: any;
    columnLevelPermissionRules?: any;
    dataSetUsageConfiguration?: any;
  } {
    const basic = this.extractBasicMetadata(assetData);
    const describe = assetData.apiResponses?.describe?.data || {};

    return {
      ...basic,
      physicalTableMap: describe.PhysicalTableMap,
      logicalTableMap: describe.LogicalTableMap,
      importMode: (describe.ImportMode || 'SPICE') as 'SPICE' | 'DIRECT_QUERY',
      columnGroups: describe.ColumnGroups,
      fieldFolders: describe.FieldFolders,
      rowLevelPermissionDataSet: describe.RowLevelPermissionDataSet,
      rowLevelPermissionTagConfiguration: describe.RowLevelPermissionTagConfiguration,
      columnLevelPermissionRules: describe.ColumnLevelPermissionRules,
      dataSetUsageConfiguration: describe.DataSetUsageConfiguration,
    };
  }

  /**
   * Extract dataset IDs referenced by composite datasets
   */
  private extractReferencedDatasetIds(assetData: any): string[] {
    const datasetIds: string[] = [];

    // Handle nested structure from archived data
    const actualData = assetData.apiResponses?.describe?.data || assetData;

    // Check LogicalTableMap for dataset references
    if (actualData.LogicalTableMap) {
      Object.values(actualData.LogicalTableMap).forEach((table: any) => {
        // Check for dataset references in Source
        if (table.Source?.DataSetArn) {
          const datasetId = table.Source.DataSetArn.split('/').pop();
          if (datasetId && !datasetIds.includes(datasetId)) {
            datasetIds.push(datasetId);
          }
        }

        // Also check JoinInstruction for any dataset references
        if (table.Source?.JoinInstruction) {
          // The operands reference other logical tables, not datasets directly
          // So we need to look them up in the same LogicalTableMap
          const checkOperand = (operandName: string): void => {
            const operandTable = actualData.LogicalTableMap[operandName];
            if (operandTable?.Source?.DataSetArn) {
              const datasetId = operandTable.Source.DataSetArn.split('/').pop();
              if (datasetId && !datasetIds.includes(datasetId)) {
                datasetIds.push(datasetId);
              }
            }
          };

          if (table.Source.JoinInstruction.LeftOperand) {
            checkOperand(table.Source.JoinInstruction.LeftOperand);
          }
          if (table.Source.JoinInstruction.RightOperand) {
            checkOperand(table.Source.JoinInstruction.RightOperand);
          }
        }
      });
    }

    // Also check PhysicalTableMap for dataset references (composite datasets)
    if (actualData.PhysicalTableMap) {
      Object.values(actualData.PhysicalTableMap).forEach((table: any) => {
        // Handle dataset sources (composite datasets)
        if (table.DataSetArn) {
          const datasetId = table.DataSetArn.split('/').pop();
          if (datasetId && !datasetIds.includes(datasetId)) {
            datasetIds.push(datasetId);
          }
        }
      });
    }

    return datasetIds;
  }

  /**
   * Refresh child datasets for composite datasets to recreate internal QuickSight IDs
   */
  private async refreshChildDatasetsForComposite(
    parentDatasetId: string,
    assetData: any
  ): Promise<void> {
    try {
      // Extract child dataset IDs
      const childDatasetIds = this.extractReferencedDatasetIds(assetData);

      if (childDatasetIds.length === 0) {
        return; // Not a composite dataset
      }

      logger.info(
        `Composite dataset ${parentDatasetId} restored, refreshing ${childDatasetIds.length} child datasets`
      );

      // For each child dataset, we need to call UpdateDataSet with its current configuration
      for (const childDatasetId of childDatasetIds) {
        try {
          // Get the current dataset configuration
          const childDataset = await this.quickSightService.describeDataset(childDatasetId);
          if (!childDataset || !childDataset.DataSet) {
            logger.warn(`Could not describe child dataset ${childDatasetId}, skipping refresh`);
            continue;
          }

          const dataSet = childDataset.DataSet;

          // Call UpdateDataSet with the same configuration to refresh internal IDs
          logger.info(
            `Refreshing child dataset ${childDatasetId} to recreate internal QuickSight IDs`
          );

          await this.quickSightService.updateDataSet({
            dataSetId: childDatasetId,
            name: dataSet.Name,
            physicalTableMap: dataSet.PhysicalTableMap,
            logicalTableMap: dataSet.LogicalTableMap,
            importMode: dataSet.ImportMode,
            columnGroups: dataSet.ColumnGroups,
            fieldFolders: dataSet.FieldFolders,
            rowLevelPermissionDataSet: dataSet.RowLevelPermissionDataSet,
            rowLevelPermissionTagConfiguration: dataSet.RowLevelPermissionTagConfiguration,
            columnLevelPermissionRules: dataSet.ColumnLevelPermissionRules,
            dataSetUsageConfiguration: dataSet.DataSetUsageConfiguration,
          });

          logger.info(`Successfully refreshed child dataset ${childDatasetId}`);
        } catch (error) {
          logger.error(`Failed to refresh child dataset ${childDatasetId}:`, error);
          // Continue with other datasets even if one fails
        }
      }
    } catch (error) {
      logger.error(
        `Error refreshing child datasets for composite dataset ${parentDatasetId}:`,
        error
      );
      // Don't fail the entire restore if child refresh fails
    }
  }
}
