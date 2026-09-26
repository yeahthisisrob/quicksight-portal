import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';

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
    return unwrap(
      await client.GET('/api/search', {
        params: {
          query: {
            q,
            ...(options.types?.length ? { types: options.types.join(',') } : {}),
            ...(options.limit ? { limit: options.limit } : {}),
          },
        },
      }),
      'Search failed'
    );
  },
};
