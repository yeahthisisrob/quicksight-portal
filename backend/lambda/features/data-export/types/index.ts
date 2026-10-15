export type { AssetSummary } from '../../../shared/models/quicksight-domain.model';
// Re-export AssetType for convenience
export type { AssetType } from '../../../shared/types/assetTypes';

interface RefreshOptions {
  definitions: boolean;
  permissions: boolean;
  tags: boolean;
}

import type { VersionProvenance } from '../../../shared/services/history/AssetHistory';

export interface ProcessingContext {
  forceRefresh: boolean;
  /** Who changed the asset and what they changed, when the portal just wrote it: the version kept says so. */
  provenance?: VersionProvenance;
  refreshOptions?: RefreshOptions;
  sessionId?: string;
  batchSize?: number;
  delayMs?: number;
  bulkPermissions?: any[];
  bulkTags?: Record<string, string>;
}
