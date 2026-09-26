import type { components } from '@shared/generated/types';

import { api } from '../client';
import type { ApiResponse } from '../types';

export type SmusStatus = components['schemas']['SmusStatus'];
export type SmusDatasetLink = components['schemas']['SmusDatasetLink'];
export type SmusAsset = components['schemas']['SmusAsset'];
export type SmusAssetColumn = components['schemas']['SmusAssetColumn'];
export type SmusLinkedDataset = components['schemas']['SmusLinkedDataset'];
export type CreateSmusDatasetRequest = components['schemas']['CreateSmusDatasetRequest'];
export type SmusSnapshotSummary = components['schemas']['SmusSnapshotSummary'];
export type SmusExportQueued = components['schemas']['SmusExportQueued'];
export type SmusDataSourceChoice = components['schemas']['SmusDataSourceChoice'];

export interface SmusAssetsResponse {
  configured: boolean;
  /** When the snapshot was taken; null when no SMUS export has run. */
  exportedAt: string | null;
  projectFilter: string[];
  assets: SmusAsset[];
}

/**
 * SMUS (SageMaker Unified Studio) integration API. Everything here reads the
 * SMUS snapshot the export job wrote to the cache bucket; nothing is fetched
 * live from DataZone on a page load.
 */
export const smusApi = {
  /** Queue a SMUS export (single-flight: a running job's id comes back instead). */
  async startExport(): Promise<SmusExportQueued> {
    const response = await api.post<ApiResponse<SmusExportQueued>>('/smus/export');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to start the SMUS export');
    }
    return response.data.data;
  },

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

  /**
   * Published SMUS assets in the selected projects, each with the QuickSight
   * datasets already reading it - so a target is reused, not duplicated.
   */
  async listAssets(search?: string): Promise<SmusAssetsResponse> {
    const response = await api.get<ApiResponse<SmusAssetsResponse>>('/smus/assets', {
      params: search ? { search } : undefined,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to list SMUS assets');
    }
    return response.data.data;
  },

  /** The Athena data source a new dataset over a listing reads through, and the others. */
  async dataSource(): Promise<SmusDataSourceChoice> {
    const response = await api.get<ApiResponse<SmusDataSourceChoice>>('/smus/data-source');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to choose a data source');
    }
    return response.data.data;
  },

  /** Create a QuickSight dataset over a published SMUS asset's Glue table. */
  async createDataset(
    listingId: string,
    request: CreateSmusDatasetRequest
  ): Promise<{ dataSetId: string; name: string; arn: string }> {
    const response = await api.post<ApiResponse<{ dataSetId: string; name: string; arn: string }>>(
      `/smus/assets/${listingId}/dataset`,
      request
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create the dataset');
    }
    return response.data.data;
  },
};
