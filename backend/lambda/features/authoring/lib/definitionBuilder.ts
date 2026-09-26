/**
 * Build a definition from nothing: the datasets it reads and the visuals
 * it shows, described by column names rather than QuickSight JSON. Field
 * wells follow the visual type (the same roles the retype op uses), a
 * column's type decides whether it is a date, a category or a measure, and
 * the sheet is laid out by fixed rules (see layoutSheet), so a model only
 * says what to show, never how big. Filters are by column name too; each
 * gets a control in the sheet's control bar, where QuickSight puts them by
 * default, or on the canvas above the visuals when placed there
 * (definitionFilters, controlBar). A visual can carry interactions: a click
 * that filters other visuals, or opens a sheet (visualActions); filters and
 * actions name visuals by their key.
 *
 * Anything asked for that cannot be built (an unknown dataset, a column the
 * dataset does not have, a control that does not fit its column) is an
 * error, not a quiet omission: the caller refuses the whole build, because
 * a preview that silently drops what the person asked for is worse than
 * one that says why it cannot.
 */
import { randomUUID } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/ValidationError';
import type { TargetColumn } from './columnResolution';
import { controlBar } from './controlBar';
import { buildFilters, type FilterSpec } from './definitionFilters';
import { CONTROL_TILE, GRID_COLUMNS, reflow, type Tile } from './grid';
import { buildActions } from './visualActions';
import {
  type BuildableVisualType,
  buildVisual,
  CHART_TILE,
  DETAIL_TYPES,
  TABLE_TILE,
  type VisualSpec,
  WIDE_CHART_TILE,
} from './visualBuilder';

export type { FilterSpec } from './definitionFilters';
export { BUILDABLE_VISUAL_TYPES, type VisualSpec } from './visualBuilder';

export interface BuilderDataset {
  identifier: string;
  dataSetArn: string;
  columns: TargetColumn[];
}

interface BuildResult {
  definition: Record<string, any>;
  warnings: string[];
  /** What was asked for and could not be built; the build must be refused. */
  errors: string[];
}

const ID_LENGTH = 8;
/**
 * The layout rules, in grid units (36 columns wide): KPIs in a band at
 * the top (controls are in the control bar, not on the canvas), sharing the
 * width (at most four to a row); charts two to a row, a chart left alone
 * on its row taking the full width; tables and pivot tables full width
 * and tall, last, because detail reads best across the page.
 */
const KPI_ROW_HEIGHT = 6;
const KPIS_PER_ROW = 4;
const MAX_VISUALS = 60;

function newId(prefix: string): string {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, ID_LENGTH)}`;
}

/** Place a sheet's visuals (and any controls placed on the canvas) by the rules above. */
function layoutSheet(
  visuals: Array<{ id: string; type: BuildableVisualType }>,
  canvasControls: string[] = []
): any[] {
  const elements: any[] = [];
  let row = 0;
  const band = (items: Array<{ id: string; tile: Tile }>, type: string) => {
    if (items.length === 0) return;
    const placed = reflow(items, row);
    elements.push(...placed.elements.map((e) => ({ ...e, ElementType: type })));
    row = placed.bottom;
  };
  band(
    canvasControls.map((id) => ({ id, tile: CONTROL_TILE })),
    'FILTER_CONTROL'
  );
  const kpis = visuals.filter((v) => v.type === 'KPI');
  const kpiWidth = Math.floor(GRID_COLUMNS / Math.min(Math.max(kpis.length, 1), KPIS_PER_ROW));
  band(
    kpis.map((v) => ({ id: v.id, tile: { colSpan: kpiWidth, rowSpan: KPI_ROW_HEIGHT } })),
    'VISUAL'
  );
  const charts = visuals.filter((v) => v.type !== 'KPI' && !DETAIL_TYPES.has(v.type));
  band(
    charts.map((v, i) => ({
      id: v.id,
      // The last chart of an odd count has its row to itself.
      tile: i === charts.length - 1 && charts.length % 2 === 1 ? WIDE_CHART_TILE : CHART_TILE,
    })),
    'VISUAL'
  );
  band(
    visuals.filter((v) => DETAIL_TYPES.has(v.type)).map((v) => ({ id: v.id, tile: TABLE_TILE })),
    'VISUAL'
  );
  return elements;
}

export function buildDefinition(input: {
  datasets: BuilderDataset[];
  visuals: VisualSpec[];
  filters?: FilterSpec[];
  sheetName?: string;
}): BuildResult {
  if (input.datasets.length === 0) {
    throw new ValidationError('At least one dataset is required');
  }
  const warnings: string[] = [];
  const errors: string[] = [];
  const byIdentifier = new Map(input.datasets.map((d) => [d.identifier, d]));
  const columnOf = (identifier: string, name: string): TargetColumn | undefined =>
    byIdentifier.get(identifier)?.columns.find((c) => c.name.toLowerCase() === name.toLowerCase());

  if (input.visuals.length > MAX_VISUALS) {
    errors.push(
      `At most ${MAX_VISUALS} visuals on a sheet; ${input.visuals.length} were asked for.`
    );
  }
  const visuals: any[] = [];
  const placed: Array<{ id: string; type: BuildableVisualType; spec: VisualSpec; inner: any }> = [];
  for (const spec of input.visuals.slice(0, MAX_VISUALS)) {
    if (!byIdentifier.has(spec.identifier)) {
      errors.push(`'${spec.title}': no dataset '${spec.identifier}'.`);
      continue;
    }
    const built = buildVisual(spec, columnOf);
    if ('error' in built) {
      errors.push(built.error);
      continue;
    }
    visuals.push(built.visual);
    placed.push({ id: built.id, type: spec.type, spec, inner: built.inner });
  }

  // Filters and actions name visuals by key (or title), so they are built
  // once every visual has its id.
  const keyed = new Map<string, string>();
  for (const p of placed) {
    keyed.set((p.spec.key ?? p.spec.title).toLowerCase(), p.id);
    keyed.set(p.spec.title.toLowerCase(), p.id);
  }
  const visualIdOf = (key: string) => keyed.get(key.toLowerCase());
  const sheetId = newId('sheet');
  const sheetName = input.sheetName?.trim() || 'Overview';
  for (const p of placed) {
    if (!p.spec.actions?.length) continue;
    const built = buildActions(p.spec.actions, {
      identifier: p.spec.identifier,
      visual: p.spec.key ?? p.spec.title,
      visualIdOf,
      sheetIdOf: (name) => (name.toLowerCase() === sheetName.toLowerCase() ? sheetId : undefined),
    });
    errors.push(...built.errors);
    if (built.actions.length > 0) p.inner.Actions = built.actions;
  }
  const filters = buildFilters(sheetId, input.filters ?? [], columnOf, visualIdOf);
  errors.push(...filters.errors);

  const onCanvas = filters.controls.filter((c) => c.placement === 'canvas').map((c) => c.id);
  const inBar = filters.controls.filter((c) => c.placement === 'controlBar');
  const sheet: Record<string, any> = {
    SheetId: sheetId,
    Name: sheetName,
    Visuals: visuals,
    Layouts: [{ Configuration: { GridLayout: { Elements: layoutSheet(placed, onCanvas) } } }],
  };
  if (filters.filterControls.length > 0) {
    sheet.FilterControls = filters.filterControls;
  }
  if (inBar.length > 0) {
    sheet.SheetControlLayouts = controlBar(
      inBar.map((c) => ({ id: c.id, type: 'FILTER_CONTROL' as const, span: c.span }))
    );
  }
  const definition: Record<string, any> = {
    DataSetIdentifierDeclarations: input.datasets.map((d) => ({
      Identifier: d.identifier,
      DataSetArn: d.dataSetArn,
    })),
    Sheets: [sheet],
    AnalysisDefaults: { DefaultNewSheetConfiguration: { SheetContentType: 'INTERACTIVE' } },
  };
  if (filters.filterGroups.length > 0) {
    definition.FilterGroups = filters.filterGroups;
  }
  if (visuals.length === 0 && errors.length === 0) {
    warnings.push('No visuals were asked for; the sheet is empty.');
  }
  return { definition, warnings, errors };
}
