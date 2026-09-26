import type { SmusSnapshotSummary } from '../../../shared/services/smus/SmusSnapshot';

/**
 * How a QuickSight dataset was matched to a SMUS catalog listing, in
 * descending confidence: a relational source table (schema.table from the
 * physical table map), a db.table reference parsed from custom SQL, the
 * dataset's display name, or — last — a parent dataset that matched, for a
 * dataset built on another one and so carrying no table identity itself.
 */
export type SmusMatchType = 'source-table' | 'custom-sql' | 'name' | 'lineage';

/** The parent a `lineage` match came through. */
export interface SmusLinkVia {
  datasetId: string;
  name?: string;
}

/** SMUS integration status exposed to the frontend. */
export interface SmusStatus {
  configured: boolean;
  domainId?: string;
  region?: string;
  portalUrl?: string;
  /** The last SMUS export; absent when none has run. */
  snapshot?: SmusSnapshotSummary;
}

/** Link resolution for one QuickSight dataset against the SMUS catalog. */
export interface SmusDatasetLink {
  datasetId: string;
  linked: boolean;
  matchType?: SmusMatchType;
  listingId?: string;
  assetId?: string;
  listingName?: string;
  url?: string;
  /** Set on a `lineage` match: the parent dataset the listing came from. */
  via?: SmusLinkVia;
}

/** One published listing with what the portal knows about it. */
export interface SmusAsset {
  listingId: string;
  assetId: string;
  name: string;
  assetType: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  url?: string;
  table?: { catalog?: string; database: string; name: string };
  columns?: Array<{ name: string; type: string; description?: string }>;
  glossaryTerms: Array<{ name: string; shortDescription?: string }>;
  forms: Array<{ name: string; fields: Array<{ key: string; value: string }> }>;
  createdAt?: string;
  /** QuickSight datasets the portal matched to this listing. */
  datasets: Array<{ id: string; name: string; matchType: SmusMatchType; via?: SmusLinkVia }>;
}

export interface SmusAssetsResult {
  configured: boolean;
  /** Project ids the sweep was limited to; empty means all. */
  projectFilter: string[];
  assets: SmusAsset[];
  /** When the snapshot was taken; null when no SMUS export has run. */
  exportedAt: string | null;
}

export interface CreateSmusDatasetRequest {
  /** Omitted: the Athena data source the SMUS-linked datasets already use most. */
  dataSourceId?: string;
  name?: string;
  /** Defaults to DIRECT_QUERY. */
  importMode?: 'DIRECT_QUERY' | 'SPICE';
  permissionsFromDataSetId?: string;
}

/** The Athena data source SMUS tables are read through, and how it was chosen. */
export interface SmusDataSourceChoice {
  dataSource: { id: string; name: string; arn: string; usedBy: number; reason: string } | null;
  /** Every Athena data source, with how many governed datasets read through it. */
  athena: Array<{ id: string; name: string; usedBy: number }>;
}
