import type { components } from '@shared/generated/types';

import { api as apiClient } from '../client';
import type { ApiResponse } from '../types';

type Schemas = components['schemas'];

export type SearchableType = Schemas['SearchableType'];
export type SearchHit = Schemas['SearchHit'];
export type SearchResponse = Schemas['SearchResponse'];
export type SearchAssetRef = Schemas['SearchAssetRef'];

/** One ranked search over everything the portal knows, in plain words. */
export const searchApi = {
  async search(
    q: string,
    options: { types?: SearchableType[]; limit?: number } = {}
  ): Promise<SearchResponse> {
    const response = await apiClient.get<ApiResponse<SearchResponse>>('/search', {
      params: {
        q,
        types: options.types?.length ? options.types.join(',') : undefined,
        limit: options.limit,
      },
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Search failed');
    }
    return response.data.data;
  },
};
