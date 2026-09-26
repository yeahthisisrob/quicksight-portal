/**
 * UpdateDataSet replaces the whole specification, so an edit is a describe,
 * a patch, and everything described sent back. This is the "everything":
 * one list of what a described dataset carries, so no editor drops a part
 * (row-level security, the new data prep configuration...) by forgetting it.
 */
import type { QuickSightService } from './QuickSightService';

export function resendDataSet(
  quickSightService: QuickSightService,
  dataSetId: string,
  described: Record<string, any>,
  patch: { name?: string; physicalTableMap?: Record<string, any> } = {}
): Promise<unknown> {
  return quickSightService.updateDataSet({
    dataSetId,
    name: patch.name ?? described.Name,
    physicalTableMap: patch.physicalTableMap ?? described.PhysicalTableMap,
    logicalTableMap: described.LogicalTableMap,
    importMode: described.ImportMode,
    columnGroups: described.ColumnGroups,
    fieldFolders: described.FieldFolders,
    rowLevelPermissionDataSet: described.RowLevelPermissionDataSet,
    rowLevelPermissionTagConfiguration: described.RowLevelPermissionTagConfiguration,
    columnLevelPermissionRules: described.ColumnLevelPermissionRules,
    dataSetUsageConfiguration: described.DataSetUsageConfiguration,
    dataPrepConfiguration: described.DataPrepConfiguration,
    semanticModelConfiguration: described.SemanticModelConfiguration,
  });
}
