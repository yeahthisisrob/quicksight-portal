import type { components } from '@shared/generated/types';

import { client, unwrap } from '../typed';
import { jobsApi } from './jobs';

type Schemas = components['schemas'];

export type AssetVersion = Schemas['AssetVersion'];
export type VersionDiff = Schemas['VersionDiff'];
export type VersionDiffEntry = Schemas['VersionDiffEntry'];
export type RollbackResult = Schemas['RollbackResult'];
export type VersionedAssetType = AssetVersion['assetType'];

/** The versions dashboards, analyses and datasets have been through. */
export const historyApi = {
  /** Every version kept across the account, newest first. */
  async recent(limit?: number): Promise<AssetVersion[]> {
    return unwrap(
      await client.GET('/api/history', { params: { query: limit ? { limit } : {} } }),
      'History could not be read'
    ).versions;
  },

  /** An asset's versions, newest first. */
  async list(assetType: VersionedAssetType, assetId: string): Promise<AssetVersion[]> {
    return unwrap(
      await client.GET('/api/history/{assetType}/{assetId}', {
        params: { path: { assetType, assetId } },
      }),
      'History could not be read'
    ).versions;
  },

  /** One version with the definition it kept. */
  async get(
    assetType: VersionedAssetType,
    assetId: string,
    versionId: string
  ): Promise<{ version: AssetVersion; definition: Record<string, unknown> }> {
    return unwrap(
      await client.GET('/api/history/{assetType}/{assetId}/{versionId}', {
        params: { path: { assetType, assetId, versionId } },
      }),
      'The version could not be read'
    );
  },

  /**
   * What changed up to this version: from the one before (default), from
   * another version, or from this version to what is live (`live`). With
   * `definitions`, both definitions come back for a side-by-side view.
   */
  async diff(
    assetType: VersionedAssetType,
    assetId: string,
    versionId: string,
    options: { against?: string; definitions?: boolean } = {}
  ): Promise<VersionDiff> {
    return unwrap(
      await client.GET('/api/history/{assetType}/{assetId}/{versionId}/diff', {
        params: {
          path: { assetType, assetId, versionId },
          query: {
            ...(options.against ? { against: options.against } : {}),
            ...(options.definitions ? { include: 'definitions' as const } : {}),
          },
        },
      }),
      'The versions could not be compared'
    );
  },

  /** Put a version back over the live asset; runs as a job, with its message as progress. */
  async rollback(
    assetType: VersionedAssetType,
    assetId: string,
    versionId: string,
    onProgress?: (message: string) => void
  ): Promise<RollbackResult> {
    const queued = unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/versions/{versionId}/restore', {
        params: { path: { assetType, assetId, versionId } },
        body: {},
      }),
      'The rollback could not start'
    );
    return jobsApi.awaitResult<RollbackResult>(queued.jobId, {
      onProgress: (job) => {
        if (job.message) onProgress?.(job.message);
      },
    });
  },
};
