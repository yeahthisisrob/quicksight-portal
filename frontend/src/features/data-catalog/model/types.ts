/**
 * Data Catalog domain types
 */

export type DataCatalogViewMode = 'physical' | 'semantic' | 'mapping' | 'visual-fields' | 'calculated';

export interface DataCatalogSummary {
  totalFields: number;
  distinctFields: number;
  visualFields: number;
  totalCalculatedFields: number;
  calculatedDatasetFields: number;
  calculatedAnalysisFields: number;
  fieldsWithVariants: number;
  fieldsWithComments: number;
  avgExpressionLength: number;
  fieldsByDataType: Record<string, number>;
}

export interface VisualFieldSummary {
  totalFields: number;
  mappingsByAssetType?: {
    dashboards: number;
    analyses: number;
  };
  mappingsByVisualType?: Record<string, number>;
}

export interface SemanticStats {
  totalTerms: number;
  mappedFields: number;
  unmappedFields: number;
  coverage: number;
}

export interface DataCatalogStatsProps {
  viewMode: DataCatalogViewMode;
  stats?: SemanticStats;
  catalogSummary?: DataCatalogSummary;
  visualFieldSummary?: VisualFieldSummary;
}

export interface StatCardData {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

export type DataType = 'STRING' | 'INTEGER' | 'DECIMAL' | 'DATETIME' | 'BOOLEAN' | 'Unknown';