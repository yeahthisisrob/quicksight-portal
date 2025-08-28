import { api } from '@/shared/api';
// Types are available for future use

export const fieldApi = {
  // Get all fields from data catalog
  getCatalog: () => 
    api.get('/data-catalog'),

  // Get field details
  getFieldDetails: (fieldId: string) => 
    api.get(`/data-catalog/fields/${fieldId}`),

  // Get field usage across assets
  getFieldUsage: (fieldId: string) => 
    api.get(`/data-catalog/fields/${fieldId}/usage`),

  // Get calculated fields
  getCalculatedFields: () => 
    api.get('/data-catalog/calculated-fields'),

  // Get visual fields for an asset
  getVisualFields: (assetType: 'dashboard' | 'analysis', assetId: string) => 
    api.get(`/assets/${assetType}/${assetId}/visual-fields`),

  // Search fields
  searchFields: (query: string, options?: { includeCalculated?: boolean }) => 
    api.get('/data-catalog/search', { params: { q: query, ...options } }),

  // Rebuild catalog
  rebuildCatalog: () => 
    api.post('/data-catalog/rebuild'),
};