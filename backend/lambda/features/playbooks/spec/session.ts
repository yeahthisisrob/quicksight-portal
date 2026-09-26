/**
 * Everything a spec asks the portal more than once, asked once per
 * invocation: what an asset reads, whether a dataset is governed, a
 * dataset's columns, and the candidate datasets a match step chooses from.
 */
import pLimit from 'p-limit';

import { type PlaybookContext, PortalCallError } from '../types';

interface RelatedHit {
  entityId: string;
  type: string;
  name: string;
  attributes: Record<string, string | number | boolean>;
}

export interface DatasetRef {
  id: string;
  name: string;
}

export interface DatasourceRef {
  id: string;
  name: string;
  engine?: string;
}

export interface Reads {
  datasets: DatasetRef[];
  datasources: DatasourceRef[];
}

export interface DatasetColumns {
  dataSetId: string;
  name: string;
  columns: Array<{ name: string; type?: string }>;
}

export interface FolderFacts {
  id: string;
  name: string;
  /** `${TYPE}:${id}` of every member. */
  members: Set<string>;
}

export interface Candidate {
  id: string;
  name: string;
  engines: string[];
  governed: boolean;
}

const RELATED_LIMIT = 200;
const PAGE_SIZE = 100;
/** Graph reads at once, for the few datasets whose engine the list cannot say. */
const GRAPH_CONCURRENCY = 8;
/** What the list says for a dataset reading several engines, or none it knows. */
const UNSURE_ENGINES = new Set(['', 'COMPOSITE', 'UNKNOWN', 'FILE']);
const NOT_FOUND = 404;

const idOf = (entityId: string) => entityId.slice(entityId.indexOf(':') + 1);

function memo<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit) return hit;
  const pending = load();
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
}

export class SpecSession {
  private readonly readsCache = new Map<string, Promise<Reads>>();
  private readonly governedCache = new Map<string, Promise<boolean>>();
  private readonly columnsCache = new Map<string, Promise<DatasetColumns>>();
  private candidatesPromise: Promise<Candidate[]> | null = null;
  private readonly folderCache = new Map<string, Promise<FolderFacts>>();

  public constructor(private readonly ctx: PlaybookContext) {}

  /** An entity the graph has not got (just created, or never exported) relates to nothing. */
  private async related(entityId: string, relations: string[], depth: number, types: string[]) {
    const query = new URLSearchParams({
      relations: relations.join(','),
      direction: 'out',
      depth: String(depth),
      types: types.join(','),
      limit: String(RELATED_LIMIT),
    });
    try {
      return await this.ctx.call<{ hits: RelatedHit[] }>(
        'GET',
        `/api/context/entities/${encodeURIComponent(entityId)}/related?${query.toString()}`
      );
    } catch (error) {
      if (error instanceof PortalCallError && error.status === NOT_FOUND) return { hits: [] };
      throw error;
    }
  }

  /** The datasets an asset reads (a dataset reads itself) and their data sources. */
  public reads(type: string, id: string): Promise<Reads> {
    return memo(this.readsCache, `${type}:${id}`, async () => {
      const isDataset = type === 'dataset';
      const result = await this.related(
        `${type}:${id}`,
        isDataset ? ['through-datasource'] : ['uses-dataset', 'through-datasource'],
        isDataset ? 1 : 2,
        ['dataset', 'datasource']
      );
      const hits = result.hits ?? [];
      const datasets = hits
        .filter((h) => h.type === 'dataset')
        .map((h) => ({ id: idOf(h.entityId), name: h.name }));
      return {
        datasets: isDataset ? [{ id, name: id }] : datasets,
        datasources: hits
          .filter((h) => h.type === 'datasource')
          .map((h) => ({
            id: idOf(h.entityId),
            name: h.name,
            ...(h.attributes.sourceType ? { engine: String(h.attributes.sourceType) } : {}),
          })),
      };
    });
  }

  /** The data sources one dataset reads through. */
  public async sourcesOf(datasetId: string): Promise<DatasourceRef[]> {
    return (await this.reads('dataset', datasetId)).datasources;
  }

  /** The datasets that read through a data source. */
  public async readersOf(datasourceId: string): Promise<DatasetRef[]> {
    const query = new URLSearchParams({
      relations: 'through-datasource',
      direction: 'in',
      depth: '1',
      types: 'dataset',
      limit: String(RELATED_LIMIT),
    });
    const result = await this.ctx.call<{ hits: RelatedHit[] }>(
      'GET',
      `/api/context/entities/${encodeURIComponent(`datasource:${datasourceId}`)}/related?${query.toString()}`
    );
    return (result.hits ?? []).map((h) => ({ id: idOf(h.entityId), name: h.name }));
  }

  /** A folder's name and members, asked once however many assets go into it. */
  public folder(folderId: string): Promise<FolderFacts> {
    return memo(this.folderCache, folderId, async () => {
      const path = `/api/folders/${encodeURIComponent(folderId)}`;
      const [details, members] = await Promise.all([
        this.ctx.call<{ name?: string }>('GET', path),
        this.ctx.call<Array<{ MemberId: string; MemberType: string }>>('GET', `${path}/members`),
      ]);
      return {
        id: folderId,
        name: details?.name ?? folderId,
        members: new Set((members ?? []).map((m) => `${m.MemberType}:${m.MemberId}`)),
      };
    });
  }

  /** Whether a SMUS listing governs this dataset. */
  public governed(datasetId: string): Promise<boolean> {
    return memo(this.governedCache, datasetId, async () => {
      const result = await this.related(`dataset:${datasetId}`, ['reads-listing'], 1, ['listing']);
      return (result.hits ?? []).length > 0;
    });
  }

  public columns(datasetId: string): Promise<DatasetColumns> {
    return memo(this.columnsCache, datasetId, () =>
      this.ctx.call<DatasetColumns>(
        'GET',
        `/api/authoring/datasets/${encodeURIComponent(datasetId)}/columns`
      )
    );
  }

  /**
   * Every live dataset, with the engines it reads through and whether it is
   * governed: from two list reads (the engine from each row's source type,
   * governance by the Datasets page's own SMUS rule), and the graph only for
   * a dataset reading several engines. One that cannot be read is left out,
   * not allowed to fail the rest; a failed attempt is not kept.
   */
  public candidates(): Promise<Candidate[]> {
    this.candidatesPromise ??= this.loadCandidates().catch((error) => {
      this.candidatesPromise = null;
      throw error;
    });
    return this.candidatesPromise;
  }

  private async listDatasets(filter = ''): Promise<Array<DatasetRef & { sourceType?: string }>> {
    const rows: Array<DatasetRef & { sourceType?: string }> = [];
    for (let page = 1; ; page++) {
      const data = await this.ctx.call<{
        datasets?: Array<DatasetRef & { sourceType?: string }>;
        pagination?: { totalPages?: number };
      }>('GET', `/api/assets/datasets/paginated?page=${page}&pageSize=${PAGE_SIZE}${filter}`);
      rows.push(...(data.datasets ?? []));
      if (page >= (data.pagination?.totalPages ?? 1) || !data.datasets?.length) return rows;
    }
  }

  private async loadCandidates(): Promise<Candidate[]> {
    const [rows, linked] = await Promise.all([
      this.listDatasets(),
      this.listDatasets('&smusFilter=smus_linked'),
    ]);
    const governed = new Set(linked.map((r) => r.id));
    const limit = pLimit(GRAPH_CONCURRENCY);
    const settled = await Promise.allSettled(
      rows.map((row) =>
        limit(async () => {
          const listed = (row.sourceType ?? '').toUpperCase();
          const engines = UNSURE_ENGINES.has(listed)
            ? [
                ...new Set(
                  (await this.sourcesOf(row.id))
                    .map((s) => s.engine)
                    .filter((e): e is string => Boolean(e))
                ),
              ]
            : [listed];
          return { id: row.id, name: row.name, engines, governed: governed.has(row.id) };
        })
      )
    );
    return settled
      .filter((r): r is PromiseFulfilledResult<Candidate> => r.status === 'fulfilled')
      .map((r) => r.value);
  }
}

export interface GovernedColumn {
  name: string;
  description?: string;
}

const listingColumnsCache = new WeakMap<SpecSession, Map<string, Promise<GovernedColumn[]>>>();

/**
 * The columns of the SMUS listing a dataset reads, with their descriptions:
 * what a model reads to tell `is_closed` from `status`.
 */
export function governedColumns(
  session: SpecSession,
  ctx: PlaybookContext,
  datasetId: string
): Promise<GovernedColumn[]> {
  let cache = listingColumnsCache.get(session);
  if (!cache) {
    cache = new Map();
    listingColumnsCache.set(session, cache);
  }
  return memo(cache, datasetId, async () => {
    const query = new URLSearchParams({
      relations: 'reads-listing,has-column',
      direction: 'out',
      depth: '2',
      types: 'listing-column',
      limit: String(RELATED_LIMIT),
    });
    const result = await ctx.call<{
      hits: Array<{ name: string; description?: string; summary?: string }>;
    }>(
      'GET',
      `/api/context/entities/${encodeURIComponent(`dataset:${datasetId}`)}/related?${query.toString()}`
    );
    return (result.hits ?? []).map((h) => ({
      name: h.name,
      ...(h.description || h.summary ? { description: h.description || h.summary } : {}),
    }));
  });
}
