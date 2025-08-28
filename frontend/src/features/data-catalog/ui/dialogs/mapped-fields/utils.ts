/**
 * Utility functions for mapped fields dialog
 */

/**
 * Process mappings for a term
 */
export function processMappings(mappings: any[], termId: string) {
  const termMappings = mappings.filter(m => m.termId === termId && m.status === 'active');
  
  const physicalFieldMappings = termMappings.filter(
    m => m.fieldId && !m.fieldId.startsWith('visual-field:')
  );
  
  const visualFieldMappings = termMappings.filter(
    m => m.fieldId && m.fieldId.startsWith('visual-field:')
  );
  
  return { physicalFieldMappings, visualFieldMappings };
}

/**
 * Get field ID from field data
 */
export function getFieldId(field: any): string {
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
 * Map physical fields to mappings
 */
export function mapPhysicalFields(mappings: any[], fields: any[]) {
  return mappings.map(mapping => {
    const field = fields.find(f => getFieldId(f) === mapping.fieldId);
    return { ...mapping, field };
  });
}

/**
 * Map visual fields to mappings
 */
export function mapVisualFields(mappings: any[], visualFields: any[]) {
  return mappings.map(mapping => {
    const field = visualFields.find(vf => 
      vf.visualFieldId === mapping.fieldId || 
      `visual-field:${vf.displayName}` === mapping.fieldId
    );
    return { ...mapping, field };
  });
}

/**
 * Filter mappings by search term
 */
export function filterMappingsBySearch(mappings: any[], searchTerm: string) {
  if (!searchTerm) return mappings;
  
  const lowerSearch = searchTerm.toLowerCase();
  
  return mappings.filter(item =>
    item.field?.fieldName?.toLowerCase().includes(lowerSearch) ||
    item.field?.displayName?.toLowerCase().includes(lowerSearch) ||
    item.field?.sources?.[0]?.assetName?.toLowerCase().includes(lowerSearch)
  );
}