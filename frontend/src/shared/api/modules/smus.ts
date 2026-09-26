import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';

export type SmusStatus = components['schemas']['SmusStatus'];
export type SmusDatasetLink = components['schemas']['SmusDatasetLink'];
export type SmusAsset = components['schemas']['SmusAsset'];
export type CreateSmusDatasetRequest = components['schemas']['CreateSmusDatasetRequest'];
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

  /**
   * Published SMUS assets in the selected projects, each with the QuickSight
   * datasets already reading it - so a target is reused, not duplicated.
   */
  async listAssets(search?: string) {
    return unwrap(
      await client.GET('/api/smus/assets', { params: { query: search ? { search } : {} } }),
      'Failed to list SMUS assets'
    );
  },

  /** The Athena data source a new dataset over a listing reads through, and the others. */
  async dataSource() {
    return unwrap(await client.GET('/api/smus/data-source'), 'Failed to choose a data source');
  },

  /** Create a QuickSight dataset over a published SMUS asset's Glue table. */
  async createDataset(listingId: string, request: CreateSmusDatasetRequest) {
    return unwrap(
      await client.POST('/api/smus/assets/{listingId}/dataset', {
        params: { path: { listingId } },
        body: request,
      }),
      'Failed to create the dataset'
    );
  },
};
