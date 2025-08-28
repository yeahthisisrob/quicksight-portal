/**
 * Shared types for export summaries and asset statistics
 */

export interface AssetTypeCounts {
  dashboards: number;
  datasets: number;
  analyses: number;
  datasources: number;
  folders: number;
  users: number;
  groups: number;
}

export interface FieldStatistics {
  totalFields: number;
  totalCalculatedFields: number;
  totalUniqueFields: number;
}

export interface ExportSummary {
  totalAssets: number;
  exportedAssets: number;
  lastExportDate: string | null;
  exportInProgress: boolean;
  needsInitialExport: boolean;
  assetTypeCounts: AssetTypeCounts;
  archivedAssetCounts: AssetTypeCounts & { total: number };
  fieldStatistics: FieldStatistics | null;
  cacheVersion: number;
  message: string;
}
