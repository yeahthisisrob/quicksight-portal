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
import { randomUUID } from 'node:crypto';

import type { CatalogListing, CatalogProject } from '../../../adapters/aws/DataZoneAdapter';
import type {
  CreateSmusDatasetRequest,
  SmusAsset,
  SmusAssetsResult,
  SmusDatasetLink,
  SmusMatchType,
  SmusStatus,
} from '../../../features/smus/types';
import { getSmusConfig, type SmusConfig } from '../../config/smusConfig';
import { CACHE_TTL } from '../../constants/timeConstants';
import { ValidationError } from '../../errors/ValidationError';
import type { QuickSightService } from '../../services/aws/QuickSightService';
import type { CacheService } from '../../services/cache/CacheService';
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { ASSET_TYPES } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { normalizePermissionsArray } from '../../utils/permissions';
import {
  SMUS_SNAPSHOT_KEY,
  type SmusExportDiagnostics,
  type SmusSnapshot,
  type SmusSnapshotSummary,
  snapshotMatches,
  summarizeSnapshot,
} from './SmusSnapshot';

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

/** Glue/Athena source types to the QuickSight InputColumn vocabulary. */
export function toQuickSightColumnType(sourceType: string): string {
  const t = sourceType.toLowerCase();
  if (/^(tinyint|smallint|int|integer|bigint)$/.test(t)) {
    return 'INTEGER';
  }
  if (/^(float|double|real|decimal|numeric)/.test(t)) {
    return 'DECIMAL';
  }
  if (t === 'boolean') {
    return 'BOOLEAN';
  }
  if (/^(timestamp|date|datetime)/.test(t)) {
    return 'DATETIME';
  }
  return 'STRING';
}

/** Kept as a name for the settings handler; the export job produces it. */
export type ProjectDiscoveryDiagnostics = SmusExportDiagnostics;

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
    config?: SmusConfig,
    private readonly quickSightService: QuickSightService | null = null
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

    const [linkMap, datasets] = await Promise.all([
      this.getLinkMap(),
      this.cacheService.getAllDatasets(),
    ]);
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
      });
      datasetsByListing.set(link.listingId, list);
    }

    const projectFilter = new Set(this.config.projectIds);
    const patterns = this.config.databasePatterns;
    const needle = search?.trim().toLowerCase() ?? '';

    const assets = listings
      .filter(
        (l) =>
          projectFilter.size === 0 || (l.owningProjectId && projectFilter.has(l.owningProjectId))
      )
      .filter(
        (l) =>
          patterns.length === 0 ||
          (l.table !== undefined && patterns.some((p) => matchesGlob(l.table!.database, p)))
      )
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

  /**
   * Create a QuickSight dataset over a listing's Glue table through an
   * existing data source. Columns come from the listing's forms; the data
   * source is re-checked against the account's list rather than trusted.
   */
  public async createDatasetFromListing(
    listingId: string,
    request: CreateSmusDatasetRequest
  ): Promise<{ dataSetId: string; name: string; arn: string }> {
    if (!this.config.enabled || !this.quickSightService) {
      throw new ValidationError('SMUS is not configured');
    }
    const listing = ((await this.getSnapshot())?.listings ?? []).find(
      (l) => l.listingId === listingId
    );
    if (!listing) {
      throw new ValidationError(`No published asset with listing id '${listingId}'`);
    }
    if (!listing.table) {
      throw new ValidationError(
        `'${listing.name}' has no table identity in its metadata forms, so a dataset cannot be built from it`
      );
    }
    if (!listing.columns || listing.columns.length === 0) {
      throw new ValidationError(`'${listing.name}' lists no columns in its metadata forms`);
    }

    const dataSources = await this.cacheService.getCacheEntries({
      assetType: ASSET_TYPES.datasource,
      statusFilter: AssetStatusFilter.ACTIVE,
    });
    const dataSource = dataSources.find((d) => d.assetId === request.dataSourceId);
    if (!dataSource?.arn) {
      throw new ValidationError(
        "The selected data source is not one of this account's data sources"
      );
    }

    const name = request.name?.trim() || listing.name;
    const permissions = request.permissionsFromDataSetId
      ? normalizePermissionsArray(
          await this.quickSightService.describeDatasetPermissions(request.permissionsFromDataSetId)
        )
      : [];

    const dataSetId = randomUUID();
    const tableId = randomUUID();
    logger.info('Creating dataset from SMUS listing', {
      listingId,
      dataSetId,
      table: listing.table,
      columns: listing.columns.length,
      importMode: request.importMode,
      permissions: permissions.length,
    });

    const created = await this.quickSightService.createDataSet({
      dataSetId,
      name,
      importMode: request.importMode,
      permissions: permissions.length > 0 ? permissions : undefined,
      physicalTableMap: {
        [tableId]: {
          RelationalTable: {
            DataSourceArn: dataSource.arn,
            Catalog: listing.table.catalog || 'AwsDataCatalog',
            Schema: listing.table.database,
            Name: listing.table.name,
            InputColumns: listing.columns.map((c) => ({
              Name: c.name,
              Type: toQuickSightColumnType(c.type) as any,
            })),
          },
        },
      } as any,
    });

    SmusService.invalidateLinkMap();
    return { dataSetId: created.dataSetId, name, arn: created.arn };
  }

  /** Projects in the last export: ListProjects unioned with the listing publishers. */
  public async listProjects(): Promise<CatalogProject[]> {
    return (await this.getSnapshot())?.projects ?? [];
  }

  /**
   * The project list plus how the export found it, so an empty picker can say
   * why. Entirely from the snapshot: no DataZone call on a page request.
   */
  public async projectDiscovery(): Promise<{
    projects: CatalogProject[];
    diagnostics?: ProjectDiscoveryDiagnostics;
    exportedAt: string | null;
  }> {
    const snapshot = await this.getSnapshot();
    if (!snapshot) {
      return { projects: [], exportedAt: null };
    }
    return {
      projects: snapshot.projects,
      diagnostics: snapshot.diagnostics,
      exportedAt: snapshot.exportedAt,
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

  private async buildLinkMap(): Promise<Map<string, SmusDatasetLink>> {
    const [snapshot, datasets] = await Promise.all([
      this.getSnapshot(),
      this.cacheService.getAllDatasets(),
    ]);
    const listings = snapshot?.listings ?? [];

    const listingsByName = new Map<string, CatalogListing>();
    for (const listing of listings) {
      const key = normalizeForMatch(listing.name);
      if (!listingsByName.has(key)) {
        listingsByName.set(key, listing);
      }
    }

    const linkMap = new Map<string, SmusDatasetLink>();
    for (const dataset of datasets) {
      linkMap.set(dataset.assetId, this.resolveDatasetLink(dataset, listingsByName));
    }

    logger.info('SMUS link map built', {
      listings: listings.length,
      datasets: datasets.length,
      linked: Array.from(linkMap.values()).filter((l) => l.linked).length,
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
