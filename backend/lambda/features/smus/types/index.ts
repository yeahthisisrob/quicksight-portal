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
