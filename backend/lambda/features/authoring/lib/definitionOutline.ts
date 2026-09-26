/**
 * A compact, id-bearing outline of a definition's sheets: what is on each
 * sheet, where, of what type, reading which fields. Small enough to hand to
 * a planner and precise enough to address edits by id. Pure.
 */
import { controlBarElements } from './controlBar';

type OutlineElementKind =
  | 'visual'
  | 'filterControl'
  | 'parameterControl'
  | 'textBox'
  | 'image'
  | 'other';

interface OutlineElement {
  elementId: string;
  kind: OutlineElementKind;
  visualType?: string;
  title?: string;
  col?: number;
  row?: number;
  colSpan?: number;
  rowSpan?: number;
  fieldWells?: Array<{ role: string; fields: string[] }>;
  /**
   * Controls only: 'controlBar' when the control sits in the sheet's
   * collapsible control bar (SheetControlLayouts), 'canvas' when it is
   * placed on the sheet like a visual.
   */
  placement?: 'canvas' | 'controlBar';
}

export interface SheetOutline {
  sheetId: string;
  name: string;
  layout: 'grid' | 'freeform' | 'section' | 'flow';
  elements: OutlineElement[];
}

const KIND_BY_ELEMENT_TYPE: Record<string, OutlineElementKind> = {
  VISUAL: 'visual',
  FILTER_CONTROL: 'filterControl',
  PARAMETER_CONTROL: 'parameterControl',
  TEXT_BOX: 'textBox',
  IMAGE: 'image',
};

export function stripHtml(input: unknown): string {
  if (typeof input !== 'string') {
    return '';
  }
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The one key of a `{ BarChartVisual: {...} }` wrapper, and its body. */
export function visualEntry(wrapper: unknown): [string, Record<string, any>] | null {
  if (typeof wrapper !== 'object' || wrapper === null) {
    return null;
  }
  const keys = Object.keys(wrapper as object);
  if (keys.length !== 1) {
    return null;
  }
  const key = keys[0] as string;
  const body = (wrapper as Record<string, any>)[key];
  return typeof body === 'object' && body !== null ? [key, body] : null;
}

export function visualTypeName(key: string): string {
  return key.replace(/Visual$/, '');
}

function labelOf(block: any): string | undefined {
  const text =
    block?.FormatText?.PlainText ??
    (block?.FormatText?.RichText ? stripHtml(block.FormatText.RichText) : undefined);
  return typeof text === 'string' && text.trim() ? text.trim() : undefined;
}

function fieldLabel(field: any): string {
  const entry = visualEntry(field);
  if (!entry) {
    return '';
  }
  const body = entry[1];
  const column = body.Column?.ColumnName;
  const agg =
    body.AggregationFunction?.SimpleNumericalAggregation ??
    body.AggregationFunction?.CategoricalAggregationFunction ??
    body.AggregationFunction?.DateAggregationFunction;
  const base = typeof column === 'string' ? column : String(body.FieldId ?? '');
  return agg ? `${agg}(${base})` : base;
}

/** Field wells by role, for any visual: `FieldWells.<X>AggregatedFieldWells.<Role>[]`. */
function fieldWellsOf(visualBody: Record<string, any>): Array<{ role: string; fields: string[] }> {
  const wells = visualBody.ChartConfiguration?.FieldWells;
  if (typeof wells !== 'object' || wells === null) {
    return [];
  }
  const out: Array<{ role: string; fields: string[] }> = [];
  const visit = (node: any) => {
    if (typeof node !== 'object' || node === null) {
      return;
    }
    for (const [role, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        const fields = value.map(fieldLabel).filter(Boolean);
        if (fields.length > 0) {
          out.push({ role, fields });
        }
      } else if (typeof value === 'object' && value !== null) {
        visit(value);
      }
    }
  };
  visit(wells);
  return out;
}

export function buildOutline(definition: any): SheetOutline[] {
  const sheets: any[] = Array.isArray(definition?.Sheets) ? definition.Sheets : [];
  return sheets.map((sheet, index) => {
    const catalog = new Map<string, Partial<OutlineElement>>();
    for (const wrapper of sheet.Visuals ?? []) {
      const entry = visualEntry(wrapper);
      if (!entry) {
        continue;
      }
      const [key, body] = entry;
      if (typeof body.VisualId === 'string') {
        catalog.set(body.VisualId, {
          kind: 'visual',
          visualType: visualTypeName(key),
          title: labelOf(body.Title),
          fieldWells: fieldWellsOf(body),
        });
      }
    }
    for (const t of sheet.TextBoxes ?? []) {
      if (t?.SheetTextBoxId) {
        catalog.set(String(t.SheetTextBoxId), {
          kind: 'textBox',
          title: stripHtml(t.Content) || undefined,
        });
      }
    }
    for (const c of sheet.FilterControls ?? []) {
      const entry = visualEntry(c);
      if (entry?.[1].FilterControlId) {
        catalog.set(String(entry[1].FilterControlId), {
          kind: 'filterControl',
          visualType: entry[0],
          title: typeof entry[1].Title === 'string' ? entry[1].Title : undefined,
        });
      }
    }
    for (const c of sheet.ParameterControls ?? []) {
      const entry = visualEntry(c);
      if (entry?.[1].ParameterControlId) {
        catalog.set(String(entry[1].ParameterControlId), {
          kind: 'parameterControl',
          visualType: entry[0],
          title: typeof entry[1].Title === 'string' ? entry[1].Title : undefined,
        });
      }
    }

    const configuration = sheet.Layouts?.[0]?.Configuration ?? {};
    const layout: SheetOutline['layout'] = configuration.GridLayout
      ? 'grid'
      : configuration.FreeFormLayout
        ? 'freeform'
        : configuration.SectionBasedLayout
          ? 'section'
          : 'flow';
    const placed: any[] =
      configuration.GridLayout?.Elements ?? configuration.FreeFormLayout?.Elements ?? [];

    const elements: OutlineElement[] = placed.map((e) => {
      const id = String(e.ElementId ?? '');
      const known = catalog.get(id) ?? {
        kind: KIND_BY_ELEMENT_TYPE[String(e.ElementType ?? '')] ?? 'other',
      };
      return {
        elementId: id,
        kind: known.kind ?? 'other',
        visualType: known.visualType,
        title: known.title,
        col: typeof e.ColumnIndex === 'number' ? e.ColumnIndex : undefined,
        row: typeof e.RowIndex === 'number' ? e.RowIndex : undefined,
        colSpan: typeof e.ColumnSpan === 'number' ? e.ColumnSpan : undefined,
        rowSpan: typeof e.RowSpan === 'number' ? e.RowSpan : undefined,
        fieldWells: known.fieldWells,
      };
    });
    for (const element of elements) {
      if (element.kind === 'filterControl' || element.kind === 'parameterControl') {
        element.placement = 'canvas';
      }
    }
    // Controls in the control bar, in its order.
    for (const bar of controlBarElements(sheet)) {
      const id = String(bar.ElementId ?? '');
      const known = catalog.get(id) ?? {
        kind: KIND_BY_ELEMENT_TYPE[String(bar.ElementType ?? '')] ?? 'other',
      };
      if (!elements.some((e) => e.elementId === id)) {
        elements.push({
          elementId: id,
          kind: known.kind ?? 'other',
          visualType: known.visualType,
          title: known.title,
          placement: 'controlBar',
        });
      }
    }
    // Defined but not placed still counts: it can be moved onto the grid.
    for (const [id, known] of catalog) {
      if (!elements.some((e) => e.elementId === id)) {
        elements.push({
          elementId: id,
          kind: known.kind ?? 'other',
          visualType: known.visualType,
          title: known.title,
          fieldWells: known.fieldWells,
        });
      }
    }

    return {
      sheetId: String(sheet.SheetId ?? `sheet-${index}`),
      name: typeof sheet.Name === 'string' && sheet.Name ? sheet.Name : `Sheet ${index + 1}`,
      layout,
      elements,
    };
  });
}
