/**
 * SmusExportService - the one place that talks to DataZone for catalog data.
 * Sweeps the domain (projects, published listings with forms and columns,
 * and the portal role's standing in the domain) and writes the SMUS
 * snapshot. Runs inside the SMUS export job, never on a page request.
 */
import type {
  CatalogListing,
  CatalogProject,
  DataZoneAdapter,
} from '../../../adapters/aws/DataZoneAdapter';
import type { StsAdapter } from '../../../adapters/aws/StsAdapter';
import type { SmusConfig } from '../../config/smusConfig';
import { logger } from '../../utils/logger';
import { withTimeout } from '../../utils/withTimeout';
import type { CacheService } from '../cache/CacheService';
import {
  SMUS_SNAPSHOT_KEY,
  SMUS_SNAPSHOT_VERSION,
  type SmusExportDiagnostics,
  type SmusSnapshot,
} from './SmusSnapshot';

/** Each DataZone call is bounded so a hung one is reported by name. */
const SWEEP_CALL_TIMEOUT_MS = 120_000;
const CALLER_LOOKUP_TIMEOUT_MS = 15_000;

export type SmusExportProgress = (
  message: string,
  details?: Record<string, unknown>
) => Promise<void>;

/** arn:aws:sts::123:assumed-role/Name/session -> arn:aws:iam::123:role/Name */
export function roleArnFromCaller(callerArn: string): string {
  const match = /^arn:([^:]+):sts::(\d+):assumed-role\/([^/]+)\//.exec(callerArn);
  return match ? `arn:${match[1]}:iam::${match[2]}:role/${match[3]}` : callerArn;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Names kept for the readout, so a domain with many form types stays legible. */
const MAX_FORM_NAMES = 12;

/**
 * What the sweep got out of the listings' metadata forms. The columns are the
 * whole basis of the catalog's tie-back, so when none come through the export
 * says so, rather than leaving every column looking unrelated to SMUS.
 */
function describeSchemas(listings: CatalogListing[], diagnostics: SmusExportDiagnostics): void {
  diagnostics.listingsWithTable = listings.filter((l) => l.table).length;
  diagnostics.listingsWithColumns = listings.filter((l) => (l.columns?.length ?? 0) > 0).length;
  const names = new Set<string>();
  for (const listing of listings) {
    for (const form of listing.forms ?? []) {
      names.add(form.name);
    }
  }
  diagnostics.formNames = [...names].sort().slice(0, MAX_FORM_NAMES);
}

export class SmusExportService {
  public constructor(
    private readonly cacheService: CacheService,
    private readonly dataZoneAdapter: DataZoneAdapter,
    private readonly stsAdapter: StsAdapter | null,
    private readonly config: SmusConfig
  ) {}

  /** Sweep the domain and write the snapshot. Partial results are still written. */
  public async run(
    jobId?: string,
    progress: SmusExportProgress = async () => {}
  ): Promise<SmusSnapshot> {
    const { domainId, region } = this.config;
    const diagnostics: SmusExportDiagnostics = {
      domainId,
      region,
      fromListProjects: 0,
      listings: 0,
      publishers: 0,
    };
    await progress('Sweeping the SMUS domain', { domainId, region });

    // Listings are the heavy part, so they are scoped to the projects selected
    // in Settings. The project list itself stays domain-wide (one cheap call)
    // so the Settings picker can offer projects that are not selected yet.
    const selected = [...this.config.projectIds];
    const [listed, listings] = await Promise.all([
      withTimeout(
        this.dataZoneAdapter.listProjects(domainId),
        SWEEP_CALL_TIMEOUT_MS,
        'ListProjects'
      ).catch(async (error) => {
        diagnostics.listProjectsError = errorMessage(error);
        await progress(`ListProjects failed: ${diagnostics.listProjectsError}`);
        return [] as CatalogProject[];
      }),
      this.sweepListings(selected, diagnostics, progress),
      this.describeCaller(diagnostics),
    ]);
    diagnostics.fromListProjects = listed.length;
    diagnostics.listings = listings.length;
    describeSchemas(listings, diagnostics);
    const publishers = [
      ...new Set(listings.map((l) => l.owningProjectId).filter(Boolean)),
    ] as string[];
    diagnostics.publishers = publishers.length;
    await progress('Swept the domain', {
      fromListProjects: listed.length,
      listings: listings.length,
      publishers: publishers.length,
      listingsWithColumns: diagnostics.listingsWithColumns,
      formNames: diagnostics.formNames,
      roleArn: diagnostics.roleArn,
      profileStatus: diagnostics.profileStatus,
    });

    // ListProjects is member-scoped, so a service role often sees nothing;
    // the projects that published something are the ones that matter anyway.
    const byId = new Map(listed.map((p) => [p.id, p]));
    const unnamed = [...new Set([...selected, ...publishers])].filter((id) => !byId.has(id));
    const fetched = await Promise.all(
      unnamed.map((id) => this.dataZoneAdapter.getProject(domainId, id))
    );
    unnamed.forEach((id, i) => {
      byId.set(id, fetched[i] ?? { id, name: id });
    });
    const projects = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));

    const snapshot: SmusSnapshot = {
      version: SMUS_SNAPSHOT_VERSION,
      domainId,
      region,
      exportedAt: new Date().toISOString(),
      jobId,
      projectFilter: selected,
      projects,
      listings,
      diagnostics,
    };
    await this.cacheService.put(SMUS_SNAPSHOT_KEY, snapshot, { compact: true });
    logger.info('SMUS snapshot written', {
      projects: projects.length,
      listings: listings.length,
      publishers: publishers.length,
      jobId,
    });
    await progress(`Wrote the snapshot: ${projects.length} projects, ${listings.length} listings`);
    return snapshot;
  }

  /**
   * Listings for the selected projects, one filtered search each; the whole
   * domain when nothing is selected. If DataZone refuses the owning-project
   * filter, sweep the domain once and keep only the selected projects, so
   * the snapshot never holds more than what was asked for.
   */
  private async sweepListings(
    selected: string[],
    diagnostics: SmusExportDiagnostics,
    progress: SmusExportProgress
  ): Promise<CatalogListing[]> {
    const { domainId } = this.config;
    const sweepAll = () =>
      withTimeout(
        this.dataZoneAdapter.listAllListings(domainId),
        SWEEP_CALL_TIMEOUT_MS,
        'SearchListings'
      );
    try {
      if (selected.length === 0) {
        return await sweepAll();
      }
      try {
        const perProject = await Promise.all(
          selected.map((projectId) =>
            withTimeout(
              this.dataZoneAdapter.listAllListings(domainId, projectId),
              SWEEP_CALL_TIMEOUT_MS,
              `SearchListings(${projectId})`
            )
          )
        );
        return perProject.flat();
      } catch (error) {
        diagnostics.listingsFallback = errorMessage(error);
        await progress(
          'Filtered listing search was refused; sweeping the domain and keeping the selected projects',
          { error: diagnostics.listingsFallback }
        );
        const all = await sweepAll();
        const keep = new Set(selected);
        return all.filter((l) => l.owningProjectId && keep.has(l.owningProjectId));
      }
    } catch (error) {
      diagnostics.listingsError = errorMessage(error);
      await progress(`SearchListings failed: ${diagnostics.listingsError}`);
      return [];
    }
  }

  /** Name the principal DataZone saw and whether the domain knows it. */
  private async describeCaller(diagnostics: SmusExportDiagnostics): Promise<void> {
    if (!this.stsAdapter) {
      return;
    }
    try {
      const identity = await withTimeout(
        this.stsAdapter.getCallerIdentity(),
        CALLER_LOOKUP_TIMEOUT_MS,
        'GetCallerIdentity'
      );
      diagnostics.callerArn = identity.arn;
      diagnostics.roleArn = roleArnFromCaller(identity.arn);
      const profile = await withTimeout(
        this.dataZoneAdapter.getIamRoleProfile(this.config.domainId, diagnostics.roleArn),
        CALLER_LOOKUP_TIMEOUT_MS,
        'GetUserProfile'
      );
      diagnostics.profileStatus = profile?.status ?? 'not found';
    } catch (error) {
      logger.warn('Could not describe the caller for SMUS diagnostics', { error });
    }
  }
}
