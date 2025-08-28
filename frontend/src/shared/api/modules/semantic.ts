import { api as apiClient } from '../client';

/**
 * Semantic Layer API - handles business terms, categories, and field mappings
 */
export const semanticApi = {
  // Terms
  getTerms: (params?: { search?: string; category?: string }) => 
    apiClient.get('/semantic/terms', { params }).then(res => res.data),
  getTerm: (termId: string) => 
    apiClient.get(`/semantic/terms/${termId}`).then(res => res.data),
  createTerm: (term: any) => 
    apiClient.post('/semantic/terms', term).then(res => res.data),
  updateTerm: (termId: string, updates: any) => 
    apiClient.put(`/semantic/terms/${termId}`, updates).then(res => res.data),
  deleteTerm: (termId: string) => 
    apiClient.delete(`/semantic/terms/${termId}`).then(res => res.data),
    
  // Categories
  getCategories: () => 
    apiClient.get('/semantic/categories').then(res => res.data),
  createCategory: (category: any) => 
    apiClient.post('/semantic/categories', category).then(res => res.data),
    
  // Mappings
  getMappings: (params?: { fieldId?: string; status?: string; type?: string }) => 
    apiClient.get('/semantic/mappings', { params }).then(res => res.data),
  getFieldMapping: (fieldId: string) => 
    apiClient.get(`/semantic/mappings/field/${fieldId}`).then(res => res.data),
  createMapping: (mapping: any) => 
    apiClient.post('/semantic/mappings', mapping).then(res => res.data),
  approveMapping: (mappingId: string) => 
    apiClient.post(`/semantic/mappings/${mappingId}/approve`).then(res => res.data),
  rejectMapping: (mappingId: string, reason?: string) => 
    apiClient.post(`/semantic/mappings/${mappingId}/reject`, { reason }).then(res => res.data),
  suggestMappings: (field: any) => 
    apiClient.post('/semantic/mappings/suggest', field).then(res => res.data),
  deleteMapping: (mappingId: string) => 
    apiClient.delete(`/semantic/mappings/${mappingId}`).then(res => res.data),
    
  // Unmapped fields
  getUnmappedFields: () => 
    apiClient.get('/semantic/unmapped').then(res => res.data),
    
  // Stats
  getStats: () => 
    apiClient.get('/semantic/stats').then(res => res.data),
    
  // Import/Export
  importTerms: (terms: any[]) => 
    apiClient.post('/semantic/terms/import', { terms }).then(res => res.data),
  exportTerms: () => 
    apiClient.get('/semantic/terms/export').then(res => res.data),
};