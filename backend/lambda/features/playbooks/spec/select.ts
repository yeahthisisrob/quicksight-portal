/**
 * What a spec selects: every asset of its type from the portal's list, the
 * cheap conditions applied to the list rows, then the lineage conditions
 * (engine, governance) by following the context graph for what is left.
 */
import { TIME_UNITS } from '../../../shared/constants';
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
  user: 'users',
};

const DAY_MS = TIME_UNITS.DAY;

/** A comma-separated list as lower-case names. */
const names = (value: unknown) =>
  new Set(
    String(value ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

interface ListRow {
  id: string;
  name: string;
  tags?: Array<{ key: string; value: string }>;
  activity?: { totalViews?: number; lastActive?: string | null };
  definitionErrors?: unknown[];
  permissions?: Array<{ principal: string }>;
  /** Data sources and datasets: the engine (a dataset reading several says COMPOSITE). */
  sourceType?: string;
  lastUpdatedTime?: string;
  /** Users: role, groups, how many assets they reach, and when last active. */
  role?: string;
  groups?: string[];
  assetAccessCount?: number;
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
      (row.sourceType ?? '').toUpperCase() ===
      String(resolve(condition.engine, params)).toUpperCase()
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
    case 'role':
      return names(resolve(condition.roles, params)).has(String(row.role ?? '').toLowerCase());
    case 'inactiveForDays': {
      const last = row.activity?.lastActive ? Date.parse(row.activity.lastActive) : Number.NaN;
      const days = Number(resolve(condition.days, params));
      return Number.isNaN(last) || Date.now() - last >= days * DAY_MS;
    }
    case 'noAccess': {
      // Not known is not "none": a row the list could not enrich is never picked.
      if (!Array.isArray(row.groups) || typeof row.assetAccessCount !== 'number') return false;
      const ignored = names(resolve(condition.ignoreGroups, params));
      if (row.groups.some((g) => !ignored.has(g.toLowerCase()))) return false;
      if (row.assetAccessCount === 0) return true;
      // Reaches something: only a closer look can tell whether all of it is ignored.
      return condition.ignoreGroups || condition.ignoreFolders ? null : false;
    }
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

/**
 * Whether everything a user reaches comes through a group or folder the
 * condition ignores. Direct permissions always count.
 */
async function reachesOnlyIgnored(
  ctx: PlaybookContext,
  userName: string,
  condition: Extract<SpecCondition, { kind: 'noAccess' }>,
  params: Record<string, unknown>
): Promise<boolean> {
  const groups = names(resolve(condition.ignoreGroups, params));
  const folders = names(resolve(condition.ignoreFolders, params));
  const access = await ctx.call<{
    assets: Array<{
      sources: Array<{
        type: string;
        groupName?: string;
        folderName?: string;
        folderPath?: string;
      }>;
    }>;
  }>('GET', `/api/users/${encodeURIComponent(userName)}/asset-access`);
  return (access.assets ?? []).every((asset) =>
    asset.sources.every(
      (source) =>
        (source.type === 'group' && groups.has(String(source.groupName).toLowerCase())) ||
        (source.type === 'folder' &&
          (folders.has(String(source.folderName).toLowerCase()) ||
            folders.has(String(source.folderPath).toLowerCase())))
    )
  );
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
    assetType === 'datasource' || assetType === 'user'
      ? []
      : where.filter((c) => c.kind === 'readsEngine' || c.kind === 'readsGoverned');
  const out: ScopedTarget[] = [];
  for (const row of kept) {
    let pass = true;
    for (const condition of where) {
      if (
        condition.kind === 'noAccess' &&
        cheap(assetType, row, condition, ctx.params) === null &&
        !(await reachesOnlyIgnored(ctx, row.id, condition, ctx.params))
      ) {
        pass = false;
        break;
      }
    }
    for (const condition of pass ? graphConditions : []) {
      if (!(await lineage(session, assetType, row.id, condition, ctx.params))) {
        pass = false;
        break;
      }
    }
    if (pass) {
      out.push({
        assetType,
        assetId: row.id,
        name: row.name,
        ...(row.tags ? { tags: row.tags } : {}),
        // A user's row time is the export's, not an edit: the edited gate does not apply.
        ...(row.lastUpdatedTime && assetType !== 'user'
          ? { lastUpdatedTime: row.lastUpdatedTime }
          : {}),
      });
    }
  }
  return out;
}
