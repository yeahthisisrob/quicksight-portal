/**
 * A filter added to an analysis or dashboard with no model in the loop: the
 * person names the column (and perhaps its control, the sheets and the
 * visuals), the asset's own outline says what there is, and code decides.
 * What they did not say and the asset does not settle is asked once, as a
 * question whose options are the real sheets and visuals; the answer comes
 * back as option ids, which say everything needed. Pure.
 */
import type { QuestionOption } from '../types';
import type { FilterScope, UnderstoodFilter } from './understanding';

interface SheetVisual {
  id: string;
  title: string;
  type?: string;
}

export interface FilterSheet {
  sheetId: string;
  name: string;
  visuals: SheetVisual[];
}

export interface FilterDataset {
  /** As the definition declares it. */
  identifier: string;
  dataSetId: string;
  name?: string;
  columns: Array<{ name: string; type?: string }>;
}

interface FilterQuestion {
  question: string;
  options: QuestionOption[];
  multi: boolean;
  allowOther: boolean;
}

/** The rebind request's addFilter op, as the API takes it. */
interface AddFilterOp {
  op: 'addFilter';
  sheetId: string;
  identifier: string;
  column: string;
  columnType?: string;
  control?: string;
  placement?: string;
  appliesTo?: string[];
  min?: number;
  max?: number;
}

export type FilterChange =
  /** Something only the person can settle; the run ends on this question. */
  | { ask: FilterQuestion }
  /** It cannot be done as asked; the conversation takes it from here with the reason. */
  | { problem: string }
  /** The change, as ops the preview checks, and what it does in words. */
  | { ops: AddFilterOp[]; summary: string };

/** Option ids carry the choice: `all`, `sheet:<sheetId>`, `visual:<sheetId>/<visualId>`, `dataset:<identifier>`. */
const ALL = 'all';
const SHEET = 'sheet:';
const VISUAL = 'visual:';
const DATASET = 'dataset:';
/** As many options as a question shows; past it, the visuals are named instead. */
export const MAX_SCOPE_OPTIONS = 12;
const MAX_NEAR = 5;
const NUMERIC = new Set(['INTEGER', 'DECIMAL']);
/** The column types an addFilter op may name; anything else is left for the definition to say. */
const COLUMN_TYPES = new Set(['STRING', 'INTEGER', 'DECIMAL', 'DATETIME']);

const CONTROLS: Record<string, string> = {
  dropdown: 'dropdown',
  singleselect: 'singleSelect',
  single: 'singleSelect',
  list: 'list',
  daterange: 'dateRange',
  date: 'dateRange',
  relativedate: 'relativeDate',
  relative: 'relativeDate',
  slider: 'slider',
  range: 'slider',
};
const PLACEMENTS: Record<string, string> = {
  controlbar: 'controlBar',
  bar: 'controlBar',
  top: 'controlBar',
  canvas: 'canvas',
  sheet: 'canvas',
};

/** The sheets of a preview's outline, with the visuals on each. */
export function sheetsOf(outline: unknown): FilterSheet[] {
  return (Array.isArray(outline) ? outline : [])
    .map((s: any) => ({
      sheetId: String(s?.sheetId ?? ''),
      name: String(s?.name ?? ''),
      visuals: (Array.isArray(s?.elements) ? s.elements : [])
        .filter((e: any) => e?.kind === 'visual' && typeof e?.elementId === 'string')
        .map((e: any) => ({
          id: String(e.elementId),
          title: typeof e.title === 'string' ? e.title : '',
          ...(typeof e.visualType === 'string' ? { type: e.visualType } : {}),
        })),
    }))
    .filter((s) => s.sheetId !== '');
}

/** The option ids a resolved answer chose; none when the payload is not an answer. */
export function selectedOf(payload: unknown): string[] {
  const selected = (payload as { selected?: unknown } | null)?.selected;
  return Array.isArray(selected) ? selected.filter((s): s is string => typeof s === 'string') : [];
}

/** Whether the ids an answer carries are this module's. */
export function isScopeAnswer(ids: string[]): boolean {
  return (
    ids.length > 0 &&
    ids.every(
      (id) => id === ALL || id.startsWith(SHEET) || id.startsWith(VISUAL) || id.startsWith(DATASET)
    )
  );
}

function fold(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** A name the person used against a thing's name: the same, or one inside the other. */
function names(said: string, actual: string): boolean {
  const [a, b] = [fold(said), fold(actual)];
  return a !== '' && b !== '' && (a === b || a.includes(b) || b.includes(a));
}

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function visualLabel(v: SheetVisual): string {
  return v.title || `Untitled ${v.type ?? 'visual'}`;
}

type Placed = {
  filter: UnderstoodFilter;
  dataset: FilterDataset;
  column: { name: string; type?: string };
};

/**
 * Each filter on the dataset that has its column: the one named, the one
 * chosen, or the only one that has it. Two that have it is a question;
 * none is a problem that names what there is.
 */
function placeFilters(
  filters: UnderstoodFilter[],
  datasets: FilterDataset[],
  chosen: string[]
): { placed: Placed[] } | { ask: FilterQuestion } | { problem: string } {
  const chosenIdentifiers = chosen
    .filter((c) => c.startsWith(DATASET))
    .map((c) => c.slice(DATASET.length));
  const placed: Placed[] = [];
  for (const filter of filters) {
    const pool = filter.dataset
      ? datasets.filter(
          (d) => names(filter.dataset!, d.identifier) || names(filter.dataset!, d.name ?? '')
        )
      : datasets;
    if (pool.length === 0) {
      return {
        problem: `It does not read a dataset called ${filter.dataset}; it reads ${list(datasets.map((d) => d.name ?? d.identifier))}.`,
      };
    }
    const wanted = fold(filter.column);
    const candidates = pool.flatMap((d) => {
      const has = d.columns.find((c) => fold(c.name) === wanted);
      return has ? [{ dataset: d, column: has }] : [];
    });
    if (candidates.length === 0) {
      const near = pool
        .flatMap((d) => d.columns.map((c) => c.name))
        .filter((n) => names(wanted, n))
        .slice(0, MAX_NEAR);
      return {
        problem: `No dataset it reads has a column named ${filter.column}${near.length ? `; the nearest are ${list(near)}` : ''}.`,
      };
    }
    const taken = candidates.find((c) => chosenIdentifiers.includes(c.dataset.identifier));
    if (candidates.length > 1 && !taken) {
      return {
        ask: {
          question: `Which dataset's ${candidates[0]!.column.name} should the filter use?`,
          options: candidates.map((c) => ({
            id: `${DATASET}${c.dataset.identifier}`,
            label: c.dataset.name ?? c.dataset.identifier,
            description: `Declared as ${c.dataset.identifier}`,
            entityId: `dataset:${c.dataset.dataSetId}`,
          })),
          multi: false,
          allowOther: false,
        },
      };
    }
    const { dataset, column } = taken ?? candidates[0]!;
    placed.push({ filter, dataset, column });
  }
  return { placed };
}

/** The sheets and, per sheet, the visuals a filter narrows (undefined: every visual). */
type Target = { sheet: FilterSheet; visuals?: SheetVisual[] };

/** What the answer's ids choose, when they choose anything. */
function targetsChosen(sheets: FilterSheet[], chosen: string[]): Target[] | undefined {
  if (chosen.includes(ALL)) {
    return sheets.map((sheet) => ({ sheet }));
  }
  const whole = new Set(
    chosen.filter((c) => c.startsWith(SHEET)).map((c) => c.slice(SHEET.length))
  );
  const picked = new Map<string, Set<string>>();
  for (const id of chosen.filter((c) => c.startsWith(VISUAL))) {
    const [sheetId, visualId] = id.slice(VISUAL.length).split('/');
    if (sheetId && visualId) {
      picked.set(sheetId, (picked.get(sheetId) ?? new Set()).add(visualId));
    }
  }
  if (whole.size === 0 && picked.size === 0) return undefined;
  return sheets.flatMap((sheet) => {
    if (whole.has(sheet.sheetId)) return [{ sheet }];
    const ids = picked.get(sheet.sheetId);
    const visuals = ids ? sheet.visuals.filter((v) => ids.has(v.id)) : [];
    return visuals.length ? [{ sheet, visuals }] : [];
  });
}

/**
 * What the person's words choose: the sheets named (or all), the visuals
 * named (or all), with named visuals also choosing their sheets when no
 * sheet was named. 'ask' when a name matches nothing or nothing was said
 * and the asset leaves a choice.
 */
function targetsSaid(sheets: FilterSheet[], scope: FilterScope): Target[] | 'ask' {
  const namedVisuals = Array.isArray(scope.visuals) ? scope.visuals : undefined;
  const namedSheets = Array.isArray(scope.sheets) ? scope.sheets : undefined;
  let inScope: FilterSheet[];
  if (namedSheets) {
    inScope = sheets.filter((s) => namedSheets.some((said) => names(said, s.name)));
    if (inScope.length === 0) return 'ask';
  } else if (scope.sheets === 'all' || sheets.length === 1) {
    inScope = sheets;
  } else if (namedVisuals) {
    inScope = sheets.filter((s) =>
      s.visuals.some((v) => namedVisuals.some((said) => names(said, visualLabel(v))))
    );
    if (inScope.length === 0) return 'ask';
  } else {
    return 'ask';
  }
  if (scope.visuals === 'all') {
    return inScope.map((sheet) => ({ sheet }));
  }
  if (namedVisuals) {
    const targets = inScope.flatMap((sheet) => {
      const visuals = sheet.visuals.filter((v) =>
        namedVisuals.some((said) => names(said, visualLabel(v)))
      );
      return visuals.length ? [{ sheet, visuals }] : [];
    });
    const matched = new Set(targets.flatMap((t) => t.visuals!.map(visualLabel)));
    const unmatched = namedVisuals.some(
      (said) => ![...matched].some((label) => names(said, label))
    );
    return targets.length && !unmatched ? targets : 'ask';
  }
  // Nothing said about visuals: a sheet with one visual leaves no choice.
  return inScope.every((s) => s.visuals.length <= 1) ? inScope.map((sheet) => ({ sheet })) : 'ask';
}

/** The question: every sheet, each sheet, or each visual, as cards; the names when there are too many. */
function scopeQuestion(
  sheets: FilterSheet[],
  scope: FilterScope,
  filters: Placed[]
): FilterQuestion {
  const namedSheets = Array.isArray(scope.sheets) ? scope.sheets : undefined;
  const inScope = namedSheets
    ? sheets.filter((s) => namedSheets.some((said) => names(said, s.name)))
    : sheets;
  const shown = inScope.length ? inScope : sheets;
  const visualCount = shown.reduce((n, s) => n + s.visuals.length, 0);
  const options: QuestionOption[] = [];
  if (shown.length > 1) {
    options.push({
      id: ALL,
      label: 'Every visual on every sheet',
      description: `${shown.length} sheets, ${visualCount} visuals`,
    });
  }
  for (const sheet of shown) {
    options.push({
      id: `${SHEET}${sheet.sheetId}`,
      label: `Every visual on ${sheet.name}`,
      description: `${sheet.visuals.length} visual${sheet.visuals.length === 1 ? '' : 's'}`,
    });
  }
  const room = MAX_SCOPE_OPTIONS - options.length;
  const visuals = shown.flatMap((sheet) =>
    sheet.visuals.map((v) => ({
      id: `${VISUAL}${sheet.sheetId}/${v.id}`,
      label: visualLabel(v),
      description: `${v.type ?? 'Visual'}${shown.length > 1 ? ` on ${sheet.name}` : ''}`,
    }))
  );
  const fits = visuals.length <= room;
  options.push(...(fits ? visuals : []));
  const columns = list(filters.map((p) => p.column.name));
  return {
    question: fits
      ? `Which visuals should the ${columns} filter narrow?`
      : `Which visuals should the ${columns} filter narrow? Pick sheets, or type the names of the visuals.`,
    options,
    multi: true,
    allowOther: !fits,
  };
}

function controlOf(filter: UnderstoodFilter): string | undefined {
  return CONTROLS[fold(filter.control).replace(/[^a-z]/g, '')];
}

function placementOf(filter: UnderstoodFilter): string | undefined {
  return PLACEMENTS[fold(filter.placement).replace(/[^a-z]/g, '')];
}

function describeFilter(p: Placed): string {
  const control = controlOf(p.filter);
  const placement = placementOf(p.filter);
  const how = [
    control ? `as a ${control}` : '',
    placement === 'canvas' ? 'on the canvas' : '',
  ].filter(Boolean);
  return `${p.column.name}${how.length ? ` (${how.join(', ')})` : ''}`;
}

/**
 * The filters as ops on the sheets and visuals chosen, or the question
 * that settles the choice, or why it cannot be done. `chosen` is the ids
 * from an earlier question's answer, which win over the words.
 */
export function resolveFilterChange(input: {
  filters: UnderstoodFilter[];
  scope: FilterScope;
  sheets: FilterSheet[];
  datasets: FilterDataset[];
  chosen?: string[];
}): FilterChange {
  const chosen = input.chosen ?? [];
  if (input.sheets.length === 0) {
    return { problem: 'It has no sheets to put a filter on.' };
  }
  const placement = placeFilters(input.filters, input.datasets, chosen);
  if (!('placed' in placement)) {
    return placement;
  }
  for (const p of placement.placed) {
    const control =
      controlOf(p.filter) ?? (NUMERIC.has(p.column.type ?? '') ? 'slider' : undefined);
    if (control === 'slider' && (p.filter.min === undefined || p.filter.max === undefined)) {
      return {
        problem: `A filter on ${p.column.name} is a range slider, which needs its bounds: say between what and what.`,
      };
    }
  }
  const targets = targetsChosen(input.sheets, chosen) ?? targetsSaid(input.sheets, input.scope);
  if (targets === 'ask' || targets.length === 0) {
    return { ask: scopeQuestion(input.sheets, input.scope, placement.placed) };
  }
  const ops: AddFilterOp[] = targets.flatMap((t) =>
    placement.placed.map((p) => ({
      op: 'addFilter' as const,
      sheetId: t.sheet.sheetId,
      identifier: p.dataset.identifier,
      column: p.column.name,
      ...(COLUMN_TYPES.has(p.column.type ?? '') ? { columnType: p.column.type } : {}),
      ...(controlOf(p.filter) ? { control: controlOf(p.filter) } : {}),
      ...(placementOf(p.filter) ? { placement: placementOf(p.filter) } : {}),
      ...(t.visuals ? { appliesTo: t.visuals.map((v) => v.id) } : {}),
      ...(p.filter.min !== undefined ? { min: p.filter.min } : {}),
      ...(p.filter.max !== undefined ? { max: p.filter.max } : {}),
    }))
  );
  const where = targets.map((t) =>
    t.visuals
      ? `${t.sheet.name} (${list(t.visuals.map(visualLabel))})`
      : `${t.sheet.name} (every visual)`
  );
  const what = list(placement.placed.map(describeFilter));
  return {
    ops,
    summary: `A filter on ${what} goes on ${list(where)}.`,
  };
}
