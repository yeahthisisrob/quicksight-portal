/**
 * Repairs: deterministic edits that remove or restore what a definition
 * references but no longer has. QuickSight refuses to write a definition
 * with errors, so these run before the rebind plan and the edit ops, on the
 * loaded definition, and the plan sees the result.
 *
 * - dropColumn: remove every reference to a dataset column (field wells,
 *   filters, sorts, hierarchies, column configurations, calculated fields
 *   whose expression reads it). Empty filter groups go with it.
 * - dropParameter: remove a parameter declaration, its controls and the
 *   filters that read it.
 * - declareParameter: add a declaration for a parameter that is referenced
 *   but never declared.
 */
import { ValidationError } from '../../../shared/errors/ValidationError';
import type { DefinitionChange } from './definitionOps';
import { expressionColumns, isColumnIdentifier } from './definitionColumns';

export type ParameterValueType = 'STRING' | 'INTEGER' | 'DECIMAL' | 'DATETIME';

export type RepairOp =
  | { op: 'dropColumn'; identifier: string; columnName: string }
  | { op: 'dropParameter'; name: string }
  | { op: 'declareParameter'; name: string; type: ParameterValueType; defaultValue?: string };

const PARAMETER_DECLARATION_KEY: Record<ParameterValueType, string> = {
  STRING: 'StringParameterDeclaration',
  INTEGER: 'IntegerParameterDeclaration',
  DECIMAL: 'DecimalParameterDeclaration',
  DATETIME: 'DateTimeParameterDeclaration',
};
const PARAMETER_TYPES = new Set<string>(Object.keys(PARAMETER_DECLARATION_KEY));

function isObject(node: unknown): node is Record<string, any> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

function containsColumn(node: unknown, identifier: string, columnName: string): boolean {
  if (Array.isArray(node)) {
    return node.some((n) => containsColumn(n, identifier, columnName));
  }
  if (!isObject(node)) {
    return false;
  }
  if (isColumnIdentifier(node)) {
    return node.DataSetIdentifier === identifier && node.ColumnName === columnName;
  }
  return Object.values(node).some((v) => containsColumn(v, identifier, columnName));
}

/**
 * Remove the smallest array items that carry the column: a field-well entry,
 * a filter, a sort, a hierarchy. An item whose nested arrays hold the only
 * references is kept once those are pruned; one that references the column
 * directly is dropped whole.
 */
function pruneColumn(node: unknown, identifier: string, columnName: string): number {
  let removed = 0;
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i -= 1) {
      const item = node[i];
      if (!containsColumn(item, identifier, columnName)) {
        continue;
      }
      const directly =
        isObject(item) &&
        Object.values(item).some(
          (v) => !Array.isArray(v) && containsColumn(v, identifier, columnName)
        );
      if (directly || !isObject(item)) {
        node.splice(i, 1);
        removed += 1;
        continue;
      }
      removed += pruneColumn(item, identifier, columnName);
      if (containsColumn(item, identifier, columnName)) {
        node.splice(i, 1);
        removed += 1;
      }
    }
    return removed;
  }
  if (isObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value) || isObject(value)) {
        removed += pruneColumn(value, identifier, columnName);
        // A scalar-holding object that still names the column (e.g. a sort
        // configuration held directly, not in an array) is cleared.
        if (isObject(value) && containsColumn(value, identifier, columnName)) {
          delete node[key];
          removed += 1;
        }
      }
    }
  }
  return removed;
}

function dropEmptyFilterGroups(definition: Record<string, any>): number {
  const before = (definition.FilterGroups ?? []).length;
  definition.FilterGroups = (definition.FilterGroups ?? []).filter(
    (g: any) => Array.isArray(g?.Filters) && g.Filters.length > 0
  );
  return before - definition.FilterGroups.length;
}

/** Parameter names the definition declares. */
export function declaredParameters(definition: Record<string, any>): string[] {
  const names: string[] = [];
  for (const declaration of definition.ParameterDeclarations ?? []) {
    for (const key of Object.values(PARAMETER_DECLARATION_KEY)) {
      const name = declaration?.[key]?.Name;
      if (typeof name === 'string') {
        names.push(name);
      }
    }
  }
  return names;
}

/** Parameter names the definition uses: controls, filters, and `${name}` in expressions. */
export function referencedParameters(definition: Record<string, any>): string[] {
  const names = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isObject(node)) {
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'ParameterName' || key === 'SourceParameterName') && typeof value === 'string') {
        names.add(value);
      } else if (key === 'Expression' && typeof value === 'string') {
        for (const match of value.matchAll(/\$\{([A-Za-z0-9_]+)\}/g)) {
          names.add(match[1]!);
        }
      } else {
        visit(value);
      }
    }
  };
  visit(definition);
  return [...names];
}

function referencesParameter(node: unknown, name: string): boolean {
  if (Array.isArray(node)) {
    return node.some((n) => referencesParameter(n, name));
  }
  if (!isObject(node)) {
    return false;
  }
  return Object.entries(node).some(
    ([key, value]) =>
      ((key === 'ParameterName' || key === 'SourceParameterName') && value === name) ||
      referencesParameter(value, name)
  );
}

function pruneParameter(node: unknown, name: string): number {
  let removed = 0;
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i -= 1) {
      const item = node[i];
      if (!referencesParameter(item, name)) {
        continue;
      }
      const directly =
        isObject(item) &&
        Object.entries(item).some(
          ([k, v]) => (k === 'ParameterName' || k === 'SourceParameterName') && v === name
        );
      const nested = isObject(item) && Object.values(item).some((v) => Array.isArray(v));
      if (directly || !nested) {
        node.splice(i, 1);
        removed += 1;
      } else {
        removed += pruneParameter(item, name);
        if (referencesParameter(item, name)) {
          node.splice(i, 1);
          removed += 1;
        }
      }
    }
    return removed;
  }
  if (isObject(node)) {
    for (const value of Object.values(node)) {
      removed += pruneParameter(value, name);
    }
  }
  return removed;
}

export function applyRepairs(
  input: Record<string, any>,
  repairs: RepairOp[]
): { definition: Record<string, any>; changes: DefinitionChange[] } {
  const definition = structuredClone(input);
  const changes: DefinitionChange[] = [];

  repairs.forEach((repair, index) => {
    switch (repair.op) {
      case 'dropColumn': {
        const { identifier, columnName } = repair;
        if (!identifier || !columnName) {
          throw new ValidationError(`Repair ${index + 1}: dropColumn needs identifier and columnName`);
        }
        const calculated = (definition.CalculatedFields ?? []).filter(
          (f: any) =>
            f?.DataSetIdentifier === identifier &&
            expressionColumns(f?.Expression ?? '').includes(columnName)
        );
        definition.CalculatedFields = (definition.CalculatedFields ?? []).filter(
          (f: any) => !calculated.includes(f)
        );
        const removed = pruneColumn(definition, identifier, columnName);
        const groups = dropEmptyFilterGroups(definition);
        const parts = [
          `${removed} reference${removed === 1 ? '' : 's'}`,
          calculated.length > 0
            ? `${calculated.length} calculated field${calculated.length === 1 ? '' : 's'} (${calculated.map((f: any) => f.Name).join(', ')})`
            : '',
          groups > 0 ? `${groups} empty filter group${groups === 1 ? '' : 's'}` : '',
        ].filter(Boolean);
        changes.push({
          kind: 'repair',
          description: `Removed column ${columnName} of ${identifier}: ${parts.join(', ')}`,
        });
        break;
      }
      case 'dropParameter': {
        if (!repair.name) {
          throw new ValidationError(`Repair ${index + 1}: dropParameter needs a name`);
        }
        const before = (definition.ParameterDeclarations ?? []).length;
        definition.ParameterDeclarations = (definition.ParameterDeclarations ?? []).filter(
          (d: any) => !Object.values(PARAMETER_DECLARATION_KEY).some((k) => d?.[k]?.Name === repair.name)
        );
        const declared = before - definition.ParameterDeclarations.length;
        const removed = pruneParameter(definition, repair.name);
        const groups = dropEmptyFilterGroups(definition);
        changes.push({
          kind: 'repair',
          description: `Removed parameter ${repair.name}: ${declared ? 'its declaration, ' : ''}${removed} reference${removed === 1 ? '' : 's'}${groups ? `, ${groups} empty filter group${groups === 1 ? '' : 's'}` : ''}`,
        });
        break;
      }
      case 'declareParameter': {
        if (!repair.name || !PARAMETER_TYPES.has(repair.type)) {
          throw new ValidationError(
            `Repair ${index + 1}: declareParameter needs a name and a type (STRING, INTEGER, DECIMAL, DATETIME)`
          );
        }
        if (declaredParameters(definition).includes(repair.name)) {
          throw new ValidationError(`Repair ${index + 1}: parameter ${repair.name} is already declared`);
        }
        const key = PARAMETER_DECLARATION_KEY[repair.type];
        const declaration: Record<string, any> = { Name: repair.name };
        if (repair.type !== 'DATETIME') {
          declaration.ParameterValueType = 'SINGLE_VALUED';
        }
        if (repair.defaultValue !== undefined) {
          declaration.DefaultValues = { StaticValues: [coerceDefault(repair.type, repair.defaultValue)] };
        }
        definition.ParameterDeclarations = [...(definition.ParameterDeclarations ?? []), { [key]: declaration }];
        changes.push({
          kind: 'repair',
          description: `Declared parameter ${repair.name} as ${repair.type}${repair.defaultValue !== undefined ? ` defaulting to ${repair.defaultValue}` : ''}`,
        });
        break;
      }
      default:
        throw new ValidationError(`Repair ${index + 1}: unknown repair '${(repair as any).op}'`);
    }
  });

  return { definition, changes };
}

function coerceDefault(type: ParameterValueType, value: string): string | number {
  if (type === 'INTEGER' || type === 'DECIMAL') {
    const n = Number(value);
    if (!Number.isFinite(n)) {
      throw new ValidationError(`Default '${value}' is not a number`);
    }
    return n;
  }
  return value;
}

export function parseRepairs(raw: unknown): RepairOp[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new ValidationError('repairs must be an array');
  }
  return raw.map((item, index) => {
    if (typeof item !== 'object' || item === null || typeof (item as any).op !== 'string') {
      throw new ValidationError(`Repair ${index + 1}: each repair needs an op`);
    }
    return item as RepairOp;
  });
}
