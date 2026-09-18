/**
 * What a dashboard or analysis definition takes from its datasets.
 *
 * Pure: reads a QuickSight `Definition` object, writes nothing, calls nothing.
 *
 * Every place a definition names a dataset column does so with the same shape,
 * a ColumnIdentifier: `{ DataSetIdentifier, ColumnName }`. Field wells,
 * filters, parameter defaults, sheet controls, column hierarchies and
 * formatting all use it, so walking the tree for that shape finds every
 * reference without knowing the dozens of visual types by name.
 *
 * The one exception is calculated fields, whose expressions name columns as
 * `{column}` tokens (and parameters as `${param}`). Those are parsed here so a
 * calculated field's dependencies count as references too, and so the
 * calculated field's own name is never mistaken for a dataset column.
 */

import type {
  ColumnUsage,
  ColumnUsageSite,
  DefinitionDataset,
  ReferencedColumn,
} from '../types';

/** Top-level definition keys and the usage site they represent. */
const SECTION_SITES: Record<string, ColumnUsageSite> = {
  FilterGroups: 'filter',
  CalculatedFields: 'calculatedField',
  ParameterDeclarations: 'parameter',
};

/** Keys inside a sheet that hold controls rather than visuals. */
const SHEET_CONTROL_KEYS = new Set(['FilterControls', 'ParameterControls', 'SheetControlLayouts']);

/**
 * `{name}` tokens in a calculated-field expression. `${name}` is a parameter
 * and is skipped by the negative lookbehind.
 */
const EXPRESSION_COLUMN_TOKEN = /(?<!\$)\{([^{}]+)\}/g;

export interface ColumnIdentifier {
  DataSetIdentifier: string;
  ColumnName: string;
}

export function isColumnIdentifier(node: unknown): node is ColumnIdentifier {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as ColumnIdentifier).DataSetIdentifier === 'string' &&
    typeof (node as ColumnIdentifier).ColumnName === 'string'
  );
}

export function emptyUsage(): ColumnUsage {
  return { visual: 0, filter: 0, calculatedField: 0, parameter: 0, control: 0, other: 0 };
}

/** Column names an expression refers to, in order of first appearance. */
export function expressionColumns(expression: string): string[] {
  const names: string[] = [];
  for (const match of expression.matchAll(EXPRESSION_COLUMN_TOKEN)) {
    const name = match[1]?.trim();
    if (name && !names.includes(name)) {
      names.push(name);
    }
  }
  return names;
}

/**
 * Walk a definition and call `visit` for every ColumnIdentifier with the
 * section it was found in. Arrays and plain objects only; anything else is a
 * leaf.
 */
export function walkColumnIdentifiers(
  definition: unknown,
  visit: (column: ColumnIdentifier, site: ColumnUsageSite) => void
): void {
  const root = (definition ?? {}) as Record<string, unknown>;
  for (const [section, value] of Object.entries(root)) {
    if (section === 'Sheets' && Array.isArray(value)) {
      for (const sheet of value) {
        walkSheet(sheet, visit);
      }
      continue;
    }
    walkNode(value, SECTION_SITES[section] ?? 'other', visit);
  }
}

function walkSheet(
  sheet: unknown,
  visit: (column: ColumnIdentifier, site: ColumnUsageSite) => void
): void {
  if (typeof sheet !== 'object' || sheet === null) {
    return;
  }
  for (const [key, value] of Object.entries(sheet as Record<string, unknown>)) {
    const site: ColumnUsageSite =
      key === 'Visuals' ? 'visual' : SHEET_CONTROL_KEYS.has(key) ? 'control' : 'other';
    walkNode(value, site, visit);
  }
}

function walkNode(
  node: unknown,
  site: ColumnUsageSite,
  visit: (column: ColumnIdentifier, site: ColumnUsageSite) => void
): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      walkNode(item, site, visit);
    }
    return;
  }
  if (typeof node !== 'object' || node === null || node instanceof Date) {
    return;
  }
  if (isColumnIdentifier(node)) {
    visit(node, site);
    return;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    walkNode(value, site, visit);
  }
}

interface CalculatedField {
  DataSetIdentifier?: string;
  Name?: string;
  Expression?: string;
}

function calculatedFieldsByDataset(definition: unknown): Map<string, CalculatedField[]> {
  const byDataset = new Map<string, CalculatedField[]>();
  const fields = (definition as { CalculatedFields?: unknown })?.CalculatedFields;
  if (!Array.isArray(fields)) {
    return byDataset;
  }
  for (const field of fields as CalculatedField[]) {
    if (typeof field?.DataSetIdentifier !== 'string' || typeof field.Name !== 'string') {
      continue;
    }
    const list = byDataset.get(field.DataSetIdentifier) ?? [];
    list.push(field);
    byDataset.set(field.DataSetIdentifier, list);
  }
  return byDataset;
}

function dataSetIdFromArn(arn: string): string {
  return arn.split('/').pop() ?? arn;
}

/**
 * Every dataset a definition declares, with the columns it reads from each.
 *
 * Calculated fields are reported separately and excluded from `columns`: they
 * live in the definition, not the dataset, so a target dataset does not have
 * to provide them. Their expressions' column tokens are counted as
 * `calculatedField` usages of the underlying dataset columns.
 */
export function collectDefinitionDatasets(definition: unknown): DefinitionDataset[] {
  const declarations = (definition as { DataSetIdentifierDeclarations?: unknown })
    ?.DataSetIdentifierDeclarations;
  if (!Array.isArray(declarations)) {
    return [];
  }

  const calculated = calculatedFieldsByDataset(definition);
  const usageByDataset = new Map<string, Map<string, ColumnUsage>>();

  const record = (identifier: string, column: string, site: ColumnUsageSite): void => {
    const calcNames = calculated.get(identifier)?.map((f) => f.Name) ?? [];
    if (calcNames.includes(column)) {
      return;
    }
    const usage = usageByDataset.get(identifier) ?? new Map<string, ColumnUsage>();
    const entry = usage.get(column) ?? emptyUsage();
    entry[site] += 1;
    usage.set(column, entry);
    usageByDataset.set(identifier, usage);
  };

  walkColumnIdentifiers(definition, (column, site) =>
    record(column.DataSetIdentifier, column.ColumnName, site)
  );

  for (const [identifier, fields] of calculated) {
    for (const field of fields) {
      for (const name of expressionColumns(field.Expression ?? '')) {
        record(identifier, name, 'calculatedField');
      }
    }
  }

  return declarations
    .filter(
      (decl): decl is { Identifier: string; DataSetArn: string } =>
        typeof decl?.Identifier === 'string' && typeof decl?.DataSetArn === 'string'
    )
    .map((decl) => {
      const usage = usageByDataset.get(decl.Identifier) ?? new Map<string, ColumnUsage>();
      const columns: ReferencedColumn[] = [...usage.entries()]
        .map(([name, use]) => ({ name, usage: use }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        identifier: decl.Identifier,
        dataSetArn: decl.DataSetArn,
        dataSetId: dataSetIdFromArn(decl.DataSetArn),
        columns,
        calculatedFields: (calculated.get(decl.Identifier) ?? [])
          .map((f) => f.Name ?? '')
          .filter(Boolean),
      };
    });
}
