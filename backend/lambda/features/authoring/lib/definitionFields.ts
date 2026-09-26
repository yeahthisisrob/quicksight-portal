/**
 * A definition's calculated fields: what reads each one, and the edits that
 * change them across the whole definition (not one sheet): replace one with
 * a dataset column, rename one, drop one.
 *
 * Pure: a definition in, a definition out. A calculated field is referenced
 * the way a column is (a ColumnIdentifier with its name, in visuals,
 * filters, controls, parameters) and by other calculated fields' expressions
 * as `{name}`; every edit here follows both, so nothing is left pointing at
 * a name that is gone.
 */
import { ValidationError } from '../../../shared/errors/ValidationError';
import type { ColumnUsage } from '../types';
import {
  emptyUsage,
  expressionColumns,
  isColumnIdentifier,
  walkColumnIdentifiers,
} from './definitionColumns';

export interface CalculatedFieldUse {
  identifier: string;
  name: string;
  expression: string;
  /** Where it is read, by kind (calculatedField: other fields reading it). */
  usage: ColumnUsage;
  /** The calculated fields that read it. */
  readBy: string[];
  /** Nothing reads it. */
  unused: boolean;
}

interface CalculatedField {
  DataSetIdentifier?: string;
  Name?: string;
  Expression?: string;
}

const fieldsOf = (definition: Record<string, any>): CalculatedField[] =>
  Array.isArray(definition.CalculatedFields) ? definition.CalculatedFields : [];

const usageTotal = (usage: ColumnUsage) => Object.values(usage).reduce((n, v) => n + v, 0);

/** Every calculated field, with what reads it. */
export function calculatedFieldUses(definition: Record<string, any>): CalculatedFieldUse[] {
  const fields = fieldsOf(definition).filter(
    (f): f is Required<CalculatedField> =>
      typeof f.DataSetIdentifier === 'string' && typeof f.Name === 'string'
  );
  const key = (identifier: string, name: string) => `${identifier}\u0000${name}`;
  const uses = new Map(
    fields.map((f) => [
      key(f.DataSetIdentifier, f.Name),
      {
        identifier: f.DataSetIdentifier,
        name: f.Name,
        expression: String(f.Expression ?? ''),
        usage: emptyUsage(),
        readBy: [] as string[],
        unused: true,
      },
    ])
  );
  walkColumnIdentifiers(definition, (column, site) => {
    const use = uses.get(key(column.DataSetIdentifier, column.ColumnName));
    if (use) use.usage[site] += 1;
  });
  for (const reader of fields) {
    for (const name of expressionColumns(String(reader.Expression ?? ''))) {
      const use = uses.get(key(reader.DataSetIdentifier, name));
      if (use && use.name !== reader.Name) {
        use.usage.calculatedField += 1;
        use.readBy.push(reader.Name);
      }
    }
  }
  return [...uses.values()].map((use) => ({ ...use, unused: usageTotal(use.usage) === 0 }));
}

/** Point every reference to one name of a dataset at another; how many changed. */
function renameReferences(node: unknown, identifier: string, from: string, to: string): number {
  if (Array.isArray(node)) {
    return node.reduce((n, item) => n + renameReferences(item, identifier, from, to), 0);
  }
  if (typeof node !== 'object' || node === null) return 0;
  if (isColumnIdentifier(node)) {
    if (node.DataSetIdentifier === identifier && node.ColumnName === from) {
      node.ColumnName = to;
      return 1;
    }
    return 0;
  }
  return Object.values(node).reduce(
    (n: number, value) => n + renameReferences(value, identifier, from, to),
    0
  );
}

/** Rewrite `{from}` to `{to}` in the expressions of this dataset's fields; the fields rewritten. */
function renameInExpressions(
  fields: CalculatedField[],
  identifier: string,
  from: string,
  to: string
): string[] {
  const token = `{${from}}`;
  const rewritten: string[] = [];
  for (const field of fields) {
    if (field.DataSetIdentifier !== identifier || !String(field.Expression ?? '').includes(token)) {
      continue;
    }
    field.Expression = String(field.Expression).split(token).join(`{${to}}`);
    rewritten.push(String(field.Name));
  }
  return rewritten;
}

function find(definition: Record<string, any>, identifier: string, name: string, at: string) {
  const field = fieldsOf(definition).find(
    (f) => f.DataSetIdentifier === identifier && f.Name === name
  );
  if (!field) throw new ValidationError(`${at}: ${identifier} has no calculated field ${name}`);
  return field;
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function readersText(readers: string[]) {
  return readers.length
    ? `, ${plural(readers.length, 'calculated field')} (${readers.join(', ')})`
    : '';
}

/**
 * The dataset now holds what the field computes (materialised upstream):
 * read the column instead, and drop the field.
 */
export function replaceCalculatedField(
  definition: Record<string, any>,
  op: { identifier: string; name: string; column: string },
  at: string
): string {
  const field = find(definition, op.identifier, op.name, at);
  if (
    fieldsOf(definition).some(
      (f) => f !== field && f.DataSetIdentifier === op.identifier && f.Name === op.column
    )
  ) {
    throw new ValidationError(
      `${at}: ${op.identifier} already has a calculated field named ${op.column}`
    );
  }
  definition.CalculatedFields = fieldsOf(definition).filter((f) => f !== field);
  const references = renameReferences(definition, op.identifier, op.name, op.column);
  const readers = renameInExpressions(
    definition.CalculatedFields,
    op.identifier,
    op.name,
    op.column
  );
  return `Replaced calculated field ${op.name} with column ${op.column} of ${op.identifier}: ${plural(references, 'reference')}${readersText(readers)}`;
}

/** Whether anything in the definition reads this name of the dataset (a column, say). */
function readsColumn(definition: Record<string, any>, identifier: string, name: string): boolean {
  let found = false;
  walkColumnIdentifiers(definition, (c) => {
    if (c.DataSetIdentifier === identifier && c.ColumnName === name) found = true;
  });
  return found;
}

/** A new name for a field, everywhere it is read. */
export function renameCalculatedField(
  definition: Record<string, any>,
  op: { identifier: string; name: string; to: string },
  at: string
): string {
  const to = op.to.trim();
  if (!to) throw new ValidationError(`${at}: a new name is required`);
  const field = find(definition, op.identifier, op.name, at);
  if (to === op.name) return `${op.name} already has that name`;
  const taken =
    fieldsOf(definition).some((f) => f.DataSetIdentifier === op.identifier && f.Name === to) ||
    readsColumn(definition, op.identifier, to);
  if (taken) {
    throw new ValidationError(`${at}: ${op.identifier} already has a field or column named ${to}`);
  }
  field.Name = to;
  const references = renameReferences(definition, op.identifier, op.name, to);
  const readers = renameInExpressions(fieldsOf(definition), op.identifier, op.name, to);
  return `Renamed calculated field ${op.name} to ${to} on ${op.identifier}: ${plural(references, 'reference')}${readersText(readers)}`;
}

/** Drop a field nothing reads. One that is read is refused, with what reads it. */
export function dropCalculatedField(
  definition: Record<string, any>,
  op: { identifier: string; name: string },
  at: string
): string {
  const field = find(definition, op.identifier, op.name, at);
  const use = calculatedFieldUses(definition).find(
    (u) => u.identifier === op.identifier && u.name === op.name
  );
  if (use && !use.unused) {
    const sites = Object.entries(use.usage)
      .filter(([, n]) => n > 0)
      .map(([site, n]) => plural(n, site === 'calculatedField' ? 'calculated field' : site));
    throw new ValidationError(
      `${at}: ${op.name} is still read (${sites.join(', ')}); only an unused field is dropped`
    );
  }
  definition.CalculatedFields = fieldsOf(definition).filter((f) => f !== field);
  return `Dropped unused calculated field ${op.name} of ${op.identifier}`;
}
