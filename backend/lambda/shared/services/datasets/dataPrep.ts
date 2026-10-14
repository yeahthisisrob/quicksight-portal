/**
 * The new data prep experience, written. QuickSight now builds every dataset
 * as a pipeline: source tables (the physical tables), transform steps that
 * each name the step they read from, destination tables, and a semantic
 * model over them. The legacy shape, one LogicalTableMap with the transforms
 * inline, is deprecated, cannot be opened in the new data prep, and cannot
 * be the parent of a new-experience dataset.
 *
 * Two writers share this file: a dataset from nothing (one table, projected)
 * and the migration of a legacy dataset, which turns its logical tables into
 * the same pipeline. Pure functions: a spec in, a spec out, and a list of
 * what could not be carried so the caller can refuse before anything is
 * written.
 */
import { randomUUID } from 'node:crypto';

export interface DataPrepSpec {
  dataPrepConfiguration: Record<string, any>;
  semanticModelConfiguration: Record<string, any>;
}

export interface LegacyConversion extends DataPrepSpec {
  /** What the pipeline carries, in words, for a preview. */
  carried: string[];
  /** Legacy details that have no place in the new shape and were left behind. */
  dropped: string[];
  /** Why the conversion cannot be written; empty when it can. */
  refused: string[];
}

/** The column lists a physical table declares, by kind. */
const COLUMN_LISTS = ['InputColumns', 'Columns'] as const;

/**
 * The physical tables with an `Id` on every column. The new experience
 * refuses a column without one ("must have a valid id"); legacy datasets
 * never had them. Ids already present are kept, since steps may map them.
 */
export function withColumnIds(
  physicalTableMap: Record<string, any>,
  id: () => string = randomUUID
): Record<string, any> {
  const out = structuredClone(physicalTableMap ?? {});
  for (const table of Object.values(out) as Array<Record<string, any>>) {
    for (const kind of Object.values(table) as Array<Record<string, any>>) {
      for (const list of COLUMN_LISTS) {
        if (Array.isArray(kind?.[list])) {
          kind[list] = kind[list].map((column: Record<string, any>) =>
            column?.Id ? column : { Id: id(), ...column }
          );
        }
      }
    }
  }
  return out;
}

/** QuickSight allows 64 characters for an alias. */
const ALIAS_MAX = 64;

const alias = (value: unknown, fallback: string): string => {
  const text = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return text.slice(0, ALIAS_MAX);
};

/**
 * One physical table, every column projected: what a dataset from nothing
 * is. Ids are injectable so a test can read the pipeline it builds.
 */
export function dataPrepForTable(
  input: { physicalTableId: string; alias: string; columns: string[] },
  id: () => string = randomUUID
): DataPrepSpec {
  const sourceId = id();
  const importId = id();
  const projectId = id();
  const destinationId = id();
  const name = alias(input.alias, 'table');
  return {
    dataPrepConfiguration: {
      SourceTableMap: { [sourceId]: { PhysicalTableId: input.physicalTableId } },
      TransformStepMap: {
        [importId]: { ImportTableStep: { Alias: name, Source: { SourceTableId: sourceId } } },
        [projectId]: {
          ProjectStep: {
            Alias: 'Columns',
            ProjectedColumns: input.columns,
            Source: { TransformOperationId: importId },
          },
        },
      },
      DestinationTableMap: {
        [destinationId]: { Alias: name, Source: { TransformOperationId: projectId } },
      },
    },
    semanticModelConfiguration: {
      TableMap: { [id()]: { Alias: name, DestinationTableId: destinationId } },
    },
  };
}

interface ColumnSemantics {
  Description?: { Text: string };
  SemanticType?: { GeographicalRole: string };
}

/**
 * A legacy dataset as the new pipeline. Every logical table becomes a chain
 * of steps (import or join, then each transform in order); the one table
 * nothing joins is the destination. Column tags (descriptions, geographic
 * roles) move to the semantic model, where the new experience keeps them.
 * Anything the new shape cannot hold is named in `refused`, so the caller
 * writes nothing rather than a dataset missing a part.
 */
export function dataPrepFromLegacy(
  described: Record<string, any>,
  id: () => string = randomUUID
): LegacyConversion {
  const logical: Record<string, any> = described.LogicalTableMap ?? {};
  const sourceTables: Record<string, any> = {};
  const steps: Record<string, any> = {};
  const semantics = new Map<string, ColumnSemantics>();
  const carried: string[] = [];
  const dropped: string[] = [];
  const refused: string[] = [];
  const joined = new Set<string>();
  for (const table of Object.values(logical)) {
    const join = table?.Source?.JoinInstruction;
    if (join?.LeftOperand) joined.add(join.LeftOperand);
    if (join?.RightOperand) joined.add(join.RightOperand);
  }
  const roots = Object.keys(logical).filter((key) => !joined.has(key));
  if (roots.length === 0) {
    refused.push('The dataset has no logical table to build the pipeline from.');
  } else if (roots.length > 1) {
    refused.push(
      `The dataset has ${roots.length} top-level logical tables (${roots.join(', ')}); the new shape has one destination.`
    );
  }

  const counted = { steps: 0, joins: 0, fields: 0, renames: 0, casts: 0, filters: 0 };
  const chainOf = (key: string): string | undefined => {
    const table = logical[key];
    if (!table) {
      refused.push(`A join names logical table '${key}', which the dataset does not have.`);
      return undefined;
    }
    const tableAlias = alias(table.Alias, key);
    let last: string | undefined;
    const source = table.Source ?? {};
    if (source.PhysicalTableId) {
      const sourceId = id();
      sourceTables[sourceId] = { PhysicalTableId: source.PhysicalTableId };
      last = id();
      steps[last] = { ImportTableStep: { Alias: tableAlias, Source: { SourceTableId: sourceId } } };
    } else if (source.JoinInstruction) {
      const join = source.JoinInstruction;
      const left = chainOf(join.LeftOperand);
      const right = chainOf(join.RightOperand);
      if (!left || !right) return undefined;
      last = id();
      steps[last] = {
        JoinStep: {
          Alias: tableAlias,
          LeftOperand: { TransformOperationId: left },
          RightOperand: { TransformOperationId: right },
          Type: join.Type,
          OnClause: join.OnClause,
        },
      };
      counted.joins += 1;
      if (join.LeftJoinKeyProperties?.UniqueKey || join.RightJoinKeyProperties?.UniqueKey) {
        dropped.push(
          `The unique-key hint on the join '${tableAlias}': the new shape has no such property.`
        );
      }
    } else if (source.DataSetArn) {
      refused.push(
        `'${tableAlias}' is built on another dataset (${source.DataSetArn}). A new-experience dataset can only be built on new-experience parents, so migrate the parent first and rebuild this one on it.`
      );
      return undefined;
    } else {
      refused.push(`'${tableAlias}' has no source the pipeline can import from.`);
      return undefined;
    }

    const transforms: any[] = Array.isArray(table.DataTransforms) ? table.DataTransforms : [];
    const add = (step: Record<string, any>): void => {
      const stepId = id();
      steps[stepId] = step;
      last = stepId;
      counted.steps += 1;
    };
    const from = () => ({ Source: { TransformOperationId: last } });
    for (const transform of transforms) {
      const [kind] = Object.keys(transform ?? {});
      const body = kind ? transform[kind] : undefined;
      switch (kind) {
        case 'ProjectOperation':
          add({
            ProjectStep: { Alias: 'Columns', ProjectedColumns: body.ProjectedColumns, ...from() },
          });
          break;
        case 'CreateColumnsOperation':
          add({
            CreateColumnsStep: { Alias: 'Calculated fields', Columns: body.Columns, ...from() },
          });
          counted.fields += (body.Columns ?? []).length;
          break;
        case 'RenameColumnOperation': {
          const previous = steps[last as string]?.RenameColumnsStep;
          if (previous) {
            previous.RenameColumnOperations.push(body);
          } else {
            add({
              RenameColumnsStep: { Alias: 'Renames', RenameColumnOperations: [body], ...from() },
            });
          }
          counted.renames += 1;
          break;
        }
        case 'CastColumnTypeOperation': {
          const previous = steps[last as string]?.CastColumnTypesStep;
          if (previous) {
            previous.CastColumnTypeOperations.push(body);
          } else {
            add({
              CastColumnTypesStep: { Alias: 'Types', CastColumnTypeOperations: [body], ...from() },
            });
          }
          counted.casts += 1;
          break;
        }
        case 'FilterOperation':
          add({ FiltersStep: { Alias: 'Filters', FilterOperations: [body], ...from() } });
          counted.filters += 1;
          break;
        case 'TagColumnOperation': {
          const column = semantics.get(body.ColumnName) ?? {};
          for (const tag of body.Tags ?? []) {
            if (tag.ColumnDescription?.Text) {
              column.Description = { Text: tag.ColumnDescription.Text };
            }
            if (tag.ColumnGeographicRole) {
              column.SemanticType = { GeographicalRole: tag.ColumnGeographicRole };
            }
          }
          semantics.set(body.ColumnName, column);
          break;
        }
        case 'UntagColumnOperation': {
          const column = semantics.get(body.ColumnName);
          for (const name of body.TagNames ?? []) {
            if (name === 'COLUMN_DESCRIPTION') delete column?.Description;
            if (name === 'COLUMN_GEOGRAPHIC_ROLE') delete column?.SemanticType;
          }
          break;
        }
        default:
          refused.push(`'${tableAlias}' has a ${kind ?? 'transform'} the new shape cannot carry.`);
      }
    }
    return last;
  };

  const root = roots.length === 1 ? (roots[0] as string) : undefined;
  const end = root ? chainOf(root) : undefined;
  const rootAlias = root ? alias(logical[root]?.Alias, root) : 'table';
  const destinationId = id();
  const columnMetadata = [...semantics.entries()]
    .filter(([, props]) => props.Description || props.SemanticType)
    .map(([name, props]) => ({ ColumnNames: [name], ColumnProperties: [props] }));

  const rowLevel: Record<string, any> = {};
  if (described.RowLevelPermissionDataSet) {
    rowLevel.RowLevelPermissionDataSet = described.RowLevelPermissionDataSet;
    carried.push('row-level security');
  }
  if (described.RowLevelPermissionTagConfiguration) {
    rowLevel.TagConfiguration = described.RowLevelPermissionTagConfiguration;
    carried.push('row-level security tags');
  }

  carried.unshift(
    `${Object.keys(sourceTables).length} source table${Object.keys(sourceTables).length === 1 ? '' : 's'}`,
    ...(counted.joins ? [`${counted.joins} join${counted.joins === 1 ? '' : 's'}`] : []),
    ...(counted.fields
      ? [`${counted.fields} calculated field${counted.fields === 1 ? '' : 's'}`]
      : []),
    ...(counted.renames ? [`${counted.renames} rename${counted.renames === 1 ? '' : 's'}`] : []),
    ...(counted.casts ? [`${counted.casts} type cast${counted.casts === 1 ? '' : 's'}`] : []),
    ...(counted.filters ? [`${counted.filters} filter${counted.filters === 1 ? '' : 's'}`] : []),
    ...(columnMetadata.length
      ? [
          `descriptions and roles on ${columnMetadata.length} column${columnMetadata.length === 1 ? '' : 's'}`,
        ]
      : [])
  );

  return {
    dataPrepConfiguration: {
      SourceTableMap: sourceTables,
      TransformStepMap: steps,
      DestinationTableMap: end
        ? { [destinationId]: { Alias: rootAlias, Source: { TransformOperationId: end } } }
        : {},
    },
    semanticModelConfiguration: {
      TableMap: {
        [id()]: {
          Alias: rootAlias,
          DestinationTableId: destinationId,
          ...(Object.keys(rowLevel).length ? { RowLevelPermissionConfiguration: rowLevel } : {}),
          ...(columnMetadata.length
            ? { SemanticMetadata: { ColumnMetadata: columnMetadata } }
            : {}),
        },
      },
    },
    carried,
    dropped,
    refused,
  };
}
