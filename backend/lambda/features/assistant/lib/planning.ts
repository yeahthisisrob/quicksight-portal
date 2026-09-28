/**
 * The plan a change is drawn as, and the judgement on each calculated field
 * it adds. Pure: the columns a dataset has are read through a function the
 * caller supplies, so the rules can be tested without a portal.
 */
import { placementOf, sameFieldName } from '../../../../../shared/lib/expressionPlacement';
import type { FieldStrategy } from '../../../shared/ai/authoringGuidance';
import type { BuildPlan, FieldVerdict, PlanBuild } from '../types';

/** A column the dataset has, with what the catalog says about it. */
export interface KnownColumn {
  name: string;
  type?: string;
  /** From the SMUS listing column the dataset exposes, when there is one. */
  description?: string;
}

type ColumnReader = (dataSetId: string) => Promise<KnownColumn[]>;

const PLAN_STATUSES = new Set(['existing', 'new', 'edited']);

/**
 * What the chat model decides: where the data comes from, what the asset
 * is, and a brief of exactly what the person asked for. The build itself is
 * drafted from the brief by the authoring model (the planner), which is
 * where the stronger model earns its price.
 */
export type PlanTarget =
  | {
      /** A new asset's frame: type, name, datasets and filing - not its visuals or filters. */
      create: Record<string, any>;
    }
  | { edit: { assetType: 'dashboard' | 'analysis'; assetId: string } };

export interface ParsedPlan {
  lineage: Omit<BuildPlan, 'build'>;
  brief: string;
  target: PlanTarget;
  /** Every filter the person asked for, as data: what the build is held to. */
  filters: RequestedFilter[];
}

const MIN_BRIEF = 10;

/** A plan from the chat model's input, or why it is not one. */
export function parsePlan(input: Record<string, unknown>): ParsedPlan | string {
  const sources = Array.isArray(input.sources) ? (input.sources as any[]) : [];
  const datasets = Array.isArray(input.datasets) ? (input.datasets as any[]) : [];
  const fields = Array.isArray(input.calculatedFields) ? (input.calculatedFields as any[]) : [];
  const asset = input.asset as any;
  if (
    datasets.length === 0 ||
    !asset?.name ||
    (asset.kind !== 'dashboard' && asset.kind !== 'analysis')
  ) {
    return 'A plan needs at least one dataset and the analysis or dashboard it builds.';
  }
  const missingId = datasets.find((d) => d?.status === 'existing' && !d?.id);
  if (missingId) {
    return `Existing dataset "${missingId.name}" needs its id; find it with context_search.`;
  }
  const brief = typeof input.brief === 'string' ? input.brief.trim() : '';
  if (brief.length < MIN_BRIEF) {
    return 'A plan needs its brief: exactly what the person asked for - every visual, filter (with its control and placement) and interaction - for the authoring model to draft.';
  }
  const target = parseTarget(input.target);
  if (typeof target === 'string') {
    return target;
  }
  const lineage: Omit<BuildPlan, 'build'> = {
    sources: sources
      .filter((s) => typeof s?.listing === 'string')
      .map((s) => ({
        listing: s.listing,
        ...(typeof s.project === 'string' ? { project: s.project } : {}),
        ...(typeof s.table === 'string' ? { table: s.table } : {}),
      })),
    datasets: datasets.map((d) => ({
      name: String(d.name),
      status: d.status === 'existing' ? ('existing' as const) : ('new' as const),
      ...(typeof d.id === 'string' ? { id: d.id } : {}),
      ...(typeof d.dataSource === 'string' ? { dataSource: d.dataSource } : {}),
    })),
    ...(fields.length
      ? {
          calculatedFields: fields.map((f) => ({
            name: String(f.name),
            status: f.status === 'existing' ? ('existing' as const) : ('new' as const),
            ...(typeof f.expression === 'string' ? { expression: f.expression } : {}),
            ...(typeof f.dataset === 'string' ? { dataset: f.dataset } : {}),
          })),
        }
      : {}),
    asset: {
      kind: asset.kind,
      name: String(asset.name),
      status: PLAN_STATUSES.has(asset.status) ? asset.status : 'new',
      ...(typeof asset.id === 'string' ? { id: asset.id } : {}),
    },
  };
  return { lineage, brief, target, filters: requestedFiltersOf(input.filters) };
}

function describe(column: KnownColumn): string {
  const facts = [column.type, column.description ? `"${column.description}"` : ''].filter(Boolean);
  return facts.length ? `${column.name} (${facts.join(', ')})` : column.name;
}

/** A row-level field the dataset has no column for, placed by the organisation's strategy. */
function rowLevelVerdict(
  base: { name: string; expression: string; dataset?: string },
  strategy: FieldStrategy
): FieldVerdict {
  if (strategy === 'source') {
    return {
      ...base,
      verdict: 'push-down',
      note: 'Row-level: it works here for now, and per your guidance belongs upstream, materialised in the source (for example gold).',
    };
  }
  if (strategy === 'dataset') {
    return {
      ...base,
      verdict: 'dataset',
      note: 'Row-level: per your guidance it belongs in the QuickSight dataset, computed once there rather than in every analysis.',
    };
  }
  return {
    ...base,
    verdict: 'row-level',
    note: 'Row-level, so it could be materialised in the dataset or upstream; your guidance states no preference.',
  };
}

/**
 * Each new calculated field in a plan, placed: query-time fields stay in
 * the analysis; row-level ones use a column the dataset already has by
 * that name, and are otherwise placed by the organisation's strategy.
 */
export async function judgeFields(
  plan: Pick<BuildPlan, 'calculatedFields'>,
  strategy: FieldStrategy,
  readColumns: ColumnReader
): Promise<FieldVerdict[]> {
  const fields = (plan.calculatedFields ?? []).filter((f) => f.status === 'new' && f.expression);
  const columnsOf = new Map<string, KnownColumn[]>();
  const verdicts: FieldVerdict[] = [];
  for (const field of fields) {
    const expression = field.expression ?? '';
    const base = {
      name: field.name,
      expression,
      ...(field.dataset ? { dataset: field.dataset } : {}),
    };
    const placement = placementOf(expression);
    if (placement.placement === 'query-time') {
      verdicts.push({
        ...base,
        verdict: 'analysis',
        note: `Computed per visual (${placement.reasons.join(', ')}), so it belongs in the analysis.`,
      });
      continue;
    }
    let columns: KnownColumn[] = [];
    if (field.dataset) {
      if (!columnsOf.has(field.dataset)) {
        columnsOf.set(field.dataset, await readColumns(field.dataset).catch(() => []));
      }
      columns = columnsOf.get(field.dataset) ?? [];
    }
    const column = columns.find((c) => sameFieldName(c.name, field.name));
    verdicts.push(
      column
        ? {
            ...base,
            verdict: 'use-column',
            column: column.name,
            note: `Row-level, and the dataset already has ${describe(column)}: use it rather than recomputing.`,
          }
        : rowLevelVerdict(base, strategy)
    );
  }
  return verdicts;
}

/** What the model is told after a plan, so it acts on the verdicts. */
export function verdictsMessage(judged: FieldVerdict[]): string {
  if (judged.length === 0) {
    return 'Plan shown. Now prepare the actions that carry it out.';
  }
  return [
    'Plan shown. The calculated fields it adds, judged against the guidance:',
    ...judged.map((f) => `- ${f.name}: ${f.verdict}. ${f.note}`),
    judged.some((f) => f.verdict === 'use-column')
      ? 'Drop the use-column fields from what you prepare and read the existing column instead; show the plan again if that changes it.'
      : '',
    judged.some((f) => f.verdict === 'push-down')
      ? 'Suggest the push-down fields to the person as a follow-up: materialise them in the source.'
      : '',
    judged.some((f) => f.verdict === 'dataset')
      ? 'Suggest the dataset fields to the person as a follow-up: move them into the QuickSight dataset.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Where a plan's build goes: a new asset's frame, or an existing asset. */
function parseTarget(raw: unknown): PlanTarget | string {
  const t = (raw ?? {}) as Record<string, any>;
  const create = t.create;
  if (
    create &&
    typeof create === 'object' &&
    (create.assetType === 'dashboard' || create.assetType === 'analysis') &&
    typeof create.name === 'string' &&
    Array.isArray(create.datasets) &&
    create.datasets.length > 0
  ) {
    // The frame only: what to show is the authoring model's to draft.
    const { visuals: _v, filters: _f, ask: _a, model: _m, ...frame } = create;
    return { create: frame };
  }
  const edit = t.edit;
  if (
    edit &&
    typeof edit === 'object' &&
    (edit.assetType === 'dashboard' || edit.assetType === 'analysis') &&
    typeof edit.assetId === 'string' &&
    edit.assetId
  ) {
    return { edit: { assetType: edit.assetType, assetId: edit.assetId } };
  }
  return 'A plan needs its target: `create` ({ assetType, name, datasets: [{ identifier, dataSetId }] }) for a new asset, or `edit` ({ assetType, assetId }) for an existing one.';
}

/** The request a build is: what the person's Run sends. */
export function writeOf(build: PlanBuild): {
  method: 'POST';
  path: string;
  body: Record<string, unknown>;
  title: string;
} {
  if ('create' in build) {
    const c = build.create;
    return {
      method: 'POST',
      path: '/api/authoring/new',
      body: c,
      title: `Create ${c.assetType === 'dashboard' ? 'dashboard' : 'analysis'} "${c.name}"`,
    };
  }
  const e = build.edit;
  const ops: unknown[] = Array.isArray(e.request.ops) ? e.request.ops : [];
  const clone = e.request.mode === 'clone';
  return {
    method: 'POST',
    path: `/api/authoring/${e.assetType}/${encodeURIComponent(e.assetId)}/rebind`,
    body: e.request,
    title: clone
      ? `Copy the ${e.assetType}${e.request.name ? ` as "${e.request.name}"` : ''}`
      : `Edit the ${e.assetType}${ops.length ? ` (${ops.length} change${ops.length === 1 ? '' : 's'})` : ''}`,
  };
}

/** The filters a build asks for: its claims, checked against what the preview built. */
function filtersOf(
  build: PlanBuild
): Array<{ column: string; title?: string; control?: string; placement?: string }> {
  const raw: any[] =
    'create' in build
      ? Array.isArray(build.create.filters)
        ? build.create.filters
        : []
      : Array.isArray(build.edit.request.ops)
        ? build.edit.request.ops.filter((o: any) => o?.op === 'addFilter')
        : [];
  return raw
    .filter((f) => typeof f?.column === 'string')
    .map((f) => ({
      column: f.column,
      ...(typeof f.title === 'string' ? { title: f.title } : {}),
      ...(typeof f.control === 'string' ? { control: f.control } : {}),
      placement: typeof f.placement === 'string' ? f.placement : 'controlBar',
    }));
}

/** A filter as a definition holds it: the column, and the control people use it by. */
export interface BuiltFilter {
  column: string;
  title?: string;
  /** The control, in the portal's vocabulary (dropdown, dateRange, slider...). */
  control?: 'dropdown' | 'singleSelect' | 'list' | 'dateRange' | 'relativeDate' | 'slider';
  placement: 'controlBar' | 'canvas';
}

/** A QuickSight filter control, named the way a build asks for it. */
function controlKind(kind: string, body: any): BuiltFilter['control'] {
  switch (kind) {
    case 'Dropdown':
      return body?.Type === 'SINGLE_SELECT' ? 'singleSelect' : 'dropdown';
    case 'List':
      return 'list';
    case 'DateTimePicker':
      return 'dateRange';
    case 'RelativeDateTime':
      return 'relativeDate';
    case 'Slider':
      return 'slider';
    default:
      return undefined;
  }
}

/**
 * The filters a definition really has controls for, read from the
 * definition itself: each control's source filter, that filter's column,
 * and whether the control sits in the control bar or on the canvas. What a
 * plan shows is taken from here, never from the request that asked for it.
 */
export function builtFilters(definition: unknown): BuiltFilter[] {
  const def = (definition ?? {}) as any;
  const columnByFilterId = new Map<string, string>();
  for (const group of Array.isArray(def.FilterGroups) ? def.FilterGroups : []) {
    for (const filter of Array.isArray(group?.Filters) ? group.Filters : []) {
      const body = Object.values(filter ?? {})[0] as any;
      if (body?.FilterId && body?.Column?.ColumnName) {
        columnByFilterId.set(body.FilterId, body.Column.ColumnName);
      }
    }
  }
  const out: BuiltFilter[] = [];
  for (const sheet of Array.isArray(def.Sheets) ? def.Sheets : []) {
    const inBar = new Set<string>(
      (Array.isArray(sheet?.SheetControlLayouts) ? sheet.SheetControlLayouts : []).flatMap(
        (l: any) => (l?.Configuration?.GridLayout?.Elements ?? []).map((e: any) => e?.ElementId)
      )
    );
    for (const control of Array.isArray(sheet?.FilterControls) ? sheet.FilterControls : []) {
      const [kind, body] = (Object.entries(control ?? {})[0] ?? []) as [string, any];
      const column = body?.SourceFilterId ? columnByFilterId.get(body.SourceFilterId) : undefined;
      if (!column) continue;
      const named = controlKind(kind, body);
      out.push({
        column,
        ...(typeof body.Title === 'string' ? { title: body.Title } : {}),
        ...(named ? { control: named } : {}),
        placement: inBar.has(body.FilterControlId) ? 'controlBar' : 'canvas',
      });
    }
  }
  return out;
}

/**
 * What a plan's build asks for that its preview did not build: each filter
 * it adds must have a control on its column in the previewed definition. A
 * plan is only shown once this is empty, so it never claims what the
 * change will not do.
 */
export function unbuiltClaims(build: PlanBuild, definition: unknown): string[] {
  const built = builtFilters(definition);
  return filtersOf(build)
    .filter((f) => !built.some((b) => b.column.toLowerCase() === f.column.toLowerCase()))
    .map(
      (f) =>
        `The build asks for a filter on ${f.column} with a ${f.control || 'default'} control, but the previewed definition has no control on ${f.column}.`
    );
}

type NameLookup = (entityId: string) => Promise<{ name: string; project?: string } | null>;

/** `listing:abc` or `abc` as the graph's id for it. */
function entityIdOf(type: string, value: string): string {
  return value.startsWith(`${type}:`) ? value : `${type}:${value}`;
}

/**
 * The lineage as the portal knows it, not as the chat model wrote it: each
 * listing by its SMUS name and project, each existing dataset by its name,
 * from the cached graph. What the graph does not know is left as given.
 */
export async function resolveLineage<T extends Pick<BuildPlan, 'sources' | 'datasets'>>(
  lineage: T,
  lookup: NameLookup
): Promise<T> {
  const sources = await Promise.all(
    lineage.sources.map(async (s) => {
      const known = await lookup(entityIdOf('listing', s.listing)).catch(() => null);
      return known
        ? { ...s, listing: known.name, ...(known.project ? { project: known.project } : {}) }
        : s;
    })
  );
  const datasets = await Promise.all(
    lineage.datasets.map(async (d) => {
      if (d.status !== 'existing' || !d.id) return d;
      const known = await lookup(entityIdOf('dataset', d.id)).catch(() => null);
      return known ? { ...d, name: known.name } : d;
    })
  );
  return { ...lineage, sources, datasets };
}

type ControlKind = NonNullable<BuiltFilter['control']>;
const CONTROL_KINDS: readonly ControlKind[] = [
  'dropdown',
  'singleSelect',
  'list',
  'dateRange',
  'relativeDate',
  'slider',
];

/**
 * A filter the person asked for, as data: the requirement a plan is held
 * to. The chat model names each one in show_plan; the build must have a
 * control on its column (with this control, when one is named) or the
 * plan is not shown.
 */
export interface RequestedFilter {
  column: string;
  /** The dataset's identifier or id, when the plan reads more than one. */
  dataset?: string;
  control?: ControlKind;
  placement?: 'controlBar' | 'canvas';
  values?: string[];
}

/** The filters the chat model asked for, as requirements; malformed entries are dropped. */
function requestedFiltersOf(input: unknown): RequestedFilter[] {
  return (Array.isArray(input) ? input : [])
    .filter((f: any) => typeof f?.column === 'string' && f.column.trim())
    .map((f: any) => ({
      column: f.column.trim(),
      ...(typeof f.dataset === 'string' && f.dataset.trim() ? { dataset: f.dataset.trim() } : {}),
      ...(CONTROL_KINDS.includes(f.control) ? { control: f.control as ControlKind } : {}),
      ...(f.placement === 'controlBar' || f.placement === 'canvas'
        ? { placement: f.placement as RequestedFilter['placement'] }
        : {}),
      ...(Array.isArray(f.values) && f.values.length
        ? { values: f.values.filter((v: unknown): v is string => typeof v === 'string') }
        : {}),
    }));
}

/**
 * The requested filters a previewed definition does not have: no control
 * on the column, or not the control that was asked for.
 */
export function missingRequested(
  requested: RequestedFilter[],
  definition: unknown
): RequestedFilter[] {
  const built = builtFilters(definition);
  return requested.filter(
    (r) =>
      !built.some(
        (b) =>
          b.column.toLowerCase() === r.column.toLowerCase() &&
          (!r.control || b.control === r.control)
      )
  );
}

/** What a build can place a filter on: the datasets it declares, with their columns, and its first sheet. */
export interface FilterTargets {
  datasets: Array<{ identifier: string; dataSetId: string; columns: string[] }>;
  sheetId?: string;
}

/** The dataset identifiers a definition declares, by dataset id, and its first sheet. */
export function declaredDatasets(definition: unknown): {
  datasets: Array<{ identifier: string; dataSetId: string }>;
  sheetId?: string;
} {
  const def = (definition ?? {}) as any;
  const datasets = (
    Array.isArray(def.DataSetIdentifierDeclarations) ? def.DataSetIdentifierDeclarations : []
  )
    .filter((d: any) => typeof d?.Identifier === 'string' && typeof d?.DataSetArn === 'string')
    .map((d: any) => ({
      identifier: d.Identifier as string,
      dataSetId: String(d.DataSetArn).split('/').pop() as string,
    }));
  const sheetId = def.Sheets?.[0]?.SheetId;
  return { datasets, ...(typeof sheetId === 'string' ? { sheetId } : {}) };
}

/**
 * The build with every missing requested filter put in by code, not left
 * to a model: on the dataset that has the column (the one named, or the
 * only one that has it), with the control and placement asked for. A
 * filter the build already adds on that column has its control corrected
 * instead. What cannot be placed is a problem, named.
 */
export function withRequestedFilters(
  build: PlanBuild,
  missing: RequestedFilter[],
  targets: FilterTargets
): { build: PlanBuild; problems: string[] } {
  const problems: string[] = [];
  const placed: Array<{ identifier: string; column: string; filter: RequestedFilter }> = [];
  for (const filter of missing) {
    const wanted = filter.column.toLowerCase();
    const named = filter.dataset?.toLowerCase();
    const candidates = targets.datasets
      .filter(
        (d) => !named || d.identifier.toLowerCase() === named || d.dataSetId.toLowerCase() === named
      )
      .map((d) => ({ d, column: d.columns.find((c) => c.toLowerCase() === wanted) }))
      .filter((c): c is { d: FilterTargets['datasets'][number]; column: string } =>
        Boolean(c.column)
      );
    if (candidates.length === 0) {
      problems.push(
        `The person asked for a filter on ${filter.column}, but no dataset this reads${filter.dataset ? ` (${filter.dataset})` : ''} has that column.`
      );
      continue;
    }
    if (candidates.length > 1) {
      problems.push(
        `The person asked for a filter on ${filter.column}, which ${candidates.map((c) => c.d.identifier).join(' and ')} both have: name its dataset.`
      );
      continue;
    }
    placed.push({ identifier: candidates[0]!.d.identifier, column: candidates[0]!.column, filter });
  }
  if (problems.length > 0) {
    return { build, problems };
  }
  const spec = (p: (typeof placed)[number]) => ({
    identifier: p.identifier,
    column: p.column,
    ...(p.filter.control ? { control: p.filter.control } : {}),
    ...(p.filter.placement ? { placement: p.filter.placement } : {}),
    ...(p.filter.values ? { values: p.filter.values } : {}),
  });
  const sameColumn = (f: any, p: (typeof placed)[number]) =>
    typeof f?.column === 'string' && f.column.toLowerCase() === p.column.toLowerCase();

  if ('create' in build) {
    const filters: any[] = [...((build.create.filters as any[] | undefined) ?? [])];
    for (const p of placed) {
      const at = filters.findIndex((f) => sameColumn(f, p));
      if (at >= 0) filters[at] = { ...filters[at], ...spec(p) };
      else filters.push(spec(p));
    }
    return { build: { create: { ...build.create, filters } }, problems };
  }
  if (!targets.sheetId) {
    return { build, problems: ['The previewed definition has no sheet to add the filters to.'] };
  }
  const ops: any[] = [...((build.edit.request.ops as any[] | undefined) ?? [])];
  for (const p of placed) {
    const at = ops.findIndex((o) => o?.op === 'addFilter' && sameColumn(o, p));
    if (at >= 0) ops[at] = { ...ops[at], ...spec(p) };
    else ops.push({ op: 'addFilter', sheetId: targets.sheetId, ...spec(p) });
  }
  return {
    build: { edit: { ...build.edit, request: { ...build.edit.request, ops } } },
    problems,
  };
}
