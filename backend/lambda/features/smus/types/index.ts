/**
 * How a QuickSight dataset was matched to a SMUS catalog listing, in
 * descending confidence: a relational source table (schema.table from the
 * physical table map), a db.table reference parsed from custom SQL, or the
 * dataset's display name.
 */
export type SmusMatchType = 'source-table' | 'custom-sql' | 'name';

/** SMUS integration status exposed to the frontend. */
export interface SmusStatus {
  configured: boolean;
  domainId?: string;
  portalUrl?: string;
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
  datasets: Array<{ id: string; name: string; matchType: SmusMatchType }>;
}

export interface SmusAssetsResult {
  configured: boolean;
  /** Project ids the sweep was limited to; empty means all. */
  projectFilter: string[];
  assets: SmusAsset[];
}

export interface CreateSmusDatasetRequest {
  dataSourceId: string;
  name?: string;
  importMode: 'DIRECT_QUERY' | 'SPICE';
  permissionsFromDataSetId?: string;
}
