/**
 * UpdateDataSet replaces the whole specification, so an edit is a describe,
 * a patch, and everything described sent back. This is the "everything":
 * one list of what a described dataset carries, so no editor drops a part
 * (row-level security, the new data prep configuration...) by forgetting it.
 */
import { ValidationError } from '../../errors/ValidationError';
import { logger } from '../../utils/logger';
import type { QuickSightService } from './QuickSightService';

const CANNOT_DESCRIBE =
  'Could not load this dataset from QuickSight. Uploaded (flat file) datasets have no ' +
  'queryable specification, so they cannot be changed here.';

/**
 * The dataset as QuickSight holds it now, for an edit: live, never the
 * cache, and refused plainly when it cannot be described (a flat-file
 * upload has no specification to resend).
 */
export async function describeDataSetForEdit(
  quickSightService: QuickSightService,
  dataSetId: string
): Promise<Record<string, any>> {
  let described: Record<string, any> | undefined;
  try {
    described = await quickSightService.describeDataset(dataSetId);
  } catch (error) {
    logger.warn('DescribeDataSet failed', { dataSetId, error });
  }
  if (!described?.PhysicalTableMap || !described?.ImportMode) {
    throw new ValidationError(CANNOT_DESCRIBE);
  }
  return described;
}

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
