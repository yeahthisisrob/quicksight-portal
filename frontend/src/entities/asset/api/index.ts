import { api } from '@/shared/api';

import type { AssetType } from '../model';

export const assetApi = {
  // Get list of assets by type
  list: (type: AssetType) => 
    api.get(`/assets/${type}`),

  // Get asset details
  getById: (type: AssetType, id: string) => 
    api.get(`/assets/${type}/${id}`),

  // Get asset metadata from S3
  getMetadata: (type: AssetType, id: string) => 
    api.get(`/assets/${type}/${id}/metadata`),

  // Update asset metadata
  updateMetadata: (type: AssetType, id: string, metadata: any) => 
    api.put(`/assets/${type}/${id}/metadata`, metadata),

  // Get related assets
  getRelatedAssets: (type: AssetType, id: string) => 
    api.get(`/assets/${type}/${id}/related`),

  // Search assets across all types
  search: (query: string, types?: AssetType[]) => 
    api.get('/assets/search', { 
      params: { q: query, types: types?.join(',') } 
    }),
};