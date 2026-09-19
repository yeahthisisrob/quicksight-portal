/**
 * SmusService — resolves which QuickSight datasets have a corresponding
 * catalog item in the configured SMUS (SageMaker Unified Studio) domain.
 *
 * Design: SMUS catalog membership is owned by SMUS, so it is never persisted
 * to the portal's S3 cache — every resolution is computed from a live
 * DataZone catalog sweep matched against the *cached* QuickSight dataset
 * metadata (name + source table names from lineage). A short in-memory TTL
 * plus single-flight keeps page renders from hammering the API while staying
 * fresh enough to be truthful.
 */
import { randomUUID } from 'node:crypto';

import type {
  CatalogListing,
  CatalogProject,
  DataZoneAdapter,
} from '../../../adapters/aws/DataZoneAdapter';
import type { StsAdapter } from '../../../adapters/aws/StsAdapter';
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
import { withTimeout } from '../../utils/withTimeout';

/** Link map freshness window — catalog membership changes slowly. */
const LINK_MAP_TTL_MS = CACHE_TTL.SHORT;
/**
 * Discovery runs behind a 30-second API gateway window. Each upstream call
 * gets its own bound so a hung one is reported by name instead of the whole
 * request dying with no body.
 */
const DISCOVERY_CALL_TIMEOUT_MS = 12_000;
const CALLER_LOOKUP_TIMEOUT_MS = 6_000;

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

export interface ProjectDiscoveryDiagnostics {
  domainId: string;
  region: string;
  fromListProjects: number;
  listings: number;
  publishers: number;
  listProjectsError?: string;
  listingsError?: string;
  /** The principal DataZone saw, from STS (an assumed-role session ARN in Lambda). */
  callerArn?: string;
  /** The IAM role behind that session: what smus-grant and the SMUS console register. */
  roleArn?: string;
  /** The role's domain user profile status, or 'not found' when DataZone has none for it. */
  profileStatus?: string;
}

/** arn:aws:sts::123:assumed-role/Name/session -> arn:aws:iam::123:role/Name */
export function roleArnFromCaller(callerArn: string): string {
  const match = /^arn:([^:]+):sts::(\d+):assumed-role\/([^/]+)\//.exec(callerArn);
  return match ? `arn:${match[1]}:iam::${match[2]}:role/${match[3]}` : callerArn;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

interface SweepCacheEntry<T> {
  expiresAt: number;
  promise: Promise<T>;
}

export class SmusService {
  /** Container-scoped cache so warm Lambda invocations share one sweep. */
  private static linkMapCache: LinkMapCacheEntry | null = null;
  private static listingsCache: SweepCacheEntry<CatalogListing[]> | null = null;
  private static projectsCache: SweepCacheEntry<CatalogProject[]> | null = null;

  /** Clear the container-scoped link map (test hook / forced refresh). */
  public static invalidateLinkMap(): void {
    SmusService.linkMapCache = null;
    SmusService.listingsCache = null;
    SmusService.projectsCache = null;
  }

  private readonly config: SmusConfig;

  public constructor(
    private readonly cacheService: CacheService,
    private readonly dataZoneAdapter: DataZoneAdapter | null,
    config?: SmusConfig,
    private readonly quickSightService: QuickSightService | null = null,
    private readonly stsAdapter: StsAdapter | null = null
  ) {
    this.config = config ?? getSmusConfig();
  }

  /**
   * Published assets in the selected projects, each with the QuickSight
   * datasets already reading it. Reuse first: a target that exists should be
   * picked, not recreated.
   */
  public async listAssets(search?: string): Promise<SmusAssetsResult> {
    if (!this.config.enabled || !this.dataZoneAdapter) {
      return { configured: false, projectFilter: [], assets: [] };
    }

    const [listings, projects, linkMap, datasets] = await Promise.all([
      this.getListings(),
      this.getProjects(),
      this.getLinkMap(),
      this.cacheService.getAllDatasets(),
    ]);

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

    return { configured: true, projectFilter: [...projectFilter], assets };
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
    if (!this.config.enabled || !this.dataZoneAdapter || !this.quickSightService) {
      throw new ValidationError('SMUS is not configured');
    }
    const listing = (await this.getListings()).find((l) => l.listingId === listingId);
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

  private getListings(): Promise<CatalogListing[]> {
    return this.sweep(
      () => SmusService.listingsCache,
      (entry) => {
        SmusService.listingsCache = entry;
      },
      () => this.dataZoneAdapter!.listAllListings(this.config.domainId)
    );
  }

  /**
   * The projects the portal can read from: the ones ListProjects returns for
   * the portal's role, plus every project that has published a listing.
   * ListProjects is scoped to the caller's memberships, so for a service role
   * it is often empty while the catalog is not; the publishers are the set
   * that matters for choosing datasets anyway.
   */
  public async listProjects(): Promise<CatalogProject[]> {
    if (!this.config.enabled || !this.dataZoneAdapter) {
      return [];
    }
    return await this.getProjects();
  }

  /**
   * The project list plus how it was found, so an empty picker can say why:
   * a Lambda role that belongs to no project gets nothing from ListProjects,
   * and a domain with no published listings has no publishers to fall back on.
   * Always a fresh sweep (this is the Settings diagnostics path), and it
   * refreshes the container cache so the next catalog request agrees.
   */
  public async projectDiscovery(): Promise<{
    projects: CatalogProject[];
    diagnostics: ProjectDiscoveryDiagnostics;
  }> {
    const diagnostics: ProjectDiscoveryDiagnostics = {
      domainId: this.config.domainId,
      region: this.config.region,
      fromListProjects: 0,
      listings: 0,
      publishers: 0,
    };
    if (!this.config.enabled || !this.dataZoneAdapter) {
      return { projects: [], diagnostics };
    }
    const adapter = this.dataZoneAdapter;
    SmusService.listingsCache = null;
    logger.info('SMUS project discovery started', {
      domainId: this.config.domainId,
      region: this.config.region,
    });
    const [listed, listings] = await Promise.all([
      withTimeout(
        adapter.listProjects(this.config.domainId),
        DISCOVERY_CALL_TIMEOUT_MS,
        'ListProjects'
      ).catch((error) => {
        diagnostics.listProjectsError = errorMessage(error);
        return [] as CatalogProject[];
      }),
      withTimeout(this.getListings(), DISCOVERY_CALL_TIMEOUT_MS, 'SearchListings').catch(
        (error) => {
          SmusService.listingsCache = null;
          diagnostics.listingsError = errorMessage(error);
          return [] as CatalogListing[];
        }
      ),
      withTimeout(this.describeCaller(diagnostics), CALLER_LOOKUP_TIMEOUT_MS, 'caller').catch(
        (error) => {
          logger.warn('Could not describe the caller for SMUS diagnostics', { error });
        }
      ),
    ]);
    diagnostics.fromListProjects = listed.length;
    diagnostics.listings = listings.length;
    diagnostics.publishers = new Set(listings.map((l) => l.owningProjectId).filter(Boolean)).size;
    if (diagnostics.listProjectsError || diagnostics.listingsError) {
      return { projects: listed, diagnostics };
    }
    const promise = this.discoverProjects();
    SmusService.projectsCache = { expiresAt: Date.now() + LINK_MAP_TTL_MS, promise };
    return { projects: await promise, diagnostics };
  }

  /** Name the principal DataZone saw and whether the domain knows it. */
  private async describeCaller(diagnostics: ProjectDiscoveryDiagnostics): Promise<void> {
    if (!this.stsAdapter || !this.dataZoneAdapter) {
      return;
    }
    try {
      const identity = await this.stsAdapter.getCallerIdentity();
      diagnostics.callerArn = identity.arn;
      diagnostics.roleArn = roleArnFromCaller(identity.arn);
      const profile = await this.dataZoneAdapter.getIamRoleProfile(
        this.config.domainId,
        diagnostics.roleArn
      );
      diagnostics.profileStatus = profile?.status ?? 'not found';
    } catch (error) {
      logger.warn('Could not describe the caller for SMUS diagnostics', { error });
    }
  }

  private getProjects(): Promise<CatalogProject[]> {
    return this.sweep(
      () => SmusService.projectsCache,
      (entry) => {
        SmusService.projectsCache = entry;
      },
      () => this.discoverProjects()
    );
  }

  private async discoverProjects(): Promise<CatalogProject[]> {
    const adapter = this.dataZoneAdapter!;
    const [listed, listings] = await Promise.all([
      adapter.listProjects(this.config.domainId),
      this.getListings(),
    ]);
    const byId = new Map(listed.map((p) => [p.id, p]));
    const publishers = [
      ...new Set(listings.map((l) => l.owningProjectId).filter(Boolean)),
    ] as string[];
    const unnamed = publishers.filter((id) => !byId.has(id));
    const fetched = await Promise.all(
      unnamed.map((id) => adapter.getProject(this.config.domainId, id))
    );
    unnamed.forEach((id, i) => {
      byId.set(id, fetched[i] ?? { id, name: id });
    });
    logger.info('SMUS projects discovered', {
      fromListProjects: listed.length,
      fromListings: publishers.length,
      total: byId.size,
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** TTL + single-flight for one catalog sweep; failures are not cached. */
  private sweep<T>(
    read: () => SweepCacheEntry<T> | null,
    write: (entry: SweepCacheEntry<T> | null) => void,
    run: () => Promise<T>
  ): Promise<T> {
    const cached = read();
    if (cached && cached.expiresAt > Date.now()) {
      return cached.promise;
    }
    const promise = run().catch((error) => {
      write(null);
      throw error;
    });
    write({ expiresAt: Date.now() + LINK_MAP_TTL_MS, promise });
    return promise;
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

  public getStatus(): SmusStatus {
    if (!this.config.enabled) {
      return { configured: false };
    }
    return {
      configured: true,
      domainId: this.config.domainId,
      portalUrl: this.config.portalUrl,
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
    if (!this.dataZoneAdapter) {
      throw new Error('SMUS integration is not configured');
    }

    const [listings, datasets] = await Promise.all([
      this.getListings(),
      this.cacheService.getAllDatasets(),
    ]);

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
