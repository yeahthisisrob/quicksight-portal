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
  datasetCount?: number;
  lastModified?: string;
  // Calculated-field analysis (computed at index build time)
  expressionLength?: number;
  hasComments?: boolean;
  fieldReferences?: string[];
  hasExpressionConflict?: boolean;
  conflictCount?: number;
  /** Names of calculated fields that reference this field (reverse lineage). */
  usedBy?: string[];
}

/**
 * Which source asset types contribute to the catalog view.
 * Datasets are always present (they are the field-definition layer); dashboards
 * are the business-facing layer (default); analyses are the authoring layer (opt-in).
 */
export interface CatalogSourceScope {
  includeAnalyses: boolean;
}

/**
 * A single occurrence of a field within one source asset, captured at index
 * build time. The serve layer filters these by scope and re-aggregates.
 */
export interface IndexedFieldSource {
  assetType: string;
  assetId: string;
  assetName: string;
  datasetId?: string;
  datasetName?: string;
  dataType: string;
  lastUpdated: string;
  isCalculated: boolean;
  expression?: string;
  // Baked per-source expression analysis (calculated sources only)
  expressionLength?: number;
  hasComments?: boolean;
  fieldReferences?: string[];
}

/**
 * One distinct field name with all its per-source occurrences and asset tags.
 */
export interface IndexedCatalogField {
  fieldName: string;
  description?: string;
  tags?: Array<{ key: string; value: string }>;
  perSource: IndexedFieldSource[];
}

/**
 * Pre-computed, indexed catalog artifact persisted to S3 (catalog/catalog-index.json).
 * Heavy work (grouping, expression parsing, reverse lineage) is baked in here so
 * serving a page is a cheap scope-filter + re-aggregation.
 */
export interface CatalogIndex {
  version: string;
  builtAt: string;
  fields: IndexedCatalogField[];
  /** fieldName -> calculated field names that reference it. */
  lineage: Record<string, string[]>;
  summary: {
    totalDistinctFields: number;
    builtFromFieldCount: number;
  };
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
    fieldsWithVariants?: number;
    fieldsWithComments?: number;
    fieldsWithConflicts?: number;
    avgExpressionLength?: number;
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
