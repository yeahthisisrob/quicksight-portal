/**
 * Edit operations over a QuickSight definition. Pure: returns a new
 * definition and a plain-language description of every change; never
 * mutates the input; refuses anything it cannot do exactly.
 *
 * What is editable, and why only this:
 *   move / resize      grid layouts only; the element keeps its identity.
 *   retype             between visual types whose field wells translate.
 *                      The wells, title and subtitle carry over; the rest
 *                      of the chart configuration resets to defaults, since
 *                      axis, legend and sort settings are type-specific.
 *   retitle            title and subtitle text.
 *   remove             the element and its visual; filter scopes that
 *                      named the visual stop naming it.
 *   duplicate          a deep copy with fresh visual and field ids, placed
 *                      where asked or flowed after the last tile.
 *   renameSheet        the sheet name.
 * No free-form visual creation: a new visual is a duplicate of one that
 * already renders, then edited. That keeps every result something
 * QuickSight will accept.
 */

import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/ValidationError';
import { controlBar, controlBarElements } from './controlBar';
import { buildFilters } from './definitionFilters';
import { stripHtml, visualEntry, visualTypeName } from './definitionOutline';

export type EditableVisualType =
  | 'BarChart'
  | 'ColumnChart'
  | 'LineChart'
  | 'PieChart'
  | 'DonutChart'
  | 'Table'
  | 'PivotTable';

export type DefinitionOp =
  | { op: 'move'; sheetId: string; elementId: string; col: number; row: number }
  | { op: 'resize'; sheetId: string; elementId: string; colSpan: number; rowSpan: number }
  | { op: 'retype'; sheetId: string; elementId: string; visualType: EditableVisualType }
  | { op: 'retitle'; sheetId: string; elementId: string; title?: string; subtitle?: string }
  | { op: 'remove'; sheetId: string; elementId: string }
  | {
      op: 'duplicate';
      sheetId: string;
      elementId: string;
      title?: string;
      col?: number;
      row?: number;
    }
  | { op: 'renameSheet'; sheetId: string; name: string }
  | {
      op: 'addFilter';
      sheetId: string;
      /** The dataset identifier (as declared in the definition), not its ARN. */
      identifier: string;
      column: string;
      /** STRING, INTEGER, DECIMAL or DATETIME; read from how the definition uses the column when omitted. */
      columnType?: string;
      title?: string;
      values?: string[];
      min?: number;
      max?: number;
    };

export type ChangeKind =
  | 'template'
  | 'repair'
  | 'rebind'
  | 'rename'
  | 'calculatedField'
  | 'layout'
  | 'visual'
  | 'sheet'
  | 'filter';

export interface DefinitionChange {
  kind: ChangeKind;
  description: string;
  sheetId?: string;
  elementId?: string;
}

export const GRID_COLUMNS = 36;
/** A new tile's size when the source has none: half the grid wide, a comfortable height. */
const DEFAULT_COL_SPAN = 18;
const DEFAULT_ROW_SPAN = 12;
/** Enough of a uuid to keep duplicated field ids unique and readable. */
const ID_SUFFIX_LENGTH = 8;
export const EDITABLE_VISUAL_TYPES: readonly EditableVisualType[] = [
  'BarChart',
  'ColumnChart',
  'LineChart',
  'PieChart',
  'DonutChart',
  'Table',
  'PivotTable',
];

/** Which QuickSight visual key and field-well wrapper each editable type uses. */
const TYPE_SPEC: Record<
  EditableVisualType,
  { key: string; wells: string; roles: readonly string[]; orientation?: 'HORIZONTAL' | 'VERTICAL'; donut?: boolean }
> = {
  BarChart: { key: 'BarChartVisual', wells: 'BarChartAggregatedFieldWells', roles: ['Category', 'Values', 'Colors', 'SmallMultiples'], orientation: 'HORIZONTAL' },
  ColumnChart: { key: 'BarChartVisual', wells: 'BarChartAggregatedFieldWells', roles: ['Category', 'Values', 'Colors', 'SmallMultiples'], orientation: 'VERTICAL' },
  LineChart: { key: 'LineChartVisual', wells: 'LineChartAggregatedFieldWells', roles: ['Category', 'Values', 'Colors', 'SmallMultiples'] },
  PieChart: { key: 'PieChartVisual', wells: 'PieChartAggregatedFieldWells', roles: ['Category', 'Values', 'SmallMultiples'], donut: false },
  DonutChart: { key: 'PieChartVisual', wells: 'PieChartAggregatedFieldWells', roles: ['Category', 'Values', 'SmallMultiples'], donut: true },
  Table: { key: 'TableVisual', wells: 'TableAggregatedFieldWells', roles: ['GroupBy', 'Values'] },
  PivotTable: { key: 'PivotTableVisual', wells: 'PivotTableAggregatedFieldWells', roles: ['Rows', 'Columns', 'Values'] },
};

/** Which well of the source type feeds which well of the target type. */
function translateWells(
  from: Record<string, any[]>,
  target: EditableVisualType
): { wells: Record<string, any[]>; dropped: string[] } {
  const dims = [
    ...(from.Category ?? []),
    ...(from.Colors ?? []),
    ...(from.GroupBy ?? []),
    ...(from.Rows ?? []),
    ...(from.Columns ?? []),
  ];
  const values = from.Values ?? [];
  const small = from.SmallMultiples ?? [];
  const dropped: string[] = [];
  const wells: Record<string, any[]> = {};
  switch (target) {
    case 'BarChart':
    case 'ColumnChart':
    case 'LineChart': {
      const [category, ...rest] = dims;
      if (category) wells.Category = [category];
      if (rest.length > 0) wells.Colors = [rest[0]];
      if (rest.length > 1) dropped.push(...rest.slice(1).map(fieldName));
      if (values.length > 0) wells.Values = values;
      if (small.length > 0) wells.SmallMultiples = small;
      break;
    }
    case 'PieChart':
    case 'DonutChart': {
      const [category, ...rest] = dims;
      if (category) wells.Category = [category];
      if (rest.length > 0) dropped.push(...rest.map(fieldName));
      if (values.length > 0) wells.Values = values;
      if (small.length > 0) wells.SmallMultiples = small;
      break;
    }
    case 'Table':
      if (dims.length > 0) wells.GroupBy = dims;
      if (values.length > 0) wells.Values = values;
      if (small.length > 0) dropped.push(...small.map(fieldName));
      break;
    case 'PivotTable': {
      const rows = [...(from.Rows ?? []), ...(from.Category ?? []), ...(from.GroupBy ?? [])];
      const columns = [...(from.Columns ?? []), ...(from.Colors ?? [])];
      if (rows.length > 0) wells.Rows = rows;
      if (columns.length > 0) wells.Columns = columns;
      if (values.length > 0) wells.Values = values;
      if (small.length > 0) dropped.push(...small.map(fieldName));
      break;
    }
  }
  return { wells, dropped };
}

function fieldName(field: any): string {
  const entry = visualEntry(field);
  return entry ? String(entry[1].Column?.ColumnName ?? entry[1].FieldId ?? 'field') : 'field';
}

/** The `<X>AggregatedFieldWells` object of a visual, whatever its type. */
function aggregatedWells(body: Record<string, any>): Record<string, any[]> | null {
  const wells = body.ChartConfiguration?.FieldWells;
  if (typeof wells !== 'object' || wells === null) {
    return null;
  }
  for (const value of Object.values(wells)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value as Record<string, any[]>;
    }
  }
  // KPI and a few others keep their wells directly under FieldWells.
  return wells as Record<string, any[]>;
}

function sheetOf(definition: any, sheetId: string, index: number): any {
  const sheet = (definition.Sheets ?? []).find((s: any) => s?.SheetId === sheetId);
  if (!sheet) {
    throw new ValidationError(`Op ${index + 1}: no sheet '${sheetId}'`);
  }
  return sheet;
}

function gridOf(sheet: any, index: number, verb: string): any {
  const grid = sheet.Layouts?.[0]?.Configuration?.GridLayout;
  if (!grid) {
    throw new ValidationError(
      `Op ${index + 1}: cannot ${verb} on sheet '${sheet.SheetId}': only grid layouts are editable here`
    );
  }
  grid.Elements = grid.Elements ?? [];
  return grid;
}

function elementOf(grid: any, elementId: string, index: number): any {
  const element = grid.Elements.find((e: any) => e?.ElementId === elementId);
  if (!element) {
    throw new ValidationError(`Op ${index + 1}: no element '${elementId}' on that sheet`);
  }
  return element;
}

function visualOf(sheet: any, visualId: string, index: number): { wrapper: any; key: string; body: any; at: number } {
  const visuals: any[] = sheet.Visuals ?? [];
  const at = visuals.findIndex((w) => visualEntry(w)?.[1].VisualId === visualId);
  if (at === -1) {
    throw new ValidationError(`Op ${index + 1}: no visual '${visualId}' on sheet '${sheet.SheetId}'`);
  }
  const [key, body] = visualEntry(visuals[at]) as [string, any];
  return { wrapper: visuals[at], key, body, at };
}

function titleOf(body: any, fallback: string): string {
  const text = body?.Title?.FormatText?.PlainText ?? stripHtml(body?.Title?.FormatText?.RichText);
  return typeof text === 'string' && text.trim() ? `'${text.trim()}'` : fallback;
}

function assertInt(value: unknown, name: string, index: number, min: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    throw new ValidationError(
      `Op ${index + 1}: ${name} must be an integer${max !== undefined ? ` between ${min} and ${max}` : ` of at least ${min}`}`
    );
  }
  return value;
}

/** Give a cloned visual fresh ids everywhere the old ones appear. */
function refreshIds(clone: any, idMap: Map<string, string>): any {
  if (Array.isArray(clone)) {
    return clone.map((c) => refreshIds(c, idMap));
  }
  if (typeof clone === 'object' && clone !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(clone)) {
      out[k] = refreshIds(v, idMap);
    }
    return out;
  }
  if (typeof clone === 'string' && idMap.has(clone)) {
    return idMap.get(clone);
  }
  return clone;
}

function collectFieldIds(node: any, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) collectFieldIds(n, out);
  } else if (typeof node === 'object' && node !== null) {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'FieldId' && typeof v === 'string') out.add(v);
      else collectFieldIds(v, out);
    }
  }
}

export function applyOps(
  input: Record<string, any>,
  ops: DefinitionOp[]
): { definition: Record<string, any>; changes: DefinitionChange[] } {
  const definition = structuredClone(input);
  const changes: DefinitionChange[] = [];

  ops.forEach((op, index) => {
    const sheet = sheetOf(definition, op.sheetId, index);
    const sheetName = sheet.Name ?? op.sheetId;

    switch (op.op) {
      case 'move': {
        const grid = gridOf(sheet, index, 'move');
        const element = elementOf(grid, op.elementId, index);
        const col = assertInt(op.col, 'col', index, 0, GRID_COLUMNS - 1);
        const row = assertInt(op.row, 'row', index, 0);
        const span = Number(element.ColumnSpan ?? 1);
        if (col + span > GRID_COLUMNS) {
          throw new ValidationError(`Op ${index + 1}: column ${col} plus width ${span} exceeds the ${GRID_COLUMNS}-column grid`);
        }
        element.ColumnIndex = col;
        element.RowIndex = row;
        changes.push({ kind: 'layout', sheetId: op.sheetId, elementId: op.elementId, description: `Moved ${labelFor(sheet, op.elementId)} to column ${col}, row ${row} on ${sheetName}` });
        break;
      }
      case 'resize': {
        const grid = gridOf(sheet, index, 'resize');
        const element = elementOf(grid, op.elementId, index);
        const colSpan = assertInt(op.colSpan, 'colSpan', index, 1, GRID_COLUMNS);
        const rowSpan = assertInt(op.rowSpan, 'rowSpan', index, 1);
        const col = Number(element.ColumnIndex ?? 0);
        if (col + colSpan > GRID_COLUMNS) {
          throw new ValidationError(`Op ${index + 1}: width ${colSpan} at column ${col} exceeds the ${GRID_COLUMNS}-column grid`);
        }
        element.ColumnSpan = colSpan;
        element.RowSpan = rowSpan;
        changes.push({ kind: 'layout', sheetId: op.sheetId, elementId: op.elementId, description: `Resized ${labelFor(sheet, op.elementId)} to ${colSpan} columns by ${rowSpan} rows on ${sheetName}` });
        break;
      }
      case 'retitle': {
        const { body } = visualOf(sheet, op.elementId, index);
        const before = titleOf(body, 'an untitled visual');
        if (op.title !== undefined) {
          body.Title = { Visibility: 'VISIBLE', FormatText: { PlainText: op.title } };
        }
        if (op.subtitle !== undefined) {
          body.Subtitle = op.subtitle
            ? { Visibility: 'VISIBLE', FormatText: { PlainText: op.subtitle } }
            : { Visibility: 'HIDDEN' };
        }
        changes.push({ kind: 'visual', sheetId: op.sheetId, elementId: op.elementId, description: op.title !== undefined ? `Renamed ${before} to '${op.title}'` : `Changed the subtitle of ${before}` });
        break;
      }
      case 'retype': {
        if (!EDITABLE_VISUAL_TYPES.includes(op.visualType)) {
          throw new ValidationError(`Op ${index + 1}: '${op.visualType}' is not a type visuals can be changed to (${EDITABLE_VISUAL_TYPES.join(', ')})`);
        }
        const { key, body, at } = visualOf(sheet, op.elementId, index);
        const fromType = visualTypeName(key);
        const fromSpec = Object.values(TYPE_SPEC).find((s) => s.key === key);
        if (!fromSpec) {
          throw new ValidationError(`Op ${index + 1}: a ${fromType} cannot be changed to another type here; only ${EDITABLE_VISUAL_TYPES.join(', ')} can`);
        }
        const wells = aggregatedWells(body) ?? {};
        const { wells: newWells, dropped } = translateWells(wells, op.visualType);
        const spec = TYPE_SPEC[op.visualType];
        const config: Record<string, any> = { FieldWells: { [spec.wells]: newWells } };
        if (spec.orientation) config.Orientation = spec.orientation;
        if (spec.donut !== undefined) {
          config.DonutOptions = { ArcOptions: { ArcThickness: spec.donut ? 'MEDIUM' : 'WHOLE' } };
        }
        const next = {
          [spec.key]: {
            VisualId: body.VisualId,
            ...(body.Title ? { Title: body.Title } : {}),
            ...(body.Subtitle ? { Subtitle: body.Subtitle } : {}),
            ChartConfiguration: config,
            ...(body.Actions ? { Actions: body.Actions } : {}),
          },
        };
        sheet.Visuals[at] = next;
        const label = titleOf(body, 'the visual');
        changes.push({
          kind: 'visual',
          sheetId: op.sheetId,
          elementId: op.elementId,
          description:
            `Changed ${label} from ${describeType(fromType, body)} to ${describeType(op.visualType)}` +
            (dropped.length > 0 ? `; ${dropped.join(', ')} no longer fit and were dropped` : '') +
            '; axis, legend and sort settings reset to defaults',
        });
        break;
      }
      case 'remove': {
        const label = labelFor(sheet, op.elementId);
        const grid = sheet.Layouts?.[0]?.Configuration?.GridLayout;
        if (grid?.Elements) {
          grid.Elements = grid.Elements.filter((e: any) => e?.ElementId !== op.elementId);
        }
        const free = sheet.Layouts?.[0]?.Configuration?.FreeFormLayout;
        if (free?.Elements) {
          free.Elements = free.Elements.filter((e: any) => e?.ElementId !== op.elementId);
        }
        const beforeCount = (sheet.Visuals ?? []).length;
        sheet.Visuals = (sheet.Visuals ?? []).filter((w: any) => visualEntry(w)?.[1].VisualId !== op.elementId);
        sheet.TextBoxes = (sheet.TextBoxes ?? []).filter((t: any) => t?.SheetTextBoxId !== op.elementId);
        // A control, wherever it sits: its declaration, and the control bar.
        const controlId = (c: any) => {
          const body = Object.values(c ?? {})[0] as any;
          return body?.FilterControlId ?? body?.ParameterControlId;
        };
        if (sheet.FilterControls) {
          sheet.FilterControls = sheet.FilterControls.filter((c: any) => controlId(c) !== op.elementId);
        }
        if (sheet.ParameterControls) {
          sheet.ParameterControls = sheet.ParameterControls.filter((c: any) => controlId(c) !== op.elementId);
        }
        if (controlBarElements(sheet).some((e) => e.ElementId === op.elementId)) {
          const rest = controlBarElements(sheet).filter((e) => e.ElementId !== op.elementId);
          sheet.SheetControlLayouts = controlBar(rest.map((e) => ({ id: e.ElementId, type: e.ElementType, span: e.ColumnSpan })));
        }
        if (beforeCount === sheet.Visuals.length && !grid && !free) {
          throw new ValidationError(`Op ${index + 1}: nothing with id '${op.elementId}' on sheet '${sheet.SheetId}'`);
        }
        for (const group of definition.FilterGroups ?? []) {
          for (const scope of group?.ScopeConfiguration?.SelectedSheets?.SheetVisualScopingConfigurations ?? []) {
            if (Array.isArray(scope.VisualIds)) {
              scope.VisualIds = scope.VisualIds.filter((id: string) => id !== op.elementId);
            }
          }
        }
        changes.push({ kind: 'visual', sheetId: op.sheetId, elementId: op.elementId, description: `Removed ${label} from ${sheetName}` });
        break;
      }
      case 'duplicate': {
        const { wrapper, body } = visualOf(sheet, op.elementId, index);
        const newId = randomUUID();
        const idMap = new Map<string, string>([[body.VisualId, newId]]);
        const fieldIds = new Set<string>();
        collectFieldIds(body, fieldIds);
        for (const id of fieldIds) idMap.set(id, `${id}.${newId.slice(0, ID_SUFFIX_LENGTH)}`);
        const clone = refreshIds(wrapper, idMap);
        const cloneBody = visualEntry(clone)?.[1];
        if (cloneBody && op.title !== undefined) {
          cloneBody.Title = { Visibility: 'VISIBLE', FormatText: { PlainText: op.title } };
        }
        sheet.Visuals.push(clone);
        const grid = sheet.Layouts?.[0]?.Configuration?.GridLayout;
        if (grid) {
          const source = (grid.Elements ?? []).find((e: any) => e?.ElementId === op.elementId);
          const element: Record<string, unknown> = {
            ElementId: newId,
            ElementType: 'VISUAL',
            ColumnSpan: source?.ColumnSpan ?? DEFAULT_COL_SPAN,
            RowSpan: source?.RowSpan ?? DEFAULT_ROW_SPAN,
          };
          if (op.col !== undefined && op.row !== undefined) {
            element.ColumnIndex = assertInt(op.col, 'col', index, 0, GRID_COLUMNS - 1);
            element.RowIndex = assertInt(op.row, 'row', index, 0);
          }
          grid.Elements = [...(grid.Elements ?? []), element];
        }
        changes.push({
          kind: 'visual',
          sheetId: op.sheetId,
          elementId: newId,
          description: `Added a copy of ${titleOf(body, 'the visual')}${op.title ? ` named '${op.title}'` : ''} to ${sheetName}`,
        });
        break;
      }
      case 'renameSheet': {
        const name = typeof op.name === 'string' ? op.name.trim() : '';
        if (!name) {
          throw new ValidationError(`Op ${index + 1}: a sheet name is required`);
        }
        changes.push({ kind: 'sheet', sheetId: op.sheetId, description: `Renamed sheet '${sheetName}' to '${name}'` });
        sheet.Name = name;
        break;
      }
      case 'addFilter': {
        const declared = (definition.DataSetIdentifierDeclarations ?? []).map((d: any) => d?.Identifier);
        if (!declared.includes(op.identifier)) {
          throw new ValidationError(
            `Op ${index + 1}: no dataset identifier '${op.identifier}'; the definition declares ${declared.join(', ') || 'none'}`
          );
        }
        const type = op.columnType ?? columnTypeIn(definition, op.identifier, op.column) ?? 'STRING';
        const built = buildFilters(
          op.sheetId,
          [{ identifier: op.identifier, column: op.column, title: op.title, values: op.values, min: op.min, max: op.max }],
          (identifier, name) =>
            identifier === op.identifier && name.toLowerCase() === op.column.toLowerCase()
              ? { name: op.column, type }
              : undefined
        );
        if (built.filterControls.length === 0) {
          throw new ValidationError(`Op ${index + 1}: ${built.warnings.join(' ') || 'the filter could not be built'}`);
        }
        definition.FilterGroups = [...(definition.FilterGroups ?? []), ...built.filterGroups];
        sheet.FilterControls = [...(sheet.FilterControls ?? []), ...built.filterControls];
        sheet.SheetControlLayouts = controlBar([
          ...controlBarElements(sheet).map((e) => ({ id: e.ElementId, type: e.ElementType, span: e.ColumnSpan })),
          ...built.controlIds.map((id) => ({ id, type: 'FILTER_CONTROL' as const })),
        ]);
        changes.push({
          kind: 'filter',
          sheetId: op.sheetId,
          elementId: built.controlIds[0],
          description: `Added a filter on ${op.column} to the control bar of ${sheetName}`,
        });
        break;
      }
      default:
        throw new ValidationError(`Op ${index + 1}: unknown op '${(op as any).op}'`);
    }
  });

  return { definition, changes };
}

/** A column's type as the definition uses it: a date dimension, a number measure, or text. */
function columnTypeIn(definition: any, identifier: string, column: string): string | undefined {
  let found: string | undefined;
  const visit = (node: any, key?: string) => {
    if (found || typeof node !== 'object' || node === null) return;
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
      return;
    }
    const col = node.Column;
    if (
      key &&
      col?.DataSetIdentifier === identifier &&
      String(col?.ColumnName ?? '').toLowerCase() === column.toLowerCase()
    ) {
      if (key === 'DateDimensionField') found = 'DATETIME';
      else if (key === 'NumericalMeasureField' || key === 'NumericalDimensionField') found = 'DECIMAL';
      else if (key === 'CategoricalDimensionField' || key === 'CategoricalMeasureField') found = 'STRING';
      if (found) return;
    }
    for (const [k, v] of Object.entries(node)) visit(v, k);
  };
  visit(definition.Sheets);
  return found;
}

function labelFor(sheet: any, elementId: string): string {
  const visual = (sheet.Visuals ?? []).map(visualEntry).find((e: any) => e?.[1].VisualId === elementId);
  if (visual) {
    return titleOf(visual[1], `the ${visualTypeName(visual[0])}`);
  }
  const text = (sheet.TextBoxes ?? []).find((t: any) => t?.SheetTextBoxId === elementId);
  if (text) {
    return 'the text box';
  }
  return `element '${elementId}'`;
}

function describeType(type: string, body?: any): string {
  if (type === 'BarChart' && body?.ChartConfiguration?.Orientation === 'VERTICAL') {
    return 'a column chart';
  }
  const words = type.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return /^[aeiou]/.test(words) ? `an ${words}` : `a ${words}`;
}

/** Validate a raw op list from a request or a planner. */
export function parseOps(raw: unknown): DefinitionOp[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new ValidationError('ops must be an array');
  }
  return raw.map((item, index) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const op = entry.op;
    const sheetId = typeof entry.sheetId === 'string' ? entry.sheetId.trim() : '';
    if (!sheetId) {
      throw new ValidationError(`ops[${index}].sheetId is required`);
    }
    const elementId = typeof entry.elementId === 'string' ? entry.elementId.trim() : '';
    const needElement = () => {
      if (!elementId) {
        throw new ValidationError(`ops[${index}].elementId is required for '${String(op)}'`);
      }
      return elementId;
    };
    switch (op) {
      case 'move':
        return { op, sheetId, elementId: needElement(), col: Number(entry.col), row: Number(entry.row) };
      case 'resize':
        return { op, sheetId, elementId: needElement(), colSpan: Number(entry.colSpan), rowSpan: Number(entry.rowSpan) };
      case 'retype':
        return { op, sheetId, elementId: needElement(), visualType: String(entry.visualType) as EditableVisualType };
      case 'retitle':
        return {
          op,
          sheetId,
          elementId: needElement(),
          title: typeof entry.title === 'string' ? entry.title : undefined,
          subtitle: typeof entry.subtitle === 'string' ? entry.subtitle : undefined,
        };
      case 'remove':
        return { op, sheetId, elementId: needElement() };
      case 'duplicate':
        return {
          op,
          sheetId,
          elementId: needElement(),
          title: typeof entry.title === 'string' ? entry.title : undefined,
          col: typeof entry.col === 'number' ? entry.col : undefined,
          row: typeof entry.row === 'number' ? entry.row : undefined,
        };
      case 'renameSheet':
        return { op, sheetId, name: String(entry.name ?? '') };
      case 'addFilter': {
        const identifier = typeof entry.identifier === 'string' ? entry.identifier.trim() : '';
        const column = typeof entry.column === 'string' ? entry.column.trim() : '';
        if (!identifier || !column) {
          throw new ValidationError(`ops[${index}]: addFilter needs identifier (the dataset identifier, not its ARN) and column`);
        }
        return {
          op,
          sheetId,
          identifier,
          column,
          ...(typeof entry.columnType === 'string' && entry.columnType ? { columnType: entry.columnType } : {}),
          ...(typeof entry.title === 'string' && entry.title ? { title: entry.title } : {}),
          ...(Array.isArray(entry.values) ? { values: entry.values.filter((v): v is string => typeof v === 'string') } : {}),
          ...(typeof entry.min === 'number' ? { min: entry.min } : {}),
          ...(typeof entry.max === 'number' ? { max: entry.max } : {}),
        };
      }
      default:
        throw new ValidationError(`ops[${index}].op '${String(op)}' is not one of move, resize, retype, retitle, remove, duplicate, renameSheet, addFilter`);
    }
  });
}
