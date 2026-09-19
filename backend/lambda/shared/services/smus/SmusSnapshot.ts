/**
 * The SMUS snapshot: everything the portal knows about the SageMaker Unified
 * Studio domain, written once by the SMUS export job and read by Settings,
 * Author and the catalog. Nothing SMUS-facing calls DataZone at request time.
 *
 * Stored as one object in the cache bucket (memory-first reads with ETag
 * revalidation, like the ingestions cache). Its size grows with listings x
 * columns x forms, which is why it is not a DynamoDB item.
 */
import type { CatalogListing, CatalogProject } from '../../../adapters/aws/DataZoneAdapter';

export const SMUS_SNAPSHOT_KEY = 'cache/smus/snapshot.json';
export const SMUS_SNAPSHOT_VERSION = 1;

/** How the export found what it found, so an empty picker can say why. */
export interface SmusExportDiagnostics {
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
  /** Set when the filtered listing search was refused and the domain was swept instead. */
  listingsFallback?: string;
  /** Listings whose forms named a Glue table. */
  listingsWithTable?: number;
  /** Listings whose forms carried a column list: without these there is no tie-back. */
  listingsWithColumns?: number;
  /** The metadata forms seen, so a listing without columns says what it did publish. */
  formNames?: string[];
}

export interface SmusSnapshot {
  version: number;
  domainId: string;
  region: string;
  exportedAt: string;
  jobId?: string;
  /** The project ids the listings were limited to; empty means the whole domain. */
  projectFilter: string[];
  projects: CatalogProject[];
  listings: CatalogListing[];
  diagnostics: SmusExportDiagnostics;
}

export interface SmusSnapshotSummary {
  exportedAt: string;
  projectFilter: string[];
  domainId?: string;
  region?: string;
  projects: number;
  listings: number;
  publishers: number;
  jobId?: string;
  diagnostics?: SmusExportDiagnostics;
}

export function summarizeSnapshot(snapshot: SmusSnapshot): SmusSnapshotSummary {
  return {
    exportedAt: snapshot.exportedAt,
    projectFilter: snapshot.projectFilter ?? [],
    domainId: snapshot.domainId,
    region: snapshot.region,
    projects: snapshot.projects.length,
    listings: snapshot.listings.length,
    publishers: new Set(snapshot.listings.map((l) => l.owningProjectId).filter(Boolean)).size,
    jobId: snapshot.jobId,
    diagnostics: snapshot.diagnostics,
  };
}

/** A snapshot taken for another domain is not this domain's data. */
export function snapshotMatches(
  snapshot: SmusSnapshot | null,
  domainId: string
): snapshot is SmusSnapshot {
  return (
    snapshot !== null &&
    snapshot.version === SMUS_SNAPSHOT_VERSION &&
    snapshot.domainId === domainId
  );
}
