/**
 * A dataset's calculated fields, and the two edits that rename one without
 * breaking anything downstream.
 *
 * Dashboards and analyses read a dataset's columns by name, so a dataset
 * field cannot simply be renamed: every reader would lose it at once. The
 * rename is a migration instead, and these are its two dataset halves:
 *
 *   copy    add the field again under the new name, carrying what it
 *           carries (projections, descriptions, folders, column-level
 *           permissions, semantic metadata), so both names are served;
 *   retire  once no reader is left on the old name, remove it and point
 *           the dataset's own references (other fields' expressions) at
 *           the new one.
 *
 * Between the two, each reader is repointed (a same-dataset rebind).
 *
 * Both shapes a dataset can have are handled: the legacy LogicalTableMap
 * (CreateColumnsOperation, ProjectOperation, TagColumnOperation) and the new
 * data prep (DataPrepConfiguration steps, SemanticModelConfiguration). A
 * reference this module does not know how to carry (a join clause, a cast,
 * a geospatial group, a row-level tag rule...) refuses the edit and names
 * where it is, so a rename that could not finish never starts.
 *
 * Pure: a described dataset in, mutated in place (callers pass a clone).
 */
import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/ValidationError';
import { expressionColumns } from './definitionColumns';

export type DatasetShape = 'legacy' | 'dataPrep';

export interface DatasetCalculatedField {
  name: string;
  columnId: string;
  expression: string;
  /** The dataset's other calculated fields that read it. */
  readBy: string[];
  /** Named in a column-level permission rule. */
  restricted: boolean;
}

interface CalculatedColumn {
  ColumnName?: string;
  ColumnId?: string;
  Expression?: string;
}

type Spec = Record<string, any>;

/** How many unfollowable references a refusal names before "...". */
const PLACES_NAMED = 3;

/** The parts of a dataset UpdateDataSet sends that can name a column. */
const WRITTEN_PARTS = [
  'LogicalTableMap',
  'DataPrepConfiguration',
  'SemanticModelConfiguration',
  'FieldFolders',
  'ColumnGroups',
  'ColumnLevelPermissionRules',
  'RowLevelPermissionTagConfiguration',
] as const;

export function datasetShape(spec: Spec): DatasetShape {
  return spec.DataPrepConfiguration ? 'dataPrep' : 'legacy';
}

/** Every transform (legacy) or step (data prep), each as `{ OperationName: body }`. */
function operations(spec: Spec): Array<Record<string, any>> {
  if (datasetShape(spec) === 'dataPrep') {
    return Object.values(spec.DataPrepConfiguration?.TransformStepMap ?? {});
  }
  return Object.values(spec.LogicalTableMap ?? {}).flatMap((table: any) =>
    Array.isArray(table?.DataTransforms) ? table.DataTransforms : []
  );
}

const createOf = (op: Record<string, any>) => op.CreateColumnsOperation ?? op.CreateColumnsStep;
const projectOf = (op: Record<string, any>) => op.ProjectOperation ?? op.ProjectStep;

function columnLists(spec: Spec): CalculatedColumn[][] {
  return operations(spec)
    .map(createOf)
    .filter((create) => Array.isArray(create?.Columns))
    .map((create) => create.Columns as CalculatedColumn[]);
}

const allColumns = (spec: Spec) => columnLists(spec).flat();

function clpRules(spec: Spec): Array<{ ColumnNames?: string[] }> {
  return Array.isArray(spec.ColumnLevelPermissionRules) ? spec.ColumnLevelPermissionRules : [];
}

function semanticColumnMetadata(spec: Spec): Array<{ ColumnNames?: string[] }> {
  return Object.values(spec.SemanticModelConfiguration?.TableMap ?? {}).flatMap((table: any) =>
    Array.isArray(table?.SemanticMetadata?.ColumnMetadata)
      ? table.SemanticMetadata.ColumnMetadata
      : []
  );
}

const token = (name: string) => `{${name}}`;

export function datasetCalculatedFields(spec: Spec): DatasetCalculatedField[] {
  const columns = allColumns(spec).filter(
    (c): c is Required<CalculatedColumn> => typeof c.ColumnName === 'string'
  );
  const restricted = new Set(clpRules(spec).flatMap((r) => r.ColumnNames ?? []));
  return columns.map((column) => ({
    name: column.ColumnName,
    columnId: String(column.ColumnId ?? ''),
    expression: String(column.Expression ?? ''),
    readBy: columns
      .filter(
        (other) =>
          other !== column &&
          expressionColumns(String(other.Expression ?? '')).includes(column.ColumnName)
      )
      .map((other) => other.ColumnName),
    restricted: restricted.has(column.ColumnName),
  }));
}

function findField(
  spec: Spec,
  name: string
): { column: CalculatedColumn; list: CalculatedColumn[] } {
  for (const list of columnLists(spec)) {
    const column = list.find((c) => c.ColumnName === name);
    if (column) return { column, list };
  }
  throw new ValidationError(`The dataset has no calculated field ${name}`);
}

/** Where a name is still referenced in what UpdateDataSet sends: JSON paths. */
function referencesTo(spec: Spec, name: string): string[] {
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      if (node === name || node.includes(token(name))) found.push(path);
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
    }
  };
  for (const part of WRITTEN_PARTS) walk(spec[part], part);
  return found;
}

const without = (list: string[] | undefined, name: string) =>
  (list ?? []).filter((item) => item !== name);

/** Put `to` right after `name` wherever `name` is listed. */
function insertAfter(list: string[], name: string, to: string): void {
  const at = list.indexOf(name);
  if (at >= 0 && !list.includes(to)) list.splice(at + 1, 0, to);
}

/** Legacy column tags (descriptions, geographic roles) for a name, with where they sit. */
function tagOperations(spec: Spec, name: string) {
  if (datasetShape(spec) !== 'legacy') return [];
  return Object.values(spec.LogicalTableMap ?? {}).flatMap((table: any) =>
    (Array.isArray(table?.DataTransforms)
      ? (table.DataTransforms as Array<Record<string, any>>)
      : []
    )
      .filter((op) => (op.TagColumnOperation ?? op.UntagColumnOperation)?.ColumnName === name)
      .map((op) => ({ op, transforms: table.DataTransforms as Array<Record<string, any>> }))
  );
}

/**
 * Remove every reference to `name` this module knows how to carry, pointing
 * expressions at `replacedBy`. What is left afterwards is a reference it does
 * not know, and a rename through it would break the dataset.
 */
function removeKnownReferences(spec: Spec, name: string, replacedBy: string): void {
  const { column, list } = findField(spec, name);
  list.splice(list.indexOf(column), 1);
  for (const other of allColumns(spec)) {
    if (typeof other.Expression === 'string' && other.Expression.includes(token(name))) {
      other.Expression = other.Expression.split(token(name)).join(token(replacedBy));
    }
  }
  for (const op of operations(spec)) {
    const project = projectOf(op);
    if (Array.isArray(project?.ProjectedColumns)) {
      project.ProjectedColumns = without(project.ProjectedColumns, name);
    }
  }
  for (const { op, transforms } of tagOperations(spec, name)) {
    transforms.splice(transforms.indexOf(op), 1);
  }
  for (const folder of Object.values(spec.FieldFolders ?? {}) as Array<{ columns?: string[] }>) {
    if (Array.isArray(folder.columns)) folder.columns = without(folder.columns, name);
  }
  for (const rule of clpRules(spec)) rule.ColumnNames = without(rule.ColumnNames, name);
  for (const meta of semanticColumnMetadata(spec)) {
    if (Array.isArray(meta.ColumnNames)) meta.ColumnNames = without(meta.ColumnNames, name);
  }
}

function refuseUnknownReferences(spec: Spec, name: string, replacedBy: string, at: string): void {
  const probe = structuredClone(spec);
  removeKnownReferences(probe, name, replacedBy);
  // Positions shift in the probe, so name the kind of reference, not its index.
  const left = [...new Set(referencesTo(probe, name).map((p) => p.replace(/\[\d+\]/g, '')))];
  if (left.length > 0) {
    throw new ValidationError(
      `${at}: ${name} is also referenced where a rename cannot follow (${left.slice(0, PLACES_NAMED).join(', ')}${left.length > PLACES_NAMED ? ', ...' : ''})`
    );
  }
}

function outputNames(spec: Spec): Set<string> {
  const output = Array.isArray(spec.OutputColumns) ? spec.OutputColumns : [];
  return new Set(output.map((c: { Name?: string }) => c.Name).filter(Boolean) as string[]);
}

/** Add the field again as `to`, beside the original, carrying what it carries. */
export function copyCalculatedField(
  spec: Spec,
  op: { name: string; to: string },
  at = 'copyCalculatedField'
): string {
  const to = op.to.trim();
  if (!to) throw new ValidationError(`${at}: a new name is required`);
  if (to === op.name) throw new ValidationError(`${at}: ${op.name} already has that name`);
  const { column, list } = findField(spec, op.name);
  if (
    outputNames(spec).has(to) ||
    allColumns(spec).some((c) => c.ColumnName === to) ||
    referencesTo(spec, to).length > 0
  ) {
    throw new ValidationError(`${at}: the dataset already has a column named ${to}`);
  }
  refuseUnknownReferences(spec, op.name, to, at);

  list.splice(list.indexOf(column) + 1, 0, {
    ColumnName: to,
    ColumnId: randomUUID(),
    Expression: column.Expression,
  });
  for (const operation of operations(spec)) {
    const project = projectOf(operation);
    if (Array.isArray(project?.ProjectedColumns))
      insertAfter(project.ProjectedColumns, op.name, to);
  }
  for (const { op: tag, transforms } of tagOperations(spec, op.name)) {
    const copy = structuredClone(tag);
    (copy.TagColumnOperation ?? copy.UntagColumnOperation).ColumnName = to;
    transforms.splice(transforms.indexOf(tag) + 1, 0, copy);
  }
  for (const folder of Object.values(spec.FieldFolders ?? {}) as Array<{ columns?: string[] }>) {
    if (Array.isArray(folder.columns)) insertAfter(folder.columns, op.name, to);
  }
  // A restriction follows the data, or the copy would hand out what the original withholds.
  for (const rule of clpRules(spec)) {
    if (rule.ColumnNames) insertAfter(rule.ColumnNames, op.name, to);
  }
  for (const meta of semanticColumnMetadata(spec)) {
    if (meta.ColumnNames) insertAfter(meta.ColumnNames, op.name, to);
  }
  return `Added ${to}, a copy of calculated field ${op.name}`;
}

/**
 * Remove `name` now that `replacedBy` serves its readers: the dataset's own
 * fields that read it are pointed at `replacedBy`. Readers outside the
 * dataset are the caller's to check; this sees only the dataset.
 */
export function retireCalculatedField(
  spec: Spec,
  op: { name: string; replacedBy: string },
  at = 'retireCalculatedField'
): string {
  const replacement = allColumns(spec).find((c) => c.ColumnName === op.replacedBy);
  if (!replacement) {
    throw new ValidationError(`${at}: ${op.replacedBy} is not a calculated field of the dataset`);
  }
  const { column } = findField(spec, op.name);
  if (String(column.Expression ?? '') !== String(replacement.Expression ?? '')) {
    throw new ValidationError(
      `${at}: ${op.replacedBy} no longer computes what ${op.name} does, so it cannot replace it`
    );
  }
  refuseUnknownReferences(spec, op.name, op.replacedBy, at);
  removeKnownReferences(spec, op.name, op.replacedBy);
  return `Removed calculated field ${op.name}, now served as ${op.replacedBy}`;
}
