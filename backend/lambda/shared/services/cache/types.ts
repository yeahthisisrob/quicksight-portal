import type { AssetType } from '../../types/assetTypes';

// Legacy field and lineage types (keeping as-is for now)
/** One visual that reads a field, recorded at export time from the definition. */
export interface FieldVisualRef {
  visualId: string;
  visualType: string;
  /** The visual's title when it has one; the catalog falls back to the id. */
  title?: string;
  sheetId: string;
  sheetName?: string;
}

export interface FieldInfo {
  fieldId: string;
  fieldName: string;
  displayName?: string;
  dataType: string;
  description?: string;
  isCalculated: boolean;
  expression?: string;
  sourceAssetType: AssetType;
  sourceAssetId: string;
  sourceAssetName: string;
  datasetId?: string;
  datasetName?: string;
  columnName?: string;
  dependencies?: string[];
  usageCount: number;
  analysisCount: number;
  dashboardCount: number;
  lastUpdated: string;
  tags?: Array<{ key: string; value: string }>;
  /** Dashboards and analyses only: the visuals that read this field. */
  visuals?: FieldVisualRef[];
}
