/**
 * The new data prep experience, read as the transforms the portal already knows.
 *
 * QuickSight now has two ways to describe what a dataset does to its data.
 * A legacy dataset keeps its steps in `LogicalTableMap[].DataTransforms`. One
 * built in the new data prep experience keeps them in
 * `DataPrepConfiguration.TransformStepMap`, and the two cannot be mixed: a
 * dataset is one or the other, and a new one cannot be written back as legacy.
 *
 * The saving grace is that the steps wrap the same operations, so the portal
 * does not need a second parser. This flattens the new map into the legacy
 * transform list, where a step that carries several renames or casts becomes
 * one legacy entry each, and everything downstream (calculated fields, renames,
 * type casts, the field catalog, search, lineage) keeps working unchanged.
 *
 * Without this, a dataset built in the new experience looks like a dataset with
 * no calculated fields at all, which is quietly worse than an error.
 */

export interface LegacyTransform {
  CreateColumnsOperation?: { Columns?: any[] };
  RenameColumnOperation?: { ColumnName?: string; NewColumnName?: string };
  CastColumnTypeOperation?: { ColumnName?: string; NewColumnType?: string };
  TagColumnOperation?: Record<string, any>;
  [key: string]: any;
}

/** True when the dataset was built in the new data prep experience. */
export function isNewDataPrep(definition: any): boolean {
  return Boolean(definition?.DataPrepConfiguration);
}

function stepTransforms(step: any): LegacyTransform[] {
  if (!step || typeof step !== 'object') {
    return [];
  }
  const out: LegacyTransform[] = [];
  if (Array.isArray(step.CreateColumnsStep?.Columns)) {
    out.push({ CreateColumnsOperation: { Columns: step.CreateColumnsStep.Columns } });
  }
  for (const rename of step.RenameColumnsStep?.RenameColumnOperations ?? []) {
    out.push({ RenameColumnOperation: rename });
  }
  for (const cast of step.CastColumnTypesStep?.CastColumnTypeOperations ?? []) {
    out.push({ CastColumnTypeOperation: cast });
  }
  return out;
}

/**
 * The datasets a new-experience dataset is built on. A legacy composite names
 * its parents on the logical tables; a new one names them on its source tables,
 * so without this a composite built in the new experience looks like it came
 * from nowhere.
 */
export function parentDataSetArnsOf(definition: any): string[] {
  const sources = Object.values(definition?.DataPrepConfiguration?.SourceTableMap ?? {}) as any[];
  return sources
    .map((source) => source?.DataSet?.DataSetArn)
    .filter((arn) => typeof arn === 'string');
}

/**
 * Every transform the dataset applies, from whichever experience it was built
 * in, in the legacy shape. Order follows the maps as QuickSight returned them,
 * which is the order the steps run in.
 */
export function dataTransformsOf(definition: any): LegacyTransform[] {
  const transforms: LegacyTransform[] = [];
  for (const logicalTable of Object.values(definition?.LogicalTableMap ?? {}) as any[]) {
    for (const transform of logicalTable?.DataTransforms ?? []) {
      transforms.push(transform);
    }
  }
  for (const step of Object.values(definition?.DataPrepConfiguration?.TransformStepMap ?? {})) {
    transforms.push(...stepTransforms(step));
  }
  return transforms;
}
