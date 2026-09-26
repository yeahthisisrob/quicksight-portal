export type { AssetSummary } from '../../../shared/models/quicksight-domain.model';
// Re-export AssetType for convenience
export type { AssetType } from '../../../shared/types/assetTypes';

interface RefreshOptions {
  definitions: boolean;
  permissions: boolean;
  tags: boolean;
}

export interface ProcessingContext {
  forceRefresh: boolean;
  refreshOptions?: RefreshOptions;
  sessionId?: string;
  batchSize?: number;
  delayMs?: number;
  bulkPermissions?: any[];
  bulkTags?: Record<string, string>;
}
