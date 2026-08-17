/** How a QuickSight dataset was matched to a SMUS catalog listing. */
export type SmusMatchType = 'name' | 'source-table';

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
