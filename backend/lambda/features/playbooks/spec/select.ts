/**
 * What a spec selects: every asset of its type from the portal's list, the
 * cheap conditions applied to the list rows, then the lineage conditions
 * (engine, governance) by following the context graph for what is left.
 */
import type { PlaybookContext, ScopedTarget } from '../types';
import { resolve, resolveBoolean } from './inputs';
import type { SpecSession } from './session';
import type { SelectableType, SpecCondition } from './types';

const PAGE_SIZE = 100;
const PLURAL: Record<SelectableType, string> = {
  dashboard: 'dashboards',
  analysis: 'analyses',
  dataset: 'datasets',
  datasource: 'datasources',
};

interface ListRow {
  id: string;
  name: string;
  tags?: Array<{ key: string; value: string }>;
  activity?: { totalViews?: number };
  definitionErrors?: unknown[];
  permissions?: Array<{ principal: string }>;
  /** Data sources: the engine. */
  type?: string;
}

async function listAll(ctx: PlaybookContext, type: SelectableType): Promise<ListRow[]> {
  const rows: ListRow[] = [];
  for (let page = 1; ; page++) {
    const data = await ctx.call<Record<string, any>>(
      'GET',
      `/api/assets/${PLURAL[type]}/paginated?page=${page}&pageSize=${PAGE_SIZE}`
    );
    const items = (data[PLURAL[type]] ?? []) as ListRow[];
    rows.push(...items);
    const pages = data.pagination?.totalPages ?? 1;
    if (page >= pages || items.length === 0) return rows;
  }
}

function cheap(
  assetType: SelectableType,
  row: ListRow,
  condition: SpecCondition,
  params: Record<string, unknown>
): boolean | null {
  // A data source's engine is its own; it reads no dataset to be governed.
  if (assetType === 'datasource' && condition.kind === 'readsEngine') {
    return (
      (row.type ?? '').toUpperCase() === String(resolve(condition.engine, params)).toUpperCase()
    );
  }
  if (assetType === 'datasource' && condition.kind === 'readsGoverned') return true;
  switch (condition.kind) {
    case 'views':
      return (row.activity?.totalViews ?? 0) >= Number(resolve(condition.min, params));
    case 'viewsAtMost':
      return (row.activity?.totalViews ?? 0) <= Number(resolve(condition.max, params));
    case 'tagged': {
      const [key, value] = String(resolve(condition.tag, params))
        .split('=')
        .map((s) => s.trim());
      return (row.tags ?? []).some((t) => t.key === key && (!value || t.value === value));
    }
    case 'nameContains':
      return row.name.toLowerCase().includes(String(resolve(condition.text, params)).toLowerCase());
    case 'hasErrors':
      return (row.definitionErrors?.length ?? 0) > 0;
    case 'sharedWith': {
      // A principal is an ARN (…:group/default/sales-team); match on its name.
      const wanted = String(resolve(condition.principal, params)).toLowerCase();
      return (row.permissions ?? []).some((p) =>
        (p.principal.split('/').pop() ?? p.principal).toLowerCase().includes(wanted)
      );
    }
    default:
      return null;
  }
}

/** The lineage conditions, read from the graph through the session. */
async function lineage(
  session: SpecSession,
  type: SelectableType,
  id: string,
  condition: SpecCondition,
  params: Record<string, unknown>
): Promise<boolean> {
  if (condition.kind === 'readsEngine') {
    const engine = String(resolve(condition.engine, params)).toUpperCase();
    return (await session.reads(type, id)).datasources.some((d) => d.engine === engine);
  }
  if (condition.kind === 'readsGoverned') {
    const want = resolveBoolean(condition.value, params);
    const { datasets } = await session.reads(type, id);
    const governed = await Promise.all(datasets.map((d) => session.governed(d.id)));
    return want ? governed.some(Boolean) : governed.some((g) => !g);
  }
  return true;
}

export async function selectTargets(
  ctx: PlaybookContext,
  session: SpecSession,
  assetTypes: SelectableType[],
  where: SpecCondition[]
): Promise<ScopedTarget[]> {
  const out: ScopedTarget[] = [];
  for (const assetType of assetTypes) {
    out.push(...(await selectOfType(ctx, session, assetType, where)));
  }
  return out;
}

async function selectOfType(
  ctx: PlaybookContext,
  session: SpecSession,
  assetType: SelectableType,
  where: SpecCondition[]
): Promise<ScopedTarget[]> {
  const rows = await listAll(ctx, assetType);
  const kept = rows.filter((row) =>
    where.every((c) => cheap(assetType, row, c, ctx.params) !== false)
  );
  const graphConditions =
    assetType === 'datasource'
      ? []
      : where.filter((c) => c.kind === 'readsEngine' || c.kind === 'readsGoverned');
  const out: ScopedTarget[] = [];
  for (const row of kept) {
    let pass = true;
    for (const condition of graphConditions) {
      if (!(await lineage(session, assetType, row.id, condition, ctx.params))) {
        pass = false;
        break;
      }
    }
    if (pass) out.push({ assetType, assetId: row.id, name: row.name });
  }
  return out;
}
