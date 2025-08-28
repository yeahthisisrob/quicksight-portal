export interface Column {
  name: string;
  dataType: string;
  description?: string;
  tags?: string[];
}

export interface Table {
  name: string;
  schema: string;
  database: string;
  columns: Column[];
  description?: string;
  tags?: string[];
}

export interface FieldTag {
  datasetId: string;
  fieldName: string;
  tags: string[];
}

export interface SemanticType {
  id: string;
  name: string;
  description?: string;
  rules: any[];
}

// Data catalog types - moved from old services
export interface CatalogField {
  fieldId: string;
  fieldName: string;
  dataType: string;
  description: string;
  isCalculated: boolean;
  sourceAssetType: string;
  sourceAssetId: string;
  sourceAssetName: string;
  datasetId?: string;
  datasetName?: string;
  columnName?: string | null;
  expression?: string | null;
  expressions?: Array<{
    expression: string;
    sources: Array<{
      assetType: string;
      assetId: string;
      assetName: string;
      datasetId?: string;
      datasetName?: string;
      lastUpdated?: string;
      dataType?: string;
    }>;
  }>;
  dependencies: string[];
  lastUpdated: string;
  sources?: Array<{
    assetType: string;
    assetId: string;
    assetName: string;
    dataType?: string;
    lastUpdated?: string;
  }>;
  variants?: any[];
  hasVariants?: boolean;
  // Pre-computed aggregation fields for performance
  usageCount?: number;
  analysisCount?: number;
  dashboardCount?: number;
  lastModified?: string;
}

export interface VisualFieldName {
  fieldId: string;
  visualId: string;
  visualName: string;
  sheetId: string;
  sheetName: string;
  dashboardId: string;
  dashboardName: string;
  fieldName: string;
  dataType: string;
  isCalculated: boolean;
  lastUpdated: string;
}

export interface DataCatalogResult {
  fields: CatalogField[];
  calculatedFields: CatalogField[];
  summary: {
    totalFields: number;
    distinctFields: number;
    totalCalculatedFields: number;
    calculatedDatasetFields: number;
    calculatedAnalysisFields: number;
    visualFields: number;
    fieldsByDataType?: Record<string, number>;
    lastUpdated: Date;
    processingTimeMs: number;
  };
}

export interface VisualFieldCatalogResult {
  visualFields: VisualFieldName[];
  summary: {
    totalVisualFields: number;
    totalVisuals: number;
    totalSheets: number;
    totalDashboards: number;
    lastUpdated: Date;
    processingTimeMs: number;
  };
}

export interface FieldMetadataEntry {
  description?: string;
  businessGlossary?: string;
  tags?: string[];
  category?: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  lastUpdated?: string;
  updatedBy?: string;
}

export interface BulkFieldMetadata {
  version: string;
  lastUpdated: string;
  totalFields: number;
  fields: Record<string, FieldMetadataEntry>;
}

export interface CatalogResponse {
  fields: CatalogField[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}
