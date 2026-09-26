/**
 * Helpers around DefinitionOp: what the editor may do to an element, how to
 * say an op in plain words, and where an element is in the server's outline.
 */
import type { WireframeModel } from '@/entities/definition';

import type {
  DefinitionChange,
  DefinitionOp,
  SheetOutline,
  SheetOutlineElement,
} from '@/shared/api/modules/authoring';

/**
 * The outline the server would send for a model, so the editor can start
 * from the source before the first preview comes back.
 */
export function outlineFromModel(model: WireframeModel): SheetOutline[] {
  return model.sheets.map((sheet) => ({
    sheetId: sheet.id,
    name: sheet.name,
    layout: sheet.layout,
    elements: [...sheet.elements, ...sheet.controlBar].map((e) => ({
      elementId: e.id,
      kind: e.kind,
      visualType: e.visualType,
      title: e.title,
      ...(e.position.type === 'grid'
        ? {
            col: e.position.col,
            row: e.position.row,
            colSpan: e.position.colSpan,
            rowSpan: e.position.rowSpan,
          }
        : {}),
      fieldWells: e.fieldWells.map((w) => ({
        role: w.role,
        fields: w.fields.map((f) => f.label),
      })),
    })),
  }));
}

type RetypableVisualType = NonNullable<DefinitionOp['visualType']>;

/** The conversions the server accepts: field wells translate between these. */
export const RETYPABLE_TYPES: ReadonlyArray<{ value: RetypableVisualType; label: string }> = [
  { value: 'BarChart', label: 'Bar chart' },
  { value: 'ColumnChart', label: 'Column chart' },
  { value: 'LineChart', label: 'Line chart' },
  { value: 'PieChart', label: 'Pie chart' },
  { value: 'DonutChart', label: 'Donut chart' },
  { value: 'Table', label: 'Table' },
  { value: 'PivotTable', label: 'Pivot table' },
];

export function isRetypable(visualType: string | undefined): visualType is RetypableVisualType {
  return RETYPABLE_TYPES.some((t) => t.value === visualType);
}

const GRID_COLUMNS = 36;
const MAX_COL = GRID_COLUMNS - 1;

export const clampCol = (col: number): number => Math.min(MAX_COL, Math.max(0, Math.round(col)));
export const clampRow = (row: number): number => Math.max(0, Math.round(row));
/** A span fits between 1 and whatever is left of the grid from `col`. */
export const clampColSpan = (span: number, col = 0): number =>
  Math.min(GRID_COLUMNS - clampCol(col), Math.max(1, Math.round(span)));
export const clampRowSpan = (span: number): number => Math.max(1, Math.round(span));

export function findOutlineElement(
  outline: SheetOutline[] | null | undefined,
  sheetId: string,
  elementId: string
): { sheet: SheetOutline; element: SheetOutlineElement } | null {
  const sheet = outline?.find((s) => s.sheetId === sheetId);
  const element = sheet?.elements.find((e) => e.elementId === elementId);
  return sheet && element ? { sheet, element } : null;
}

/** "BarChart" -> "bar chart". */
export function typeWords(type: string | undefined): string {
  return (type ?? 'visual').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function elementName(op: DefinitionOp, outline?: SheetOutline[] | null): string {
  const hit = op.elementId ? findOutlineElement(outline, op.sheetId, op.elementId) : null;
  const title = hit?.element.title;
  return title ? `"${title}"` : (op.elementId ?? 'element');
}

function sheetName(op: DefinitionOp, outline?: SheetOutline[] | null): string {
  const sheet = outline?.find((s) => s.sheetId === op.sheetId);
  return sheet ? `"${sheet.name}"` : op.sheetId;
}

/** One op in plain language, for the edits list. */
export function describeOp(op: DefinitionOp, outline?: SheetOutline[] | null): string {
  const name = elementName(op, outline);
  switch (op.op) {
    case 'move':
      return `Move ${name} to column ${op.col ?? 0}, row ${op.row ?? 0}`;
    case 'resize':
      return `Resize ${name} to ${op.colSpan ?? 1} × ${op.rowSpan ?? 1}`;
    case 'retype':
      return `Change ${name} to a ${typeWords(op.visualType)}`;
    case 'retitle': {
      const parts: string[] = [];
      if (op.title !== undefined) {
        parts.push(`title "${op.title}"`);
      }
      if (op.subtitle !== undefined) {
        parts.push(op.subtitle ? `subtitle "${op.subtitle}"` : 'no subtitle');
      }
      return `Retitle ${name}: ${parts.join(', ') || 'unchanged'}`;
    }
    case 'remove':
      return `Remove ${name}`;
    case 'duplicate':
      return `Duplicate ${name}${op.title ? ` as "${op.title}"` : ''}`;
    case 'renameSheet': {
      const current = sheetName(op, outline);
      return current === `"${op.name}"`
        ? `Rename sheet to "${op.name ?? ''}"`
        : `Rename sheet ${current} to "${op.name ?? ''}"`;
    }
    default:
      return op.op;
  }
}

/** The change kind an op produces, mirroring the server's change list. */
export function opChangeKind(op: DefinitionOp): DefinitionChange['kind'] {
  switch (op.op) {
    case 'move':
    case 'resize':
    case 'remove':
    case 'duplicate':
      return 'layout';
    case 'renameSheet':
      return 'sheet';
    default:
      return 'visual';
  }
}

export const CHANGE_KIND_LABELS: Record<DefinitionChange['kind'], string> = {
  template: 'Template',
  repair: 'Repair',
  rebind: 'Dataset',
  rename: 'Column',
  calculatedField: 'Calculated field',
  layout: 'Layout',
  visual: 'Visual',
  sheet: 'Sheet',
  filter: 'Filter',
};

const CHANGE_KIND_ORDER: DefinitionChange['kind'][] = [
  'template',
  'repair',
  'rebind',
  'rename',
  'calculatedField',
  'sheet',
  'layout',
  'visual',
  'filter',
];

/** Changes grouped by kind in a fixed order, empty kinds left out. */
export function groupChanges(
  changes: DefinitionChange[]
): Array<{ kind: DefinitionChange['kind']; label: string; items: DefinitionChange[] }> {
  return CHANGE_KIND_ORDER.map((kind) => ({
    kind,
    label: CHANGE_KIND_LABELS[kind],
    items: changes.filter((c) => c.kind === kind),
  })).filter((g) => g.items.length > 0);
}
