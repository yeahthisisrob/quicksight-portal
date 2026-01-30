import type { AssetSource } from '@/shared/ui/DataGrid/cells';

/**
 * Asset reference for FieldUsageBadges (requires assetName)
 */
export interface AssetReference {
  assetType: 'dataset' | 'analysis' | 'dashboard';
  assetId: string;
  assetName: string;
  datasetId?: string;
  datasetName?: string;
  datasourceType?: string;
  importMode?: 'SPICE' | 'DIRECT_QUERY';
}

/**
 * Base interface for all field rows in the data catalog
 */
export interface BaseFieldRow {
  id: string;
  fieldName: string;
  dataType?: string;
  isCalculated?: boolean;
  hasVariants?: boolean;
  usageCount?: number;
}

/**
 * Data type variant information
 */
export interface DataTypeVariant {
  dataType: string;
  count: number;
}

/**
 * Physical field row for the physical columns view
 */
export interface PhysicalFieldRow extends BaseFieldRow {
  variants?: DataTypeVariant[];
  expressions?: string[];
}

/**
 * Calculated field row for the calculated columns view
 */
export interface CalculatedFieldRow extends BaseFieldRow {
  expression: string;
  expressionLength?: number;
  hasComments?: boolean;
  sources?: AssetSource[];
  fieldReferences?: string[];
  expressions?: string[];
}

/**
 * Visual field row for the visual field columns view
 */
export interface VisualFieldRow extends BaseFieldRow {
  fieldType?: 'CALCULATED_FIELD' | 'DIMENSION' | 'MEASURE';
  datasetName?: string;
  visualsCount?: number;
  visualTypes?: string[];
  sources?: AssetReference[];
  dashboardsCount?: number;
  analysesCount?: number;
}

/**
 * Semantic term row for the semantic columns view
 */
export interface SemanticTermRow {
  id: string;
  businessName: string;
  description?: string;
  mappedFieldsCount?: number;
  businessUsageCount?: number;
  businessDatasetsCount?: number;
  businessAnalysesCount?: number;
  businessDashboardsCount?: number;
  hasCalculatedFields?: boolean;
  hasVariants?: boolean;
  variantFields?: Array<{ fieldName: string; dataType: string }>;
  source?: string;
}

/**
 * Mapping row for the mapping columns view
 */
export interface MappingRow {
  id: string;
  fieldName: string;
  termName: string;
  confidence: number;
  method: 'manual' | 'auto' | 'suggested';
  dataType?: string;
  datasetsCount?: number;
  analysesCount?: number;
}

/**
 * Typed callback for field operations
 */
export type FieldCallback<T> = (field: T) => void;

/**
 * Callback props for physical columns
 */
export interface PhysicalColumnsCallbacks {
  onShowDetails: FieldCallback<PhysicalFieldRow>;
  onShowVariants: FieldCallback<PhysicalFieldRow>;
  onMapField?: FieldCallback<PhysicalFieldRow>;
  onShowAssets?: (
    field: PhysicalFieldRow,
    assetType: string,
    assets: AssetSource[]
  ) => void;
}

/**
 * Callback props for calculated columns
 */
export interface CalculatedColumnsCallbacks {
  onShowExpression: FieldCallback<CalculatedFieldRow>;
  onShowDetails: FieldCallback<CalculatedFieldRow>;
  onShowVariants: FieldCallback<CalculatedFieldRow>;
}

/**
 * Callback props for visual field columns
 */
export interface VisualFieldColumnsCallbacks {
  onShowDetails: FieldCallback<VisualFieldRow>;
}

/**
 * Callback props for semantic columns
 */
export interface SemanticColumnsCallbacks {
  onEditTerm: FieldCallback<SemanticTermRow>;
  onDeleteTerm: FieldCallback<SemanticTermRow>;
  onShowMappedFields: FieldCallback<SemanticTermRow>;
}

/**
 * Callback props for mapping columns
 */
export interface MappingColumnsCallbacks {
  onEditMapping: FieldCallback<MappingRow>;
  onDeleteMapping: FieldCallback<MappingRow>;
}
