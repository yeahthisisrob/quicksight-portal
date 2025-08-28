// Field entity types

export interface BaseField {
  fieldId: string;
  fieldName: string;
  dataType?: string;
  semanticType?: string;
  description?: string;
  tags?: FieldTag[];
}

export interface PhysicalField extends BaseField {
  isCalculated: false;
  sources: FieldSource[];
  lineage?: FieldLineage;
  usageCount?: number;
  hasVariants?: boolean;
  variants?: DataTypeVariant[];
}

export interface CalculatedField extends BaseField {
  isCalculated: true;
  expression: string;
  expressions?: ExpressionVariant[];
  hasVariants?: boolean;
  hasComments?: boolean;
  fieldReferences?: string[];
  sources: FieldSource[];
  lineage?: FieldLineage;
  usageCount?: number;
}

export interface VisualField {
  visualFieldId: string;
  fieldName: string;
  displayName: string;
  visualId: string;
  visualType: string;
  sheetId: string;
  sheetName: string;
  assetType: 'dashboard' | 'analysis';
  assetId: string;
  assetName: string;
  dataSetIdentifier?: string;
  fieldRole?: string;
  axisLabel?: string;
  customMetadata?: FieldMetadata;
}

export interface FieldSource {
  assetType: 'dataset' | 'analysis' | 'dashboard';
  assetId: string;
  assetName: string;
  datasetId?: string;
  datasetName?: string;
  datasourceType?: string;
  importMode?: 'SPICE' | 'DIRECT_QUERY';
  lastModified?: Date;
  usedInVisuals?: boolean;
  usedInCalculatedFields?: boolean;
  dataType?: string;
}

export interface FieldLineage {
  datasetId?: string;
  datasetName?: string;
  datasourceType?: string;
  importMode?: 'SPICE' | 'DIRECT_QUERY';
  analysisIds?: string[];
  dashboardIds?: string[];
}

export interface DataTypeVariant {
  dataType: string;
  count: number;
  sources: Array<{
    assetType: string;
    assetId: string;
    assetName: string;
  }>;
}

export interface ExpressionVariant {
  expression: string;
  sources: FieldSource[];
}

export interface FieldMetadata {
  tags: FieldTag[];
  description: string;
  businessGlossary: string;
  semanticTermId?: string;
  dataQuality?: string;
  dataOwner?: string;
  lastReviewed?: string;
  customAttributes?: Record<string, any>;
}

export interface FieldTag {
  key: string;
  value: string;
}

export type Field = PhysicalField | CalculatedField;

// Type guards
export const isCalculatedField = (field: Field): field is CalculatedField => field.isCalculated === true;
export const isPhysicalField = (field: Field): field is PhysicalField => field.isCalculated === false;