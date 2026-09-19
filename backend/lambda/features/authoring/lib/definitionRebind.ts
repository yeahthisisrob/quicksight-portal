/**
 * Rewrite a definition so a dataset identifier reads from a different dataset.
 *
 * Pure: returns a new definition, never mutates the input.
 *
 * Three things change, nothing else:
 *   1. The identifier's `DataSetArn` in `DataSetIdentifierDeclarations`.
 *   2. Every ColumnIdentifier under that identifier whose name is in the map.
 *   3. `{column}` tokens in that identifier's calculated-field expressions.
 *
 * The identifier string itself is kept. Visuals, filters and parameters refer
 * to datasets by identifier, so keeping it means none of them need touching.
 * Field ids are also kept: they are opaque keys QuickSight only requires to be
 * unique within the definition, and renaming a column does not change that.
 */

import { ValidationError } from '../../../shared/errors/ValidationError';
import { canonicalExpression } from '../../data-catalog/lib/expressionAnalysis';
import type { AddedCalculatedField } from '../types';
import { expressionColumns, isColumnIdentifier } from './definitionColumns';

export interface RebindSpec {
  identifier: string;
  targetDataSetArn: string;
  /** Source column name -> target column name. */
  columnMap?: Record<string, string>;
}

/** `${param}` is a parameter token; only bare `{column}` tokens are rewritten. */
const EXPRESSION_COLUMN_TOKEN = /(?<!\$)\{([^{}]+)\}/g;

export function rewriteExpression(expression: string, columnMap: Record<string, string>): string {
  if (expressionColumns(expression).every((name) => columnMap[name] === undefined)) {
    return expression;
  }
  return expression.replace(EXPRESSION_COLUMN_TOKEN, (token, rawName: string) => {
    const mapped = columnMap[rawName.trim()];
    return mapped === undefined ? token : `{${mapped}}`;
  });
}

export function renameColumns(
  node: unknown,
  identifier: string,
  columnMap: Record<string, string>
): void {
  if (Array.isArray(node)) {
    for (const item of node) {
      renameColumns(item, identifier, columnMap);
    }
    return;
  }
  if (typeof node !== 'object' || node === null || node instanceof Date) {
    return;
  }
  if (isColumnIdentifier(node)) {
    if (node.DataSetIdentifier === identifier) {
      const mapped = columnMap[node.ColumnName];
      if (mapped !== undefined) {
        node.ColumnName = mapped;
      }
    }
    return;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    renameColumns(value, identifier, columnMap);
  }
}

/**
 * Apply one or more rebinds to a definition.
 * Throws if a spec names an identifier the definition does not declare; the
 * caller is expected to have planned first, so that is a programming error.
 */
export function rebindDefinition<T extends object>(definition: T, specs: RebindSpec[]): T {
  const out = structuredClone(definition) as T & {
    DataSetIdentifierDeclarations?: Array<{ Identifier?: string; DataSetArn?: string }>;
    CalculatedFields?: Array<{ DataSetIdentifier?: string; Expression?: string }>;
  };

  for (const spec of specs) {
    const declaration = out.DataSetIdentifierDeclarations?.find(
      (d) => d.Identifier === spec.identifier
    );
    if (!declaration) {
      throw new Error(`Definition has no dataset identifier '${spec.identifier}'`);
    }
    declaration.DataSetArn = spec.targetDataSetArn;

    const columnMap = spec.columnMap ?? {};
    if (Object.keys(columnMap).length === 0) {
      continue;
    }

    renameColumns(out, spec.identifier, columnMap);

    for (const field of out.CalculatedFields ?? []) {
      if (field.DataSetIdentifier === spec.identifier && typeof field.Expression === 'string') {
        field.Expression = rewriteExpression(field.Expression, columnMap);
      }
    }
  }

  return out;
}

/**
 * Add calculated fields (typically from the template library) to a
 * definition. Each is declared against a dataset identifier the definition
 * has; a name already declared there is refused rather than overwritten.
 */
export function withAddedCalculatedFields(
  definition: Record<string, any>,
  added: AddedCalculatedField[]
): Record<string, any> {
  if (added.length === 0) {
    return definition;
  }
  const identifiers = new Set<string>(
    (definition.DataSetIdentifierDeclarations ?? []).map((d: any) => d?.Identifier)
  );
  const existing = new Map<string, string>(
    (definition.CalculatedFields ?? []).map((f: any) => [
      `${f?.DataSetIdentifier}::${f?.Name}`,
      canonicalExpression(f?.Expression),
    ])
  );
  const fields = [...(definition.CalculatedFields ?? [])];
  for (const field of added) {
    if (!identifiers.has(field.identifier)) {
      throw new ValidationError(
        `Cannot add calculated field '${field.name}': no dataset identifier '${field.identifier}'`
      );
    }
    // A field that is already there with the same expression is nothing to
    // add; one with the same name and another expression gets a suffix, so a
    // template never refuses a publish over a name.
    let name = field.name;
    const key = `${field.identifier}::${name}`;
    if (existing.has(key)) {
      if (existing.get(key) === canonicalExpression(field.expression)) {
        continue;
      }
      let suffix = 2;
      while (existing.has(`${field.identifier}::${field.name}_v${suffix}`)) {
        suffix += 1;
      }
      name = `${field.name}_v${suffix}`;
    }
    existing.set(`${field.identifier}::${name}`, canonicalExpression(field.expression));
    fields.push({
      DataSetIdentifier: field.identifier,
      Name: name,
      Expression: field.expression,
    });
  }
  return { ...definition, CalculatedFields: fields };
}

