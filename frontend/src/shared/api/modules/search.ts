import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';

type Schemas = components['schemas'];

export type SearchableType = Schemas['SearchableType'];
export type SearchHit = Schemas['SearchHit'];
type SearchResponse = Schemas['SearchResponse'];

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

export type ContextRelated = Schemas['ContextRelatedResponse'];
export type ContextHit = ContextRelated['hits'][number];

/**
 * The context graph: what an asset reads, what reads it, what it defines.
 * Entity ids are `<type>:<id>` (`dataset:orders`).
 */
export const contextApi = {
  async related(
    entityId: string,
    options: {
      relations?: string[];
      direction?: 'out' | 'in' | 'both';
      depth?: number;
      types?: string[];
      limit?: number;
    } = {}
  ): Promise<ContextRelated> {
    return unwrap(
      await client.GET('/api/context/entities/{entityId}/related', {
        params: {
          path: { entityId },
          query: {
            ...(options.relations?.length ? { relations: options.relations.join(',') } : {}),
            ...(options.direction ? { direction: options.direction } : {}),
            ...(options.depth ? { depth: options.depth } : {}),
            ...(options.types?.length ? { types: options.types.join(',') } : {}),
            ...(options.limit ? { limit: options.limit } : {}),
          },
        },
      }),
      'Could not read what it is connected to'
    );
  },
};
