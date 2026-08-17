import { components } from '@shared/generated/types';

import { api } from '../client';
import { ApiResponse } from '../types';

export type SmusStatus = components['schemas']['SmusStatus'];
export type SmusDatasetLink = components['schemas']['SmusDatasetLink'];

/**
 * SMUS (SageMaker Unified Studio) integration API. Link resolutions are
 * computed live against the SMUS domain catalog on the backend — nothing is
 * persisted in the portal cache.
 */
export const smusApi = {
  /** Whether a SMUS domain is configured (drives all SMUS UI visibility). */
  async getStatus(): Promise<SmusStatus> {
    const response = await api.get<ApiResponse<SmusStatus>>('/smus/status');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch SMUS status');
    }
    return response.data.data;
  },

  /** Resolve SMUS catalog links for the given datasets (all when omitted). */
  async getDatasetLinks(datasetIds?: string[]): Promise<SmusDatasetLink[]> {
    const response = await api.post<ApiResponse<{ links: SmusDatasetLink[] }>>(
      '/smus/dataset-links',
      { datasetIds }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to resolve SMUS dataset links');
    }
    return response.data.data.links;
  },
};
