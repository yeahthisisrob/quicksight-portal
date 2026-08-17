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
import { type CatalogListing, type DataZoneAdapter } from '../../../adapters/aws/DataZoneAdapter';
import { getSmusConfig, type SmusConfig } from '../../../shared/config/smusConfig';
import { CACHE_TTL } from '../../../shared/constants/timeConstants';
import { type CacheService } from '../../../shared/services/cache/CacheService';
import { logger } from '../../../shared/utils/logger';
import { type SmusDatasetLink, type SmusStatus } from '../types';

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

export class SmusService {
  /** Container-scoped cache so warm Lambda invocations share one sweep. */
  private static linkMapCache: LinkMapCacheEntry | null = null;

  /** Clear the container-scoped link map (test hook / forced refresh). */
  public static invalidateLinkMap(): void {
    SmusService.linkMapCache = null;
  }

  private readonly config: SmusConfig;

  constructor(
    private readonly cacheService: CacheService,
    private readonly dataZoneAdapter: DataZoneAdapter | null,
    config?: SmusConfig
  ) {
    this.config = config ?? getSmusConfig();
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
      this.dataZoneAdapter.listAllListings(this.config.domainId),
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

  /** Candidate names from lineage physical tables: bare and schema-qualified. */
  private collectSourceTableNames(dataset: any): string[] {
    const names: string[] = [];
    const physicalTables: any[] = dataset.metadata?.lineageData?.physicalTables || [];
    for (const table of physicalTables) {
      if (table?.name) {
        names.push(table.name);
        if (table.schema) {
          names.push(`${table.schema}.${table.name}`);
        }
      }
    }
    return names;
  }

  /**
   * Match one dataset against the catalog: dataset name first, then the
   * source table names captured in lineage (schema-qualified and bare).
   */
  private resolveDatasetLink(
    dataset: any,
    listingsByName: Map<string, CatalogListing>
  ): SmusDatasetLink {
    const datasetId = dataset.assetId;

    const nameMatch = dataset.assetName
      ? listingsByName.get(normalizeForMatch(dataset.assetName))
      : undefined;
    if (nameMatch) {
      return this.buildLink(datasetId, nameMatch, 'name');
    }

    for (const tableName of this.collectSourceTableNames(dataset)) {
      const tableMatch = listingsByName.get(normalizeForMatch(tableName));
      if (tableMatch) {
        return this.buildLink(datasetId, tableMatch, 'source-table');
      }
    }

    return { datasetId, linked: false };
  }
}
