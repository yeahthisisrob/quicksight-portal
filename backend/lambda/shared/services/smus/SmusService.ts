/**
 * SmusService — what the portal knows about the configured SMUS (SageMaker
 * Unified Studio) domain, and which QuickSight datasets read its listings.
 *
 * Design: everything DataZone-side comes from the SMUS snapshot the export
 * job wrote (see SmusExportService); no page request calls DataZone. The
 * link map (dataset -> listing, matched on source tables from lineage, then
 * custom SQL, then name) is derived from that snapshot plus the cached
 * dataset metadata, with a short in-memory TTL and single-flight.
 */
import type {
  CatalogListing,
  CatalogProject,
  DataZoneAdapter,
} from '../../../adapters/aws/DataZoneAdapter';
import { getSmusConfig, type SmusConfig } from '../../config/smusConfig';
import { CACHE_TTL } from '../../constants/timeConstants';
import type { CacheService } from '../../services/cache/CacheService';
import type {
  SmusAsset,
  SmusAssetsResult,
  SmusDatasetLink,
  SmusMatchType,
  SmusStatus,
} from '../../types/smus';
import { logger } from '../../utils/logger';
import { withTimeout } from '../../utils/withTimeout';
import { catalog } from '../catalog/catalogStore';
import {
  SMUS_SNAPSHOT_KEY,
  type SmusExportDiagnostics,
  type SmusSnapshot,
  type SmusSnapshotSummary,
  snapshotMatches,
  summarizeSnapshot,
} from './SmusSnapshot';

/** A live ListProjects for the Settings picker must answer inside the gateway window. */
const LIVE_PROJECTS_TIMEOUT_MS = 20_000;

/** Link map freshness window — catalog membership changes slowly. */
const LINK_MAP_TTL_MS = CACHE_TTL.SHORT;

interface LinkMapCacheEntry {
  expiresAt: number;
  promise: Promise<Map<string, SmusDatasetLink>>;
}

/**
 * Normalize an identifier for matching: lowercase, trimmed, with runs of
 * spaces/underscores/hyphens collapsed to a single underscore so
 * "Sales Orders" matches a "sales_orders" table listing.
 */
function normalizeForMatch(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '_');
}

/** `published_*` style patterns, case-insensitive. */
export function matchesGlob(value: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

/**
 * Listings by every name they answer to. A listing is found by its own name
 * and by the Glue table behind it: publishers rename listings for
 * readability ("Orders (gold)" over fct_orders), and a dataset only knows
 * the table it reads, so indexing the name alone left those datasets tied
 * to nothing. Names first across every listing, so a name never loses to
 * another listing's table, then the qualified tables, then the bare ones.
 */
function indexListings(listings: CatalogListing[]): Map<string, CatalogListing> {
  const listingsByName = new Map<string, CatalogListing>();
  const index = (key: string | undefined, listing: CatalogListing) => {
    if (!key) {
      return;
    }
    const normalized = normalizeForMatch(key);
    if (normalized && !listingsByName.has(normalized)) {
      listingsByName.set(normalized, listing);
    }
  };
  for (const listing of listings) {
    index(listing.name, listing);
  }
  for (const listing of listings) {
    index(listing.table ? `${listing.table.database}.${listing.table.name}` : undefined, listing);
  }
  for (const listing of listings) {
    index(listing.table?.name, listing);
  }
  return listingsByName;
}

/** Kept as a name for the settings handler; the export job produces it. */
type ProjectDiscoveryDiagnostics = SmusExportDiagnostics;

/** A dataset built on another one is followed no further than this. */
const MAX_LINEAGE_DEPTH = 10;

/**
 * A dataset built on other datasets reads the governed tables they read, but
 * it has no table identity of its own: its physical tables are empty (or name
 * the parent), and its display name is rarely the listing's. Direct matching
 * therefore ties the leaf of a lineage to a listing and nothing above it, so
 * every calculated field — which is exactly what people build on top of a
 * governed table — looked ungoverned.
 *
 * This is the second pass: an unlinked dataset inherits the listing of the
 * nearest ancestor that matched directly. Ancestors come from the parsed
 * lineage (`lineageData.datasetIds`), breadth-first so the closest parent
 * wins, and only direct matches are inherited from, so the result does not
 * depend on the order datasets came in.
 */
function inheritThroughLineage(
  datasets: Array<{ assetId: string; assetName?: string; metadata?: any }>,
  direct: Map<string, SmusDatasetLink>
): Map<string, SmusDatasetLink> {
  const parentsOf = new Map<string, string[]>();
  const nameOf = new Map<string, string | undefined>();
  for (const dataset of datasets) {
    const parents: unknown[] = dataset.metadata?.lineageData?.datasetIds ?? [];
    parentsOf.set(
      dataset.assetId,
      parents.filter((id): id is string => typeof id === 'string' && id !== dataset.assetId)
    );
    nameOf.set(dataset.assetId, dataset.assetName);
  }

  const inherited = new Map<string, SmusDatasetLink>();
  for (const dataset of datasets) {
    if (direct.get(dataset.assetId)?.linked) {
      continue;
    }
    const seen = new Set<string>([dataset.assetId]);
    let frontier = parentsOf.get(dataset.assetId) ?? [];
    for (let depth = 0; depth < MAX_LINEAGE_DEPTH && frontier.length > 0; depth += 1) {
      const next: string[] = [];
      let found: { parentId: string; link: SmusDatasetLink } | undefined;
      for (const parentId of frontier) {
        if (seen.has(parentId)) {
          continue;
        }
        seen.add(parentId);
        const link = direct.get(parentId);
        if (link?.linked) {
          found ??= { parentId, link };
        }
        next.push(...(parentsOf.get(parentId) ?? []));
      }
      if (found) {
        inherited.set(dataset.assetId, {
          ...found.link,
          datasetId: dataset.assetId,
          matchType: 'lineage',
          via: { datasetId: found.parentId, name: nameOf.get(found.parentId) },
        });
        break;
      }
      frontier = next;
    }
  }
  return inherited;
}

export class SmusService {
  /** Container-scoped cache so warm Lambda invocations share one link map. */
  private static linkMapCache: LinkMapCacheEntry | null = null;

  /** Clear the container-scoped link map (test hook / after an export). */
  public static invalidateLinkMap(): void {
    SmusService.linkMapCache = null;
  }

  private readonly config: SmusConfig;

  public constructor(
    private readonly cacheService: CacheService,
    config?: SmusConfig
  ) {
    this.config = config ?? getSmusConfig();
  }

  /** The last SMUS export for this domain, or null when none has run. */
  public async getSnapshot(): Promise<SmusSnapshot | null> {
    if (!this.config.enabled) {
      return null;
    }
    const snapshot = await this.cacheService.get<SmusSnapshot>(SMUS_SNAPSHOT_KEY);
    return snapshotMatches(snapshot, this.config.domainId) ? snapshot : null;
  }

  public async getSnapshotSummary(): Promise<SmusSnapshotSummary | null> {
    const snapshot = await this.getSnapshot();
    return snapshot ? summarizeSnapshot(snapshot) : null;
  }

  /**
   * Published assets in the selected projects, each with the QuickSight
   * datasets already reading it. Reuse first: a target that exists should be
   * picked, not recreated.
   */
  public async listAssets(search?: string): Promise<SmusAssetsResult> {
    if (!this.config.enabled) {
      return { configured: false, projectFilter: [], assets: [], exportedAt: null };
    }
    const snapshot = await this.getSnapshot();
    if (!snapshot) {
      return {
        configured: true,
        projectFilter: [...this.config.projectIds],
        assets: [],
        exportedAt: null,
      };
    }

    const [linkMap, datasets] = await Promise.all([this.getLinkMap(), catalog.list('dataset')]);
    const { listings, projects } = snapshot;

    const projectNames = new Map(projects.map((p) => [p.id, p.name]));
    const datasetNames = new Map<string, string>(
      datasets.map((d: any) => [d.assetId as string, (d.assetName as string) || d.assetId])
    );
    const datasetsByListing = new Map<string, SmusAsset['datasets']>();
    for (const link of linkMap.values()) {
      if (!link.linked || !link.listingId) {
        continue;
      }
      const list = datasetsByListing.get(link.listingId) ?? [];
      list.push({
        id: link.datasetId,
        name: datasetNames.get(link.datasetId) ?? link.datasetId,
        matchType: link.matchType ?? 'name',
        ...(link.via ? { via: link.via } : {}),
      });
      datasetsByListing.set(link.listingId, list);
    }
    // The catalog's order is storage order; people read these by name.
    for (const list of datasetsByListing.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const projectFilter = new Set(this.config.projectIds);
    const needle = search?.trim().toLowerCase() ?? '';

    const assets = this.scopedListings(listings)
      .filter(
        (l) =>
          !needle ||
          l.name.toLowerCase().includes(needle) ||
          (l.description ?? '').toLowerCase().includes(needle) ||
          (l.table ? `${l.table.database}.${l.table.name}`.toLowerCase().includes(needle) : false)
      )
      .map<SmusAsset>((l) => ({
        listingId: l.listingId,
        assetId: l.assetId,
        name: l.name,
        assetType: l.assetType,
        description: l.description,
        projectId: l.owningProjectId,
        projectName: l.owningProjectId ? projectNames.get(l.owningProjectId) : undefined,
        url: this.buildListingUrl(l),
        table: l.table,
        columns: l.columns,
        glossaryTerms: l.glossaryTerms ?? [],
        forms: l.forms ?? [],
        createdAt: l.createdAt,
        datasets: datasetsByListing.get(l.listingId) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      configured: true,
      projectFilter: [...projectFilter],
      assets,
      exportedAt: snapshot.exportedAt,
    };
  }

  /** One published listing by id, from the last export; undefined when SMUS is off or it is not there. */
  public async listing(listingId: string): Promise<CatalogListing | undefined> {
    return ((await this.getSnapshot())?.listings ?? []).find((l) => l.listingId === listingId);
  }

  /**
   * The listing a dataset with these sources would be linked to, judged
   * before it exists exactly as the link map judges it afterwards: the
   * relational table it reads, the tables named in its SQL, then its name.
   * Nothing is created in SMUS; the link is derived from what is read.
   */
  public async listingFor(dataset: {
    name: string;
    physicalTables: Array<{
      type: 'RELATIONAL' | 'CUSTOM_SQL';
      name?: string;
      schema?: string;
      sqlTables?: string[];
    }>;
  }): Promise<SmusDatasetLink> {
    const listings = this.scopedListings((await this.getSnapshot())?.listings ?? []);
    return this.resolveDatasetLink(
      {
        assetId: '',
        assetName: dataset.name,
        metadata: { lineageData: { physicalTables: dataset.physicalTables } },
      },
      indexListings(listings)
    );
  }

  /** Projects in the last export: ListProjects unioned with the listing publishers. */
  public async listProjects(): Promise<CatalogProject[]> {
    return (await this.getSnapshot())?.projects ?? [];
  }

  /**
   * The projects to choose from in Settings. The export is scoped to the
   * chosen projects, so this list cannot come only from the export: it is a
   * live, bounded ListProjects unioned with whatever the last export saw,
   * plus that export's diagnostics so an empty list can say why.
   */
  public async projectDiscovery(live?: DataZoneAdapter): Promise<{
    projects: CatalogProject[];
    diagnostics?: ProjectDiscoveryDiagnostics;
    exportedAt: string | null;
  }> {
    const snapshot = await this.getSnapshot();
    const byId = new Map((snapshot?.projects ?? []).map((p) => [p.id, p]));
    const diagnostics: ProjectDiscoveryDiagnostics = snapshot
      ? { ...snapshot.diagnostics }
      : {
          domainId: this.config.domainId,
          region: this.config.region,
          fromListProjects: 0,
          listings: 0,
          publishers: 0,
        };
    if (live) {
      try {
        const listed = await withTimeout(
          live.listProjects(this.config.domainId),
          LIVE_PROJECTS_TIMEOUT_MS,
          'ListProjects'
        );
        diagnostics.fromListProjects = listed.length;
        diagnostics.listProjectsError = undefined;
        for (const project of listed) {
          byId.set(project.id, project);
        }
      } catch (error) {
        diagnostics.listProjectsError =
          error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      }
    }
    return {
      projects: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
      diagnostics,
      exportedAt: snapshot?.exportedAt ?? null,
    };
  }

  /**
   * Resolve SMUS links for the given dataset ids (all cached datasets when
   * omitted). Unknown ids resolve to `linked: false` rather than erroring.
   */
  public async getDatasetLinks(datasetIds?: string[]): Promise<SmusDatasetLink[]> {
    if (!this.config.enabled) {
      return (datasetIds || []).map((datasetId) => ({ datasetId, linked: false }));
    }

    const linkMap = await this.getLinkMap();
    const ids = datasetIds && datasetIds.length > 0 ? datasetIds : Array.from(linkMap.keys());

    return ids.map((datasetId) => linkMap.get(datasetId) ?? { datasetId, linked: false });
  }

  /**
   * Dataset id → link resolution for every cached dataset, TTL-cached and
   * single-flight per Lambda container.
   */
  public getLinkMap(): Promise<Map<string, SmusDatasetLink>> {
    const cached = SmusService.linkMapCache;
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise;
    }

    const promise = this.buildLinkMap().catch((error) => {
      // Don't cache failures — the next request retries the sweep.
      SmusService.linkMapCache = null;
      throw error;
    });
    SmusService.linkMapCache = { expiresAt: Date.now() + LINK_MAP_TTL_MS, promise };
    return promise;
  }

  public async getStatus(): Promise<SmusStatus> {
    if (!this.config.enabled) {
      return { configured: false };
    }
    const snapshot = await this.getSnapshotSummary();
    return {
      configured: true,
      domainId: this.config.domainId,
      region: this.config.region,
      portalUrl: this.config.portalUrl,
      ...(snapshot ? { snapshot } : {}),
    };
  }

  private buildLink(
    datasetId: string,
    listing: CatalogListing,
    matchType: SmusDatasetLink['matchType']
  ): SmusDatasetLink {
    return {
      datasetId,
      linked: true,
      matchType,
      listingId: listing.listingId,
      assetId: listing.assetId,
      listingName: listing.name,
      url: this.buildListingUrl(listing),
    };
  }

  /**
   * The listings the portal considers: the projects selected in Settings, and
   * the database patterns.
   *
   * One definition, used by the link map and by the asset list alike. They
   * used to disagree — the link map read every listing in the snapshot while
   * the asset list filtered — so a dataset could be tied to a listing the
   * catalog then refused to show. It read as governed on the Datasets page and
   * ungoverned in the catalog, and its calculated fields vanished from the
   * SMUS scope. Worse, a custom-SQL dataset naming several tables could be
   * claimed by an out-of-scope one before the governed table was ever tried.
   */
  private scopedListings(listings: CatalogListing[]): CatalogListing[] {
    const projects = new Set(this.config.projectIds);
    const patterns = this.config.databasePatterns;
    return listings
      .filter((l) => projects.size === 0 || (l.owningProjectId && projects.has(l.owningProjectId)))
      .filter((l) => {
        // A pattern is about the Glue database, so a listing with no table
        // identity cannot satisfy one.
        const database = l.table?.database;
        return (
          patterns.length === 0 ||
          (database !== undefined && patterns.some((p) => matchesGlob(database, p)))
        );
      });
  }

  private async buildLinkMap(): Promise<Map<string, SmusDatasetLink>> {
    const [snapshot, datasets] = await Promise.all([this.getSnapshot(), catalog.list('dataset')]);
    const all = snapshot?.listings ?? [];
    const listings = this.scopedListings(all);

    const listingsByName = indexListings(listings);

    const linkMap = new Map<string, SmusDatasetLink>();
    for (const dataset of datasets) {
      linkMap.set(dataset.assetId, this.resolveDatasetLink(dataset, listingsByName));
    }
    const inherited = inheritThroughLineage(datasets, linkMap);
    for (const [datasetId, link] of inherited) {
      linkMap.set(datasetId, link);
    }

    logger.info('SMUS link map built', {
      listings: listings.length,
      outOfScope: all.length - listings.length,
      datasets: datasets.length,
      linked: Array.from(linkMap.values()).filter((l) => l.linked).length,
      throughLineage: inherited.size,
    });

    return linkMap;
  }

  /**
   * Deep link into the SMUS portal for a catalog listing. The path segment
   * follows the SMUS catalog URL scheme; adjust here if AWS changes it —
   * this is the single place URLs are constructed.
   */
  private buildListingUrl(listing: CatalogListing): string {
    return `${this.config.portalUrl}/catalog/assets/${listing.listingId}`;
  }

  /**
   * Match candidates for one dataset, in confidence order. Governed SMUS
   * catalog entries are fundamentally tables, so physical identity outranks
   * display-name coincidence:
   *
   * 1. Relational source tables — `schema.table` (Schema is the database for
   *    Athena sources), then bare table names.
   * 2. `db.table` references parsed out of custom SQL queries, then their
   *    bare table names.
   * 3. The dataset name — a `db.table` embedded in the name first (datasets
   *    are often named after their source table), then the full name.
   *
   * Within each priority, qualified forms come before bare ones.
   */
  private collectMatchCandidates(dataset: any): Array<{ key: string; matchType: SmusMatchType }> {
    const candidates: Array<{ key: string; matchType: SmusMatchType }> = [];
    const physicalTables: any[] = dataset.metadata?.lineageData?.physicalTables || [];

    // Priority 1: relational tables
    const relational = physicalTables.filter((t) => t?.name && t?.type === 'RELATIONAL');
    for (const table of relational) {
      if (table.schema) {
        candidates.push({ key: `${table.schema}.${table.name}`, matchType: 'source-table' });
      }
    }
    for (const table of relational) {
      candidates.push({ key: table.name, matchType: 'source-table' });
    }

    // Priority 2: custom SQL table references
    const sqlRefs: string[] = physicalTables.flatMap((t) => t?.sqlTables || []);
    for (const ref of sqlRefs) {
      candidates.push({ key: ref, matchType: 'custom-sql' });
    }
    for (const ref of sqlRefs) {
      candidates.push({ key: ref.split('.').pop() as string, matchType: 'custom-sql' });
    }

    // Priority 3: the dataset name (parsed, then verbatim)
    const name: string = dataset.assetName || '';
    if (name) {
      const dotted = name.match(/\b[\w-]+\.[\w-]+\b/);
      if (dotted) {
        candidates.push({ key: dotted[0], matchType: 'name' });
        candidates.push({ key: dotted[0].split('.').pop() as string, matchType: 'name' });
      }
      candidates.push({ key: name, matchType: 'name' });
    }

    return candidates;
  }

  /** Match one dataset against the catalog using the prioritized candidates. */
  private resolveDatasetLink(
    dataset: any,
    listingsByName: Map<string, CatalogListing>
  ): SmusDatasetLink {
    for (const candidate of this.collectMatchCandidates(dataset)) {
      const listing = listingsByName.get(normalizeForMatch(candidate.key));
      if (listing) {
        return this.buildLink(dataset.assetId, listing, candidate.matchType);
      }
    }
    return { datasetId: dataset.assetId, linked: false };
  }
}
