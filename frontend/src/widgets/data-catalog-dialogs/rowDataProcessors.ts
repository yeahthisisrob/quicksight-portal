/**
 * Row data processors for DataCatalogPage
 */

/**
 * Process physical view row data
 */
export function processPhysicalViewRows(
  catalogData: any,
  mappings: any[]
) {
  if (!catalogData?.items) return [];
  
  return catalogData.items.map((field: any, index: number) => {
    const fieldId = getFieldId(field);
    const mapping = mappings?.find((m: any) => m.fieldId === fieldId && m.status === 'active');
    const sources = field.sources || [];
    
    return {
      id: field.id || `${field.fieldName}-${index}`,
      fieldName: field.fieldName,
      dataType: field.dataType || 'Unknown',
      mapping,
      datasetsCount: countByAssetType(sources, 'dataset'),
      analysesCount: countByAssetType(sources, 'analysis'),
      dashboardsCount: countByAssetType(sources, 'dashboard'),
      sources,
      description: field.description,
      tags: field.tags || [],
      usageCount: field.usageCount || 0,
      isCalculated: field.isCalculated || false,
      hasVariants: field.hasVariants || false,
      variants: field.variants || [],
      expression: field.expression,
      expressions: field.expressions || [],
      semanticFieldId: fieldId,
    };
  });
}

/**
 * Process semantic view row data
 */
export function processSemanticViewRows(
  terms: any[],
  mappings: any[],
  visualFieldCatalog: any
) {
  if (!terms) return [];
  
  return terms.map((term: any) => {
    const termMappings = getTermMappings(mappings, term.id);
    const termUsageCount = visualFieldCatalog?.termUsageCounts?.[term.id] || 0;
    
    return {
      id: term.id,
      businessName: term.businessName,
      description: term.description,
      fieldMappingsCount: termMappings.length,
      datasetsCount: countUniqueAssets(termMappings, 'dataset'),
      analysesCount: countUniqueAssets(termMappings, 'analysis'),
      dashboardsCount: countUniqueAssets(termMappings, 'dashboard'),
      hasCalculatedFields: termMappings.some((m: any) => m.isCalculated),
      hasVariants: termMappings.some((m: any) => m.hasVariants),
      variantFields: buildVariantFields(termMappings),
      tags: term.tags || [],
      termUsageCount,
      status: term.status || 'draft',
      termMappings,
    };
  });
}

/**
 * Process calculated view row data
 */
export function processCalculatedViewRows(catalogData: any) {
  if (!catalogData?.items) return [];
  
  return catalogData.items
    .filter((field: any) => field.isCalculated)
    .map((field: any, index: number) => ({
      ...field,
      id: field.id || getFieldId(field) || `calculated-${index}`,
    }));
}

/**
 * Process visual fields view row data
 */
export function processVisualFieldsRows(
  visualFieldCatalog: any,
  terms: any[],
  mappings: any[]
) {
  if (!visualFieldCatalog?.fields) return [];
  
  return visualFieldCatalog.fields.map((field: any) => {
    const fieldMapping = mappings?.find((m: any) => 
      m.fieldId === field.visualFieldId || 
      m.fieldId === `visual-field:${field.displayName}`
    );
    
    const mappedTerm = fieldMapping ? 
      terms?.find((t: any) => t.id === fieldMapping.termId) : null;
    
    return {
      ...field,
      id: field.id || field.visualFieldId || `visual-${field.displayName}`,
      mapping: fieldMapping,
      mappedTerm,
    };
  });
}

/**
 * Helper: Get field ID
 */
function getFieldId(field: any): string {
  if (field.semanticFieldId) {
    return field.semanticFieldId;
  }
  
  if (field.sources?.[0]) {
    const source = field.sources[0];
    return `${source.assetType}:${source.assetId}:${field.fieldName}`;
  }
  
  return `unknown:unknown:${field.fieldName}`;
}

/**
 * Helper: Count sources by asset type
 */
function countByAssetType(sources: any[], assetType: string): number {
  return sources.filter((s: any) => s.assetType === assetType).length;
}

/**
 * Helper: Get term mappings
 */
function getTermMappings(mappings: any[], termId: string): any[] {
  return mappings?.filter((m: any) => m.termId === termId && m.status === 'active') || [];
}

/**
 * Helper: Count unique assets
 */
function countUniqueAssets(mappings: any[], assetType: string): number {
  const uniqueIds = new Set(
    mappings.flatMap((m: any) => 
      (m.sources || [])
        .filter((s: any) => s.assetType === assetType)
        .map((s: any) => s.assetId)
    )
  );
  return uniqueIds.size;
}

/**
 * Helper: Build variant fields
 */
function buildVariantFields(mappings: any[]): any[] {
  return mappings.reduce((acc: any[], mapping: any) => {
    const existingField = acc.find(f => f.fieldName === mapping.fieldName);
    if (!existingField) {
      acc.push({
        fieldName: mapping.fieldName,
        dataType: mapping.dataType,
        count: 1
      });
    } else {
      existingField.count++;
    }
    return acc;
  }, []);
}