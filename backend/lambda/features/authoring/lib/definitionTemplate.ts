/**
 * Migrate a definition onto a template dashboard's layout standard.
 *
 * The template contributes its furniture and its look; the source
 * contributes what it shows. Per sheet (source sheet i pairs with template
 * sheet i, the last template sheet serving any extra source sheets):
 *
 * - the template's text boxes and title band come across at their positions,
 *   and so does any furniture below the visuals (a notes footer);
 * - the template's filter and parameter controls come across when the source
 *   has a column of the same name on one of its datasets; otherwise they are
 *   dropped and said so. Each keeps where it sat: in the control bar (the
 *   collapsible strip, QuickSight's default) or on the canvas;
 * - the sheet takes the template's name;
 * - the source's visuals reflow, in their original order, into rows of the
 *   template's standard tile size below the top furniture, KPIs first (at
 *   the template's KPI size) when the template has a KPI band;
 * - the source's own text boxes follow the visuals; its own controls are
 *   replaced by the template's when the template has any.
 *
 * The theme is asset-level, not part of the definition: the result carries
 * the template's theme ARN for the caller to write.
 */
import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/ValidationError';
import { type ControlBarElement, controlBar, controlBarElements, controlBarIds } from './controlBar';
import { isColumnIdentifier } from './definitionColumns';
import { type DefinitionChange, GRID_COLUMNS } from './definitionOps';

const DEFAULT_TILE = { colSpan: 12, rowSpan: 10 };
const TEXT_BOX_TILE = { colSpan: GRID_COLUMNS, rowSpan: 3 };
const CONTROL_TILE = { colSpan: 9, rowSpan: 3 };
const ID_SUFFIX_LENGTH = 8;
const KPI_TYPE = 'KPIVisual';

export interface TemplateOptions {
  /** Carry the template's text boxes (and any footer furniture). Default true. */
  textBoxes?: boolean;
  /** Carry the template's filter and parameter controls where they can be rebound. Default true. */
  controls?: boolean;
  /** Take the template's sheet names. Default true. */
  sheetNames?: boolean;
  /** Place KPIs first, at the template's KPI size, when the template has a KPI band. Default true. */
  kpisFirst?: boolean;
  /** Columns each source dataset identifier has, for rebinding the template's controls. */
  columnsByIdentifier?: Map<string, Set<string>>;
  /** The template asset's theme ARN, returned for the caller to apply. */
  themeArn?: string;
}

export interface TemplateResult {
  definition: Record<string, any>;
  changes: DefinitionChange[];
  warnings: string[];
  themeArn?: string;
}

interface Tile {
  colSpan: number;
  rowSpan: number;
}

interface GridElement {
  ElementId: string;
  ElementType: string;
  ColumnIndex?: number;
  ColumnSpan: number;
  RowIndex?: number;
  RowSpan: number;
}

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, ID_SUFFIX_LENGTH)}`;
}

function gridOf(sheet: any): GridElement[] {
  return sheet?.Layouts?.[0]?.Configuration?.GridLayout?.Elements ?? [];
}

function visualEntry(wrapper: any): [string, any] | null {
  const entry = Object.entries(wrapper ?? {}).find(([, body]) => body && typeof body === 'object');
  return entry ? [entry[0], entry[1]] : null;
}

function median(values: number[], fallback: number): number {
  if (values.length === 0) {
    return fallback;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** The template's standard tile, and its KPI tile when it has a KPI band. */
export function templateTiles(templateSheet: any): { tile: Tile; kpi: Tile | null } {
  const grid = gridOf(templateSheet);
  const byId = new Map<string, string>();
  for (const wrapper of templateSheet?.Visuals ?? []) {
    const entry = visualEntry(wrapper);
    if (entry) {
      byId.set(entry[1].VisualId, entry[0]);
    }
  }
  const visuals = grid.filter((e) => e.ElementType === 'VISUAL');
  const kpis = visuals.filter((e) => byId.get(e.ElementId) === KPI_TYPE);
  const others = visuals.filter((e) => byId.get(e.ElementId) !== KPI_TYPE);
  const source = others.length > 0 ? others : visuals;
  return {
    tile: {
      colSpan: median(source.map((e) => e.ColumnSpan), DEFAULT_TILE.colSpan),
      rowSpan: median(source.map((e) => e.RowSpan), DEFAULT_TILE.rowSpan),
    },
    kpi:
      kpis.length > 0
        ? {
            colSpan: median(kpis.map((e) => e.ColumnSpan), DEFAULT_TILE.colSpan),
            rowSpan: median(kpis.map((e) => e.RowSpan), DEFAULT_TILE.rowSpan),
          }
        : null,
  };
}

/** Lay tiles left to right, top to bottom, from a starting row. Returns the row after the last. */
export function reflow(
  items: Array<{ id: string; tile: Tile }>,
  startRow: number
): { elements: GridElement[]; bottom: number } {
  const elements: GridElement[] = [];
  let col = 0;
  let row = startRow;
  let rowHeight = 0;
  for (const { id, tile } of items) {
    const colSpan = Math.min(Math.max(tile.colSpan, 1), GRID_COLUMNS);
    if (col + colSpan > GRID_COLUMNS) {
      col = 0;
      row += rowHeight;
      rowHeight = 0;
    }
    elements.push({
      ElementId: id,
      ElementType: 'VISUAL',
      ColumnIndex: col,
      ColumnSpan: colSpan,
      RowIndex: row,
      RowSpan: tile.rowSpan,
    });
    col += colSpan;
    rowHeight = Math.max(rowHeight, tile.rowSpan);
  }
  return { elements, bottom: row + rowHeight };
}

function sourceOrder(sheet: any): string[] {
  const grid = gridOf(sheet);
  const position = new Map(grid.map((e) => [e.ElementId, e]));
  const ids = (sheet.Visuals ?? [])
    .map((w: any) => visualEntry(w)?.[1].VisualId)
    .filter((id: unknown): id is string => typeof id === 'string');
  return [...ids].sort((a, b) => {
    const ea = position.get(a);
    const eb = position.get(b);
    const ra = ea?.RowIndex ?? Number.MAX_SAFE_INTEGER;
    const rb = eb?.RowIndex ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return (ea?.ColumnIndex ?? 0) - (eb?.ColumnIndex ?? 0) || ids.indexOf(a) - ids.indexOf(b);
  });
}

function rewriteIdentifiers(node: unknown, from: string, to: string): void {
  if (Array.isArray(node)) {
    node.forEach((n) => rewriteIdentifiers(n, from, to));
    return;
  }
  if (typeof node !== 'object' || node === null) {
    return;
  }
  if (isColumnIdentifier(node) && node.DataSetIdentifier === from) {
    node.DataSetIdentifier = to;
    return;
  }
  for (const value of Object.values(node as Record<string, unknown>)) {
    rewriteIdentifiers(value, from, to);
  }
}

function columnRefs(node: unknown, out: Array<{ DataSetIdentifier: string; ColumnName: string }> = []) {
  if (Array.isArray(node)) {
    node.forEach((n) => columnRefs(n, out));
  } else if (typeof node === 'object' && node !== null) {
    if (isColumnIdentifier(node)) {
      out.push({ DataSetIdentifier: node.DataSetIdentifier, ColumnName: node.ColumnName });
    } else {
      Object.values(node as Record<string, unknown>).forEach((v) => columnRefs(v, out));
    }
  }
  return out;
}

/** The source identifier that has every column a template fragment reads, or null. */
function rebindTarget(
  fragment: unknown,
  columnsByIdentifier: Map<string, Set<string>>
): { from: string; to: string } | null {
  const refs = columnRefs(fragment);
  if (refs.length === 0) {
    return { from: '', to: '' };
  }
  const from = refs[0]!.DataSetIdentifier;
  if (refs.some((r) => r.DataSetIdentifier !== from)) {
    return null;
  }
  for (const [identifier, columns] of columnsByIdentifier) {
    if (refs.every((r) => columns.has(r.ColumnName))) {
      return { from, to: identifier };
    }
  }
  return null;
}

export function applyTemplate(
  source: Record<string, any>,
  template: Record<string, any>,
  options: TemplateOptions = {}
): TemplateResult {
  const opts = {
    textBoxes: options.textBoxes ?? true,
    controls: options.controls ?? true,
    sheetNames: options.sheetNames ?? true,
    kpisFirst: options.kpisFirst ?? true,
    columnsByIdentifier: options.columnsByIdentifier ?? new Map<string, Set<string>>(),
  };
  const templateSheets: any[] = template.Sheets ?? [];
  if (templateSheets.length === 0) {
    throw new ValidationError('The template has no sheets');
  }
  const definition = structuredClone(source);
  const changes: DefinitionChange[] = [];
  const warnings: string[] = [];
  const declaredParameters = new Set(
    (definition.ParameterDeclarations ?? []).flatMap((d: any) =>
      Object.values(d ?? {}).map((x: any) => x?.Name)
    )
  );
  const templateFilters = new Map<string, { group: any; filter: any }>();
  for (const group of template.FilterGroups ?? []) {
    for (const filter of group.Filters ?? []) {
      const body = Object.values(filter ?? {})[0] as any;
      if (body?.FilterId) {
        templateFilters.set(body.FilterId, { group, filter });
      }
    }
  }
  const templateHasControls = templateSheets.some(
    (s) => (s.FilterControls?.length ?? 0) + (s.ParameterControls?.length ?? 0) > 0
  );
  /** Where a carried control goes: the canvas grid, or the control bar. */
  type Placement = { bar: false; rowOffset: number } | { bar: true };

  definition.Sheets = (definition.Sheets ?? []).map((sourceSheet: any, index: number) => {
    const templateSheet = templateSheets[Math.min(index, templateSheets.length - 1)];
    const sheet = structuredClone(sourceSheet);
    const sheetName = sheet.Name ?? sheet.SheetId;
    const { tile, kpi } = templateTiles(templateSheet);
    const templateGrid = gridOf(templateSheet);
    const templateVisualRows = templateGrid
      .filter((e) => e.ElementType === 'VISUAL')
      .map((e) => (e.RowIndex ?? 0) + e.RowSpan);
    const templateVisualTop = Math.min(
      ...templateGrid.filter((e) => e.ElementType === 'VISUAL').map((e) => e.RowIndex ?? 0),
      Number.MAX_SAFE_INTEGER
    );
    const templateVisualBottom = templateVisualRows.length ? Math.max(...templateVisualRows) : 0;

    // 1. Furniture: template elements that are not visuals, split into the
    //    band above the visuals and the footer below.
    const elements: GridElement[] = [];
    const textBoxes: any[] = [];
    const filterControls: any[] = [];
    const parameterControls: any[] = [];
    const barElements: Array<{ id: string; type: ControlBarElement['ElementType']; span: number }> = [];
    const furniture = templateGrid.filter((e) => e.ElementType !== 'VISUAL');
    const top = furniture.filter((e) => (e.RowIndex ?? 0) < templateVisualTop);
    const footer = furniture.filter((e) => (e.RowIndex ?? 0) >= templateVisualTop);
    let topBottom = 0;
    const idMap = new Map<string, string>();

    const put = (element: GridElement, id: string, where: Placement) => {
      if (where.bar) {
        barElements.push({ id, type: element.ElementType as ControlBarElement['ElementType'], span: element.ColumnSpan });
      } else {
        elements.push({ ...element, ElementId: id, RowIndex: (element.RowIndex ?? 0) + where.rowOffset });
      }
    };
    const carry = (element: GridElement, rowOffset: number, where: Placement = { bar: false, rowOffset }): boolean => {
      if (element.ElementType === 'TEXT_BOX') {
        if (!opts.textBoxes) return false;
        const box = (templateSheet.TextBoxes ?? []).find((t: any) => t.SheetTextBoxId === element.ElementId);
        if (!box) return false;
        const id = newId('tpl-text');
        textBoxes.push({ ...structuredClone(box), SheetTextBoxId: id });
        idMap.set(element.ElementId, id);
        elements.push({ ...element, ElementId: id, RowIndex: (element.RowIndex ?? 0) + rowOffset });
        return true;
      }
      if (!opts.controls) return false;
      if (element.ElementType === 'FILTER_CONTROL') {
        const control = (templateSheet.FilterControls ?? []).find(
          (c: any) => Object.values(c ?? {})[0] && (Object.values(c)[0] as any).FilterControlId === element.ElementId
        );
        if (!control) return false;
        const [kind, body] = Object.entries(control)[0] as [string, any];
        const source = templateFilters.get(body.SourceFilterId);
        if (!source) return false;
        const target = rebindTarget(source.filter, opts.columnsByIdentifier);
        if (!target) {
          warnings.push(
            `Template control '${body.Title ?? body.FilterControlId}' was dropped: no dataset here has the columns it filters.`
          );
          return false;
        }
        const filter = structuredClone(source.filter);
        const filterBody = Object.values(filter)[0] as any;
        filterBody.FilterId = newId('tpl-filter');
        rewriteIdentifiers(filter, target.from, target.to);
        definition.FilterGroups = [
          ...(definition.FilterGroups ?? []),
          {
            FilterGroupId: newId('tpl-fg'),
            Filters: [filter],
            ScopeConfiguration: { AllSheets: {} },
            CrossDataset: source.group.CrossDataset ?? 'SINGLE_DATASET',
            Status: source.group.Status,
          },
        ];
        const id = newId('tpl-control');
        filterControls.push({
          [kind]: { ...structuredClone(body), FilterControlId: id, SourceFilterId: filterBody.FilterId },
        });
        put(element, id, where);
        return true;
      }
      if (element.ElementType === 'PARAMETER_CONTROL') {
        const control = (templateSheet.ParameterControls ?? []).find(
          (c: any) => Object.values(c ?? {})[0] && (Object.values(c)[0] as any).ParameterControlId === element.ElementId
        );
        if (!control) return false;
        const [kind, body] = Object.entries(control)[0] as [string, any];
        const copy = structuredClone(body);
        if (copy.SelectableValues?.LinkToDataSetColumn) {
          const target = rebindTarget(copy.SelectableValues, opts.columnsByIdentifier);
          if (target) {
            rewriteIdentifiers(copy.SelectableValues, target.from, target.to);
          } else {
            delete copy.SelectableValues;
            warnings.push(
              `Template control '${body.Title ?? body.ParameterControlId}' lost its value list: no dataset here has that column.`
            );
          }
        }
        if (!declaredParameters.has(copy.SourceParameterName)) {
          const declaration = (template.ParameterDeclarations ?? []).find((d: any) =>
            Object.values(d ?? {}).some((x: any) => x?.Name === copy.SourceParameterName)
          );
          if (declaration) {
            definition.ParameterDeclarations = [...(definition.ParameterDeclarations ?? []), structuredClone(declaration)];
            declaredParameters.add(copy.SourceParameterName);
          } else {
            warnings.push(`Template control '${body.Title ?? body.ParameterControlId}' was dropped: its parameter is not declared.`);
            return false;
          }
        }
        const id = newId('tpl-control');
        copy.ParameterControlId = id;
        parameterControls.push({ [kind]: copy });
        put(element, id, where);
        return true;
      }
      return false;
    };

    for (const element of top) {
      if (carry(element, 0)) {
        topBottom = Math.max(topBottom, (element.RowIndex ?? 0) + element.RowSpan);
      }
    }
    // The template's control bar comes across as a control bar.
    for (const bar of controlBarElements(templateSheet)) {
      carry({ ...bar, ColumnIndex: 0, RowIndex: 0 } as GridElement, 0, { bar: true });
    }

    // 2. Visuals reflow below the band: KPIs first at the KPI size when the
    //    template has a KPI band, then everything else at the standard tile.
    const typeOf = new Map<string, string>();
    for (const wrapper of sheet.Visuals ?? []) {
      const entry = visualEntry(wrapper);
      if (entry) typeOf.set(entry[1].VisualId, entry[0]);
    }
    let order = sourceOrder(sheet);
    if (opts.kpisFirst && kpi) {
      order = [...order.filter((id) => typeOf.get(id) === KPI_TYPE), ...order.filter((id) => typeOf.get(id) !== KPI_TYPE)];
    }
    const flowed = reflow(
      order.map((id) => ({ id, tile: kpi && typeOf.get(id) === KPI_TYPE ? kpi : tile })),
      topBottom
    );
    elements.push(...flowed.elements);
    let bottom = flowed.bottom;

    // 3. The source's own text boxes follow, full width; its own controls are
    //    replaced by the template's when the template supplies any.
    const ownBoxes = reflow(
      (sheet.TextBoxes ?? []).map((t: any) => ({ id: t.SheetTextBoxId, tile: TEXT_BOX_TILE })),
      bottom
    );
    for (const element of ownBoxes.elements) {
      elements.push({ ...element, ElementType: 'TEXT_BOX' });
    }
    bottom = ownBoxes.bottom;
    const ownControls = (sheet.FilterControls?.length ?? 0) + (sheet.ParameterControls?.length ?? 0);
    if (templateHasControls && opts.controls) {
      if (ownControls > 0) {
        changes.push({
          kind: 'template',
          sheetId: sheet.SheetId,
          description: `Replaced ${ownControls} control${ownControls === 1 ? '' : 's'} on ${sheetName} with the template's`,
        });
      }
      sheet.FilterControls = filterControls;
      sheet.ParameterControls = parameterControls;
      sheet.SheetControlLayouts = controlBar(barElements);
    } else {
      // The source's own control bar stays a control bar; the template's joins it.
      const ownBar = controlBarElements(sheet).map((e) => ({ id: e.ElementId, type: e.ElementType, span: e.ColumnSpan }));
      const bar = controlBar([...ownBar, ...barElements]);
      if (bar.length > 0) {
        sheet.SheetControlLayouts = bar;
      }
      const inBar = new Set([...controlBarIds(sheet), ...barElements.map((b) => b.id)]);
      sheet.FilterControls = [...(sheet.FilterControls ?? []), ...filterControls];
      sheet.ParameterControls = [...(sheet.ParameterControls ?? []), ...parameterControls];
      // The source's own controls keep their grid size when they had one,
      // and get a default control tile when the source never placed them.
      const sized = new Map(gridOf(sheet).map((e) => [e.ElementId, e]));
      const own: Array<{ id: string; type: string }> = [
        ...sheet.FilterControls.map((c: any) => ({
          id: (Object.values(c)[0] as any)?.FilterControlId,
          type: 'FILTER_CONTROL',
        })),
        ...sheet.ParameterControls.map((c: any) => ({
          id: (Object.values(c)[0] as any)?.ParameterControlId,
          type: 'PARAMETER_CONTROL',
        })),
      ].filter((c) => typeof c.id === 'string' && !inBar.has(c.id) && !elements.some((e) => e.ElementId === c.id));
      const placed = reflow(
        own.map((c) => {
          const e = sized.get(c.id);
          return { id: c.id, tile: e ? { colSpan: e.ColumnSpan, rowSpan: e.RowSpan } : CONTROL_TILE };
        }),
        bottom
      );
      for (const element of placed.elements) {
        elements.push({ ...element, ElementType: own.find((c) => c.id === element.ElementId)!.type });
      }
      bottom = placed.bottom;
    }

    // 4. Footer furniture, at the same distance below the visuals as in the template.
    for (const element of footer) {
      carry(element, bottom - templateVisualBottom);
    }

    sheet.TextBoxes = [...textBoxes, ...(sheet.TextBoxes ?? [])];
    sheet.Layouts = [{ Configuration: { GridLayout: { Elements: elements } } }];
    if (opts.sheetNames && templateSheet.Name && templateSheet.Name !== sheet.Name) {
      changes.push({ kind: 'sheet', sheetId: sheet.SheetId, description: `Renamed sheet '${sheetName}' to '${templateSheet.Name}'` });
      sheet.Name = templateSheet.Name;
    }
    const carried = textBoxes.length + filterControls.length + parameterControls.length;
    changes.push({
      kind: 'template',
      sheetId: sheet.SheetId,
      description: `Laid out ${order.length} visual${order.length === 1 ? '' : 's'} on ${sheet.Name ?? sheetName} in ${tile.colSpan}x${tile.rowSpan} tiles${kpi ? ` (KPIs ${kpi.colSpan}x${kpi.rowSpan} first)` : ''}${carried ? `, with ${carried} element${carried === 1 ? '' : 's'} from the template` : ''}`,
    });
    return sheet;
  });

  return { definition, changes, warnings, themeArn: options.themeArn };
}
