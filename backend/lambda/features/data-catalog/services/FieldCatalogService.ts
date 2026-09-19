/**
 * FieldCatalogService - the catalog seen field-first. Calculated fields are
 * what the portal knows and SMUS does not: every expression in the account,
 * grouped by what it computes, with where it is defined, what it reads,
 * what reads it, its conflicts and its template. Plain columns come second,
 * tied back to their SMUS listing column. Built on the same field index the
 * per-listing view uses.
 */
import { createHash } from 'node:crypto';

import type { SmusAsset, SmusMatchType } from '../../../features/smus/types';
import type { FieldInfo } from '../../../shared/services/cache/types';
import type { SmusService } from '../../../shared/services/smus/SmusService';
import { type ColumnMatchKind, matchListingColumn } from '../lib/columnIdentity';
import { canonicalExpression, extractFieldReferences } from '../lib/expressionAnalysis';
import {
  dedupeUsers,
  type FieldIndex,
  type FieldUsedIn,
  type FieldVisualUsage,
  type SmusCatalogService,
} from './SmusCatalogService';

const KEY_LENGTH = 12;

/** How far the dependency chain is walked in each direction. */
const MAX_LINEAGE_DEPTH = 6;
/** And how big it is allowed to get, so one hub field cannot blow up a page. */
const MAX_LINEAGE_NODES = 80;

export interface CalculatedFieldRef {
  type: 'dashboard' | 'analysis' | 'dataset';
  id: string;
  name: string;
}

export interface CatalogListingRef {
  listingId: string;
  name: string;
  projectId?: string;
  projectName?: string;
  url?: string;
  /** How the dataset was tied to this listing. */
  matchType?: SmusMatchType;
  /** For a `lineage` tie, the parent dataset it came through. */
  via?: { datasetId: string; name?: string };
}

export interface CatalogDatasetRef {
  id: string;
  name: string;
  listing?: CatalogListingRef;
}

export interface SmusColumnRef extends CatalogListingRef {
  /**
   * The listing column this QuickSight column resolves to. Absent when the
   * dataset is tied to a listing but the listing's schema does not name the
   * column: still a SMUS table, just nothing to say about the column itself.
   */
  columnName?: string;
  /** The type the listing gives it, which is rarely spelled as QuickSight spells it. */
  columnType?: string;
  /** Exact name, normalized, the listing alone, or a listing with no schema at all. */
  match: ColumnMatchKind;
  /** How many columns the listing names, so an empty schema is legible as one. */
  listingColumnCount: number;
  description?: string;
  glossaryTerms: string[];
}

export interface CalculatedFieldSummary {
  /** Stable id for one distinct (name, expression). */
  key: string;
  name: string;
  expression: string;
  dataType?: string;
  /** Every asset that defines this exact expression. */
  definedIn: CalculatedFieldRef[];
  /** The datasets it is declared on, or bound to when defined in a dashboard or analysis. */
  datasets: CatalogDatasetRef[];
  /** Field names the expression reads. */
  references: string[];
  usedBy: { dashboards: number; analyses: number; visuals: number };
  /** Other expressions carrying the same name. */
  conflict?: { variants: number };
  template?: { id: string };
  hasNote: boolean;
}

export interface CalculatedFieldCatalog {
  configured: boolean;
  exportedAt: string | null;
  projectFilter: string[];
  counts: {
    fields: number;
    names: number;
    conflicts: number;
    templated: number;
    unused: number;
    datasets: number;
    /** Fields on datasets that matched no listing, counted before the scope filter. */
    outsideSmus: number;
  };
  items: CalculatedFieldSummary[];
}

export interface LineageRead {
  name: string;
  kind: 'column' | 'calculated';
  /** For a calculated field: its catalog key. */
  key?: string;
  dataType?: string;
  datasetId?: string;
  datasetName?: string;
  smus?: SmusColumnRef;
}

/**
 * One field in the dependency chain. `depth` is signed: negative upstream
 * (what the focused field is computed from), 0 for the field itself, positive
 * downstream (what is computed from it). A field reachable at several depths
 * keeps the nearest.
 */
export interface FieldLineageNode {
  id: string;
  name: string;
  kind: 'column' | 'calculated';
  depth: number;
  /** Calculated fields only: their catalog key, so a node opens. */
  key?: string;
  expression?: string;
  dataType?: string;
  datasetId?: string;
  datasetName?: string;
  smus?: SmusColumnRef;
  usedBy?: { dashboards: number; analyses: number; visuals: number };
}

/** Data flows from `from` to `to`: `to` reads `from`. */
export interface FieldLineageEdge {
  from: string;
  to: string;
}

export interface FieldLineage {
  nodes: FieldLineageNode[];
  edges: FieldLineageEdge[];
  /** True when the walk hit its depth or size bound, so the chain is partial. */
  truncated: boolean;
}

export interface CalculatedFieldDetail extends CalculatedFieldSummary {
  /** Every distinct expression under this name, this one included. */
  variants: Array<{ key: string; expression: string; definedIn: CalculatedFieldRef[] }>;
  reads: LineageRead[];
  readBy: Array<{ key: string; name: string; expression: string; definedIn: CalculatedFieldRef[] }>;
  usedIn: FieldUsedIn[];
  visuals: FieldVisualUsage[];
  /** The whole dependency chain, both directions, not just the neighbours. */
  lineage: FieldLineage;
  portal?: { description?: string; tags?: string[]; category?: string; sensitivity?: string };
}

export interface ColumnCatalogItem {
  name: string;
  /** Absent when the export did not say: QuickSight leaves OutputColumns.Type out for some columns. */
  dataType?: string;
  datasets: CatalogDatasetRef[];
  smus?: SmusColumnRef;
  usedBy: { dashboards: number; analyses: number; visuals: number };
  /** Calculated fields whose expressions read this column. */
  usedByCalculated: Array<{ key: string; name: string }>;
}

export interface ColumnCatalog {
  configured: boolean;
  exportedAt: string | null;
  counts: {
    columns: number;
    datasets: number;
    /** Columns whose dataset is tied to a SMUS listing. */
    withSmus: number;
    /** Of those, the ones the listing's own schema names. */
    withSmusColumn: number;
    /** Columns on datasets that matched no listing, counted before the scope filter. */
    outsideSmus: number;
  };
  items: ColumnCatalogItem[];
}

/**
 * Which datasets the field-first tabs look at. The catalog is a view of what
 * the SMUS domain publishes, so it reads the selected projects by default;
 * `outside` is the way to see the rest of the account without it being silently
 * dropped, and `all` ignores the distinction.
 */
export type CatalogScope = 'smus' | 'outside' | 'all';

export interface FieldCatalogFilters {
  projectId?: string;
  datasetId?: string;
  search?: string;
  conflictsOnly?: boolean;
  scope?: CatalogScope;
}

/**
 * Where a field sits relative to SMUS. A field on no dataset at all — one
 * defined inside a dashboard against a field the dataset index has not seen —
 * is `unplaced`: it cannot be said to fall outside the domain, and hiding it
 * under every scope would make it unreachable.
 */
type Placement = 'in' | 'outside' | 'unplaced';

function placementOf(datasets: Array<{ listing?: CatalogListingRef }>): Placement {
  if (datasets.length === 0) {
    return 'unplaced';
  }
  return datasets.some((d) => d.listing) ? 'in' : 'outside';
}

/** A project is itself a SMUS scope, so naming one implies it. */
function scopeOf(filters: FieldCatalogFilters): CatalogScope {
  if (filters.projectId) {
    return 'smus';
  }
  return filters.scope ?? 'smus';
}

function matchesScope(
  datasets: Array<{ listing?: CatalogListingRef }>,
  filters: FieldCatalogFilters
): boolean {
  const scope = scopeOf(filters);
  if (scope === 'all') {
    return true;
  }
  const placement = placementOf(datasets);
  return scope === 'outside' ? placement === 'outside' : placement !== 'outside';
}

interface Group {
  key: string;
  name: string;
  canonical: string;
  expression: string;
  dataType?: string;
  definedIn: Map<string, CalculatedFieldRef>;
  datasetIds: Set<string>;
  /** The FieldInfo entries behind it, for usage lookups. */
  entries: FieldInfo[];
}

export function calculatedFieldKey(name: string, expression: string): string {
  return `cf_${createHash('sha1')
    .update(`${name.toLowerCase()}::${canonicalExpression(expression)}`)
    .digest('base64url')
    .slice(0, KEY_LENGTH)}`;
}

function refOf(field: FieldInfo): CalculatedFieldRef {
  return {
    type: field.sourceAssetType as CalculatedFieldRef['type'],
    id: field.sourceAssetId,
    name: field.sourceAssetName,
  };
}

function isCalculatedIn(field: FieldInfo): boolean {
  return (
    field.isCalculated &&
    typeof field.fieldName === 'string' &&
    field.fieldName.length > 0 &&
    typeof field.expression === 'string' &&
    field.expression.length > 0 &&
    (field.sourceAssetType === 'dataset' ||
      field.sourceAssetType === 'dashboard' ||
      field.sourceAssetType === 'analysis')
  );
}

export class FieldCatalogService {
  public constructor(
    private readonly smusService: SmusService,
    private readonly catalog: SmusCatalogService
  ) {}

  public async calculatedFields(
    filters: FieldCatalogFilters = {}
  ): Promise<CalculatedFieldCatalog> {
    const { assets, configured, exportedAt, projectFilter, index } = await this.load();
    const listingOf = listingByDataset(assets);
    const datasetNames = datasetNamesFrom(index, assets);
    const groups = groupCalculated(index);
    const variantsByName = countVariants(groups);

    const all = [...groups.values()].map((g) =>
      this.summarize(g, index, listingOf, datasetNames, variantsByName)
    );
    const items = all
      .filter((item) => matches(item, filters))
      .sort((a, b) => a.name.localeCompare(b.name) || b.definedIn.length - a.definedIn.length);

    const names = new Set(items.map((i) => i.name.toLowerCase()));
    const datasets = new Set(items.flatMap((i) => i.datasets.map((d) => d.id)));
    return {
      configured,
      exportedAt,
      projectFilter,
      counts: {
        fields: items.length,
        names: names.size,
        conflicts: [...names].filter((n) => (variantsByName.get(n) ?? 0) > 1).length,
        templated: items.filter((i) => i.template).length,
        unused: items.filter((i) => isUnused(i)).length,
        datasets: datasets.size,
        // Counted over every field, not the filtered ones, so a catalog scoped
        // to SMUS can still say how much sits outside it.
        outsideSmus: all.filter((i) => placementOf(i.datasets) === 'outside').length,
      },
      items,
    };
  }

  public async calculatedField(key: string): Promise<CalculatedFieldDetail | null> {
    const { assets, index } = await this.load();
    const listingOf = listingByDataset(assets);
    const datasetNames = datasetNamesFrom(index, assets);
    const groups = groupCalculated(index);
    const variantsByName = countVariants(groups);
    const group = groups.get(key);
    if (!group) {
      return null;
    }
    const summary = this.summarize(group, index, listingOf, datasetNames, variantsByName);
    const sameName = [...groups.values()].filter(
      (g) => g.name.toLowerCase() === group.name.toLowerCase()
    );

    // What it reads: columns and calculated fields on the datasets it lives on.
    const reads: LineageRead[] = [];
    for (const name of summary.references) {
      const read = this.resolveRead(name, group, index, groups, listingOf, datasetNames, assets);
      reads.push(read);
    }
    // What reads it: other calculated fields whose expressions name it.
    const readBy = readersOf(group, groups).map((g) => ({
      key: g.key,
      name: g.name,
      expression: g.expression,
      definedIn: [...g.definedIn.values()],
    }));

    const users = this.usersOf(group, index);
    const usedIn = dedupeUsers(users);
    const visuals = this.visualsOf(group, index);
    const note = [...group.entries]
      .map((e) => index.notes.get(`${e.sourceAssetId}::${e.fieldName}`))
      .find(Boolean);

    return {
      ...summary,
      variants: sameName.map((g) => ({
        key: g.key,
        expression: g.expression,
        definedIn: [...g.definedIn.values()],
      })),
      reads,
      readBy,
      usedIn,
      visuals,
      lineage: this.lineageOf(group, index, groups, listingOf, datasetNames, assets),
      ...(note
        ? {
            portal: {
              description: note.description,
              tags: note.tags,
              category: note.category,
              sensitivity: note.sensitivity,
            },
          }
        : {}),
    };
  }

  public async columns(filters: FieldCatalogFilters = {}): Promise<ColumnCatalog> {
    const { assets, configured, exportedAt, index } = await this.load();
    const listingOf = listingByDataset(assets);
    const datasetNames = datasetNamesFrom(index, assets);
    const groups = groupCalculated(index);
    const needle = filters.search?.trim().toLowerCase() ?? '';

    const byName = new Map<string, ColumnCatalogItem>();
    for (const [datasetId, own] of index.byDataset) {
      const listing = listingOf.get(datasetId);
      if (filters.datasetId && datasetId !== filters.datasetId) continue;
      if (filters.projectId && listing?.projectId !== filters.projectId) continue;
      for (const field of own) {
        // The field cache mirrors the export: a column can arrive without a
        // name (skipped) or without a type (QuickSight leaves OutputColumns.Type
        // out for some columns), and the tab must not fall over on either.
        if (field.isCalculated || !field.fieldName) continue;
        const key = field.fieldName.toLowerCase();
        const item = byName.get(key) ?? {
          name: field.fieldName,
          dataType: field.dataType || undefined,
          datasets: [],
          usedBy: { dashboards: 0, analyses: 0, visuals: 0 },
          usedByCalculated: [],
        };
        item.datasets.push({
          id: datasetId,
          name: datasetNames.get(datasetId) ?? datasetId,
          listing,
        });
        const users = dedupeUsers(index.usersOf.get(`${datasetId}::${field.fieldName}`) ?? []);
        item.usedBy.dashboards += users.filter((u) => u.assetType === 'dashboard').length;
        item.usedBy.analyses += users.filter((u) => u.assetType === 'analysis').length;
        item.usedBy.visuals += (
          index.visualsOf.get(`${datasetId}::${field.fieldName}`) ?? []
        ).length;
        item.smus = betterTie(
          item.smus,
          smusColumn(field.columnName ?? field.fieldName, listing, assets)
        );
        byName.set(key, item);
      }
    }
    for (const item of byName.values()) {
      const datasetIds = new Set(item.datasets.map((d) => d.id));
      item.usedByCalculated = [...groups.values()]
        .filter(
          (g) =>
            [...g.datasetIds].some((id) => datasetIds.has(id)) &&
            extractFieldReferences(g.expression).some(
              (r) => r.toLowerCase() === item.name.toLowerCase()
            )
        )
        .map((g) => ({ key: g.key, name: g.name }));
    }
    const all = [...byName.values()];
    const items = all
      .filter((i) => matchesScope(i.smus ? [{ listing: i.smus }] : [{}], filters))
      .filter((i) => !needle || i.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
    return {
      configured,
      exportedAt,
      counts: {
        columns: items.length,
        datasets: new Set(items.flatMap((i) => i.datasets.map((d) => d.id))).size,
        withSmus: items.filter((i) => i.smus).length,
        withSmusColumn: items.filter((i) => i.smus?.columnName).length,
        outsideSmus: all.filter((i) => !i.smus).length,
      },
      items,
    };
  }

  // ---------------------------------------------------------------------------

  private async load() {
    const [result, index] = await Promise.all([
      this.smusService.listAssets(),
      this.catalog.getFieldIndex(),
    ]);
    return {
      assets: result.assets,
      configured: result.configured,
      exportedAt: result.exportedAt,
      projectFilter: result.projectFilter,
      index,
    };
  }

  private summarize(
    group: Group,
    index: FieldIndex,
    listingOf: Map<string, CatalogListingRef>,
    datasetNames: Map<string, string>,
    variantsByName: Map<string, number>
  ): CalculatedFieldSummary {
    const users = dedupeUsers(this.usersOf(group, index));
    const variants = variantsByName.get(group.name.toLowerCase()) ?? 1;
    const templateId = index.templates.get(group.canonical);
    const hasNote = group.entries.some((e) =>
      index.notes.has(`${e.sourceAssetId}::${e.fieldName}`)
    );
    return {
      key: group.key,
      name: group.name,
      expression: group.expression,
      dataType: group.dataType,
      definedIn: [...group.definedIn.values()],
      datasets: [...group.datasetIds].map((id) => ({
        id,
        name: datasetNames.get(id) ?? id,
        listing: listingOf.get(id),
      })),
      references: extractFieldReferences(group.expression),
      usedBy: {
        dashboards: users.filter((u) => u.assetType === 'dashboard').length,
        analyses: users.filter((u) => u.assetType === 'analysis').length,
        visuals: this.visualsOf(group, index).length,
      },
      ...(variants > 1 ? { conflict: { variants: variants - 1 } } : {}),
      ...(templateId ? { template: { id: templateId } } : {}),
      hasNote,
    };
  }

  /**
   * Who uses a calculated field: dashboards and analyses that reference a
   * dataset-level one, plus the dashboards and analyses that define it
   * themselves (a definition inside a dashboard is a use).
   */
  private usersOf(group: Group, index: FieldIndex): FieldInfo[] {
    const users: FieldInfo[] = [];
    for (const datasetId of group.datasetIds) {
      users.push(...(index.usersOf.get(`${datasetId}::${group.name}`) ?? []));
    }
    for (const entry of group.entries) {
      if (entry.sourceAssetType !== 'dataset') {
        users.push(entry);
      }
    }
    return users;
  }

  private visualsOf(group: Group, index: FieldIndex): FieldVisualUsage[] {
    const seen = new Set<string>();
    const out: FieldVisualUsage[] = [];
    for (const datasetId of group.datasetIds) {
      for (const v of index.visualsOf.get(`${datasetId}::${group.name}`) ?? []) {
        const id = `${v.assetId}:${v.visualId}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push(v);
        }
      }
    }
    return out;
  }

  /**
   * The whole dependency chain around one calculated field, not just its
   * neighbours: upstream to the columns it ultimately reads, downstream to
   * the calculated fields computed from it. Breadth-first in each direction,
   * so a field reached twice keeps the shorter path, and bounded in both
   * depth and size — a chain nobody can read is not worth the payload.
   */
  private lineageOf(
    group: Group,
    index: FieldIndex,
    groups: Map<string, Group>,
    listingOf: Map<string, CatalogListingRef>,
    datasetNames: Map<string, string>,
    assets: SmusAsset[]
  ): FieldLineage {
    const nodes = new Map<string, FieldLineageNode>();
    const edges = new Map<string, FieldLineageEdge>();
    let truncated = false;

    const add = (node: FieldLineageNode): boolean => {
      if (nodes.has(node.id)) {
        return false;
      }
      if (nodes.size >= MAX_LINEAGE_NODES) {
        truncated = true;
        return false;
      }
      nodes.set(node.id, node);
      return true;
    };
    const link = (from: string, to: string) => {
      if (nodes.has(from) && nodes.has(to)) {
        edges.set(`${from}->${to}`, { from, to });
      }
    };
    const ofGroup = (g: Group, depth: number): FieldLineageNode => ({
      id: `cf:${g.key}`,
      name: g.name,
      kind: 'calculated',
      depth,
      key: g.key,
      expression: g.expression,
      ...(g.dataType ? { dataType: g.dataType } : {}),
      usedBy: this.countUsage(g, index),
    });

    add(ofGroup(group, 0));

    // Upstream: what each field is computed from, down to plain columns.
    let up: Group[] = [group];
    for (let depth = 1; depth <= MAX_LINEAGE_DEPTH && up.length > 0; depth += 1) {
      const next: Group[] = [];
      for (const current of up) {
        for (const name of extractFieldReferences(current.expression)) {
          const read = this.resolveRead(
            name,
            current,
            index,
            groups,
            listingOf,
            datasetNames,
            assets
          );
          const parent = read.key ? groups.get(read.key) : undefined;
          const node: FieldLineageNode = parent
            ? ofGroup(parent, -depth)
            : {
                id: `col:${read.datasetId ?? '-'}:${read.name.toLowerCase()}`,
                name: read.name,
                kind: read.kind,
                depth: -depth,
                ...(read.dataType ? { dataType: read.dataType } : {}),
                ...(read.datasetId ? { datasetId: read.datasetId } : {}),
                ...(read.datasetName ? { datasetName: read.datasetName } : {}),
                ...(read.smus ? { smus: read.smus } : {}),
              };
          if (add(node) && parent) {
            next.push(parent);
          }
          link(node.id, `cf:${current.key}`);
        }
      }
      up = next;
      if (up.length > 0 && depth === MAX_LINEAGE_DEPTH) {
        truncated = true;
      }
    }

    // Downstream: the calculated fields computed from each field in turn.
    let down: Group[] = [group];
    for (let depth = 1; depth <= MAX_LINEAGE_DEPTH && down.length > 0; depth += 1) {
      const next: Group[] = [];
      for (const current of down) {
        for (const reader of readersOf(current, groups)) {
          const node = ofGroup(reader, depth);
          if (add(node)) {
            next.push(reader);
          }
          link(`cf:${current.key}`, node.id);
        }
      }
      down = next;
      if (down.length > 0 && depth === MAX_LINEAGE_DEPTH) {
        truncated = true;
      }
    }

    // Close the picture: a field in the chain may read another field already
    // in it without either walk having drawn that edge — a downstream reader's
    // other inputs, most often. Nothing is added, only joined up.
    for (const node of nodes.values()) {
      const current = node.key ? groups.get(node.key) : undefined;
      if (!current) {
        continue;
      }
      for (const name of extractFieldReferences(current.expression)) {
        const read = this.resolveRead(
          name,
          current,
          index,
          groups,
          listingOf,
          datasetNames,
          assets
        );
        link(
          read.key ? `cf:${read.key}` : `col:${read.datasetId ?? '-'}:${read.name.toLowerCase()}`,
          node.id
        );
      }
    }

    return { nodes: [...nodes.values()], edges: [...edges.values()], truncated };
  }

  private countUsage(group: Group, index: FieldIndex): FieldLineageNode['usedBy'] {
    const users = dedupeUsers(this.usersOf(group, index));
    return {
      dashboards: users.filter((u) => u.assetType === 'dashboard').length,
      analyses: users.filter((u) => u.assetType === 'analysis').length,
      visuals: this.visualsOf(group, index).length,
    };
  }

  private resolveRead(
    name: string,
    group: Group,
    index: FieldIndex,
    groups: Map<string, Group>,
    listingOf: Map<string, CatalogListingRef>,
    datasetNames: Map<string, string>,
    assets: SmusAsset[]
  ): LineageRead {
    for (const datasetId of group.datasetIds) {
      const own = index.byDataset.get(datasetId) ?? [];
      const match = own.find((f) => f.fieldName?.toLowerCase() === name.toLowerCase());
      if (!match) continue;
      if (match.isCalculated) {
        const target = [...groups.values()].find(
          (g) => g.name.toLowerCase() === name.toLowerCase() && g.datasetIds.has(datasetId)
        );
        return {
          name: match.fieldName,
          kind: 'calculated',
          key: target?.key,
          dataType: match.dataType,
          datasetId,
          datasetName: datasetNames.get(datasetId),
        };
      }
      return {
        name: match.fieldName,
        kind: 'column',
        dataType: match.dataType,
        datasetId,
        datasetName: datasetNames.get(datasetId),
        smus: smusColumn(match.columnName ?? match.fieldName, listingOf.get(datasetId), assets),
      };
    }
    // Defined in a dashboard against a column the dataset index has not seen.
    const sibling = [...groups.values()].find((g) => g.name.toLowerCase() === name.toLowerCase());
    return sibling
      ? { name: sibling.name, kind: 'calculated', key: sibling.key }
      : { name, kind: 'column' };
  }
}

function groupCalculated(index: FieldIndex): Map<string, Group> {
  const groups = new Map<string, Group>();
  const all: FieldInfo[] = [];
  for (const own of index.byDataset.values()) all.push(...own);
  for (const users of index.usersOf.values()) all.push(...users);
  const seen = new Set<FieldInfo>();
  for (const field of all) {
    if (seen.has(field) || !isCalculatedIn(field)) continue;
    seen.add(field);
    const key = calculatedFieldKey(field.fieldName, field.expression!);
    const group = groups.get(key) ?? {
      key,
      name: field.fieldName,
      canonical: canonicalExpression(field.expression),
      expression: field.expression!,
      dataType: field.dataType,
      definedIn: new Map(),
      datasetIds: new Set(),
      entries: [] as FieldInfo[],
    };
    group.definedIn.set(`${field.sourceAssetType}:${field.sourceAssetId}`, refOf(field));
    const datasetId = field.sourceAssetType === 'dataset' ? field.sourceAssetId : field.datasetId;
    if (datasetId) group.datasetIds.add(datasetId);
    group.entries.push(field);
    groups.set(key, group);
  }
  return groups;
}

/**
 * The calculated fields that read this one: they name it, and they live on a
 * dataset it lives on, so a field of the same name elsewhere is not a reader.
 */
function readersOf(group: Group, groups: Map<string, Group>): Group[] {
  return [...groups.values()].filter(
    (g) =>
      g.key !== group.key &&
      extractFieldReferences(g.expression).some(
        (r) => r.toLowerCase() === group.name.toLowerCase()
      ) &&
      [...g.datasetIds].some((id) => group.datasetIds.has(id))
  );
}

function countVariants(groups: Map<string, Group>): Map<string, number> {
  const byName = new Map<string, number>();
  for (const g of groups.values()) {
    const n = g.name.toLowerCase();
    byName.set(n, (byName.get(n) ?? 0) + 1);
  }
  return byName;
}

function listingByDataset(assets: SmusAsset[]): Map<string, CatalogListingRef> {
  const out = new Map<string, CatalogListingRef>();
  for (const asset of assets) {
    for (const dataset of asset.datasets) {
      out.set(dataset.id, {
        listingId: asset.listingId,
        name: asset.name,
        projectId: asset.projectId,
        projectName: asset.projectName,
        url: asset.url,
        matchType: dataset.matchType,
        ...(dataset.via ? { via: dataset.via } : {}),
      });
    }
  }
  return out;
}

function datasetNamesFrom(index: FieldIndex, assets: SmusAsset[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const [id, own] of index.byDataset) {
    const first = own[0];
    if (first) names.set(id, first.sourceAssetName);
  }
  for (const asset of assets) {
    for (const dataset of asset.datasets) {
      if (!names.has(dataset.id)) names.set(dataset.id, dataset.name);
    }
  }
  return names;
}

function smusColumn(
  columnName: string,
  listing: CatalogListingRef | undefined,
  assets: SmusAsset[]
): SmusColumnRef | undefined {
  if (!listing) return undefined;
  const asset = assets.find((a) => a.listingId === listing.listingId);
  const glossaryTerms = (asset?.glossaryTerms ?? []).map((t) => t.name);
  const columns = asset?.columns ?? [];
  const base = { ...listing, listingColumnCount: columns.length, glossaryTerms };
  const hit = matchListingColumn(columnName, columns);
  // The dataset is tied to this listing either way. Separate the two reasons a
  // column is not named: a listing that publishes a schema this column is not
  // in, and a listing that publishes no schema at all. They are fixed in
  // different places, so the UI must be able to tell them apart.
  if (!hit) {
    return { ...base, match: columns.length > 0 ? 'listing-only' : 'no-schema' };
  }
  return {
    ...base,
    columnName: hit.column.name,
    columnType: hit.column.type,
    match: hit.match,
    description: hit.column.description,
  };
}

const MATCH_RANK: Record<ColumnMatchKind, number> = {
  exact: 3,
  normalized: 2,
  'listing-only': 1,
  'no-schema': 0,
};

/**
 * A column usually sits in several datasets, each tied to its own listing. Take
 * the best tie-back of them: a listing that names the column beats one that
 * only knows the table, whatever order the datasets came in.
 */
function betterTie(
  current: SmusColumnRef | undefined,
  candidate: SmusColumnRef | undefined
): SmusColumnRef | undefined {
  if (!candidate) return current;
  if (!current) return candidate;
  return MATCH_RANK[candidate.match] > MATCH_RANK[current.match] ? candidate : current;
}

function matches(item: CalculatedFieldSummary, filters: FieldCatalogFilters): boolean {
  if (!matchesScope(item.datasets, filters)) {
    return false;
  }
  if (filters.projectId && !item.datasets.some((d) => d.listing?.projectId === filters.projectId)) {
    return false;
  }
  if (filters.datasetId && !item.datasets.some((d) => d.id === filters.datasetId)) {
    return false;
  }
  if (filters.conflictsOnly && !item.conflict) {
    return false;
  }
  const needle = filters.search?.trim().toLowerCase();
  if (
    needle &&
    !item.name.toLowerCase().includes(needle) &&
    !item.expression.toLowerCase().includes(needle)
  ) {
    return false;
  }
  return true;
}

function isUnused(item: CalculatedFieldSummary): boolean {
  return item.usedBy.dashboards === 0 && item.usedBy.analyses === 0 && item.usedBy.visuals === 0;
}
