import type { components } from '@shared/generated/types';

import { api as apiClient } from '../client';
import type { ApiResponse } from '../types';

type Schemas = components['schemas'];

export type AuthorableAssetType = Schemas['AuthorableAssetType'];
export type DefinitionDatasets = Schemas['DefinitionDatasets'];
export type DefinitionDataset = Schemas['DefinitionDataset'];
export type ReferencedColumn = Schemas['ReferencedColumn'];
export type ColumnUsage = Schemas['ColumnUsage'];
export type RebindRequest = Schemas['RebindRequest'];
export type RebindPlan = Schemas['RebindPlan'];
export type DatasetRebindPlan = Schemas['DatasetRebindPlan'];
export type ColumnResolution = Schemas['ColumnResolution'];
export type ColumnResolutionStatus = Schemas['ColumnResolutionStatus'];
export type ApplyRebindRequest = Schemas['ApplyRebindRequest'];
export type ApplyRebindResult = Schemas['ApplyRebindResult'];
export type ProposeRequest = Schemas['ProposeRequest'];
export type Proposal = Schemas['Proposal'];
export type RebindPreview = Schemas['RebindPreview'];

async function unwrap<T>(promise: Promise<{ data: ApiResponse<T> }>, fallback: string): Promise<T> {
  const response = await promise;
  if (!response.data.success) {
    throw new Error(response.data.error || fallback);
  }
  return response.data.data!;
}

/**
 * Authoring API - programmatic edits to dashboard and analysis definitions.
 *
 * The same three calls back the UI, the CLI and the planner: read what a
 * definition depends on, dry-run a rebind, apply it in place or as a clone.
 */
export const authoringApi = {
  /** The datasets a definition declares and the columns it reads from each. */
  getDatasets(assetType: AuthorableAssetType, assetId: string): Promise<DefinitionDatasets> {
    return unwrap(
      apiClient.get<ApiResponse<DefinitionDatasets>>(`/authoring/${assetType}/${assetId}/datasets`),
      'Failed to read the definition'
    );
  },

  /** Read-only. Resolves every referenced column against the target datasets. */
  planRebind(
    assetType: AuthorableAssetType,
    assetId: string,
    rebinds: RebindRequest[]
  ): Promise<RebindPlan> {
    return unwrap(
      apiClient.post<ApiResponse<RebindPlan>>(`/authoring/${assetType}/${assetId}/rebind/plan`, {
        rebinds,
      }),
      'Failed to plan the rebind'
    );
  },

  /** Writes to QuickSight. Refused unless the plan resolves completely. */
  applyRebind(
    assetType: AuthorableAssetType,
    assetId: string,
    request: ApplyRebindRequest
  ): Promise<ApplyRebindResult> {
    return unwrap(
      apiClient.post<ApiResponse<ApplyRebindResult>>(
        `/authoring/${assetType}/${assetId}/rebind`,
        request
      ),
      'Failed to apply the rebind'
    );
  },

  /** The plan plus the definition as apply would write it, for mockups. */
  previewRebind(
    assetType: AuthorableAssetType,
    assetId: string,
    rebinds: RebindRequest[]
  ): Promise<RebindPreview> {
    return unwrap(
      apiClient.post<ApiResponse<RebindPreview>>(
        `/authoring/${assetType}/${assetId}/rebind/preview`,
        { rebinds }
      ),
      'Failed to preview the rebind'
    );
  },

  /** Natural language in, a validated proposal out. Never applies anything. */
  propose(
    assetType: AuthorableAssetType,
    assetId: string,
    request: ProposeRequest
  ): Promise<Proposal> {
    return unwrap(
      apiClient.post<ApiResponse<Proposal>>(`/authoring/${assetType}/${assetId}/propose`, request),
      'Failed to build a proposal'
    );
  },
};
