import { type AssetType } from '../../types/assetTypes';

export interface CacheSearchOptions {
  query?: string;
  types?: string[];
  status?: string[];
  tags?: string[];
  owners?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CacheUpdateEvent {
  eventType: 'asset_added' | 'asset_updated' | 'asset_deleted' | 'asset_archived';
  assetType: string;
  assetId: string;
  timestamp: string;
  metadata?: any;
}

// Legacy field and lineage types (keeping as-is for now)
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
}

export interface LineageRelationship {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  targetType: string;
  targetId: string;
  targetName: string;
  relationshipType: 'uses' | 'contains' | 'derived_from';
  metadata?: {
    fieldMappings?: Array<{
      sourceField: string;
      targetField: string;
    }>;
  };
}

export interface VisualFieldMapping {
  visualId: string;
  visualType:
    | 'bar'
    | 'line'
    | 'pie'
    | 'table'
    | 'kpi'
    | 'gauge'
    | 'scatter'
    | 'heatmap'
    | 'donut'
    | 'area'
    | 'combo';
  sheetId: string;
  sheetName: string;
  assetType: AssetType;
  assetId: string;
  assetName: string;
  fieldMappings: Array<{
    role: 'category' | 'value' | 'color' | 'size' | 'tooltip' | 'filter' | 'drill_down';
    fieldId: string;
    fieldName: string;
    fieldType: 'dimension' | 'measure' | 'calculated';
    datasetId: string;
    datasetName: string;
    aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct_count';
    format?: string;
    sort?: 'asc' | 'desc';
  }>;
}

export interface ViewStats {
  uniqueViews: number;
  totalViews: number;
  averageViewDuration: number;
  topViewers: Array<{
    userName: string;
    viewCount: number;
  }>;
  viewsByDate: Array<{
    date: string;
    views: number;
  }>;
}
