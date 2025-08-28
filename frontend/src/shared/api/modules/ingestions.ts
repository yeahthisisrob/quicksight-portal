import { api } from '../client';

import type { components } from '@shared/generated/types';

export const ingestionsApi = {
  /**
   * List ingestions with pagination and filtering
   */
  list: async (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<components['schemas']['IngestionListResponse']['data']> => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.pageSize) queryParams.append('pageSize', params.pageSize.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.append('sortOrder', params.sortOrder);

    const query = queryParams.toString();
    const url = `/ingestions${query ? `?${query}` : ''}`;
    
    const response = await api.get<components['schemas']['IngestionListResponse']>(url);
    return response.data.data;
  },

  /**
   * Get ingestion details
   */
  getDetails: async (datasetId: string, ingestionId: string): Promise<components['schemas']['Ingestion']> => {
    const response = await api.get<{ success: boolean; data: components['schemas']['Ingestion'] }>(
      `/ingestions/${datasetId}/${ingestionId}`
    );
    return response.data.data;
  },

  /**
   * Cancel an ingestion
   */
  cancel: async (datasetId: string, ingestionId: string): Promise<void> => {
    await api.delete(`/ingestions/${datasetId}/${ingestionId}`);
  },
};