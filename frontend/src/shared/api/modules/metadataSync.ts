import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';

export type MetadataSyncStatus = components['schemas']['MetadataSyncStatus'];
export type MetadataSyncReport = components['schemas']['MetadataSyncReport'];
export type MetadataSyncTableResult = components['schemas']['MetadataSyncTableResult'];
export type MetadataSyncConflict = components['schemas']['MetadataSyncConflict'];
export type MetadataSyncSideResult = components['schemas']['MetadataSyncSideResult'];
export type MetadataSyncMode = components['schemas']['MetadataSyncMode'];
export type MetadataSyncResolveRequest = components['schemas']['MetadataSyncResolveRequest'];

/**
 * Metadata sync: table and column descriptions kept the same in Glue and
 * SageMaker Unified Studio. Off unless Settings turns it on.
 */
export const metadataSyncApi = {
  /** Whether it is on, and the last preview and the last run. */
  async getStatus() {
    return unwrap(
      await client.GET('/api/metadata-sync/status'),
      'Failed to fetch the metadata sync status'
    );
  },

  /** Queue a preview or a run (single-flight: a running job's id comes back instead). */
  async start(mode: MetadataSyncMode) {
    return unwrap(
      await client.POST('/api/metadata-sync/sync', { body: { mode } }),
      'Failed to start the metadata sync'
    );
  },

  /** Pick the text for a field two places disagree on; the next run writes it. */
  async resolve(pick: MetadataSyncResolveRequest) {
    return unwrap(
      await client.POST('/api/metadata-sync/resolve', { body: pick }),
      'Failed to settle the conflict'
    );
  },
};
