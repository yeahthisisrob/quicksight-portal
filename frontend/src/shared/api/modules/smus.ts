import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';

export type SmusStatus = components['schemas']['SmusStatus'];
export type SmusDatasetLink = components['schemas']['SmusDatasetLink'];
export type SmusSnapshotSummary = components['schemas']['SmusSnapshotSummary'];

/**
 * SMUS (SageMaker Unified Studio) integration. Everything here reads the
 * SMUS snapshot the export job wrote to the cache bucket; nothing is fetched
 * live from DataZone on a page load.
 */
export const smusApi = {
  /** Queue a SMUS export (single-flight: a running job's id comes back instead). */
  async startExport() {
    return unwrap(await client.POST('/api/smus/export'), 'Failed to start the SMUS export');
  },

  /** Whether a SMUS domain is configured (drives all SMUS UI visibility). */
  async getStatus() {
    return unwrap(await client.GET('/api/smus/status'), 'Failed to fetch SMUS status');
  },

  /** Resolve SMUS catalog links for the given datasets (all when omitted). */
  async getDatasetLinks(datasetIds?: string[]) {
    return unwrap(
      await client.POST('/api/smus/dataset-links', { body: { datasetIds } }),
      'Failed to resolve SMUS dataset links'
    ).links;
  },
};
