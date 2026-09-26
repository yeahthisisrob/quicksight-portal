import type { paths } from '@shared/generated/types';

import { client, unwrap } from '../typed';

export type IngestionListQuery = NonNullable<
  paths['/api/ingestions']['get']['parameters']['query']
>;

/** SPICE ingestions: the refresh history, one ingestion's detail, and cancelling one. */
export const ingestionsApi = {
  async list(query: IngestionListQuery = {}) {
    return unwrap(
      await client.GET('/api/ingestions', {
        params: {
          query: { ...query, dateRange: query.dateRange === 'all' ? undefined : query.dateRange },
        },
      }),
      'Failed to list ingestions'
    );
  },

  async getDetails(datasetId: string, ingestionId: string) {
    return unwrap(
      await client.GET('/api/ingestions/{datasetId}/{ingestionId}', {
        params: { path: { datasetId, ingestionId } },
      }),
      'Failed to load the ingestion'
    );
  },

  async cancel(datasetId: string, ingestionId: string): Promise<void> {
    unwrap(
      await client.DELETE('/api/ingestions/{datasetId}/{ingestionId}', {
        params: { path: { datasetId, ingestionId } },
      }),
      'Failed to cancel the ingestion'
    );
  },
};
