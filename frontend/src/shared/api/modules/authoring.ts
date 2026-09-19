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
export type DefinitionOp = Schemas['DefinitionOp'];
export type DefinitionChange = Schemas['DefinitionChange'];
export type SheetOutline = Schemas['SheetOutline'];
export type SheetOutlineElement = Schemas['SheetOutlineElement'];
export type AddedCalculatedField = Schemas['AddedCalculatedField'];
export type AssetInsights = Schemas['AssetInsights'];
export type VisualHealth = Schemas['VisualHealth'];
export type RepairOp = Schemas['RepairOp'];
export type RepairFix = Schemas['RepairFix'];
export type RepairIssue = Schemas['RepairIssue'];
export type RepairPlan = Schemas['RepairPlan'];

export interface PreviewRequest {
  rebinds: RebindRequest[];
  addCalculatedFields?: AddedCalculatedField[];
  ops?: DefinitionOp[];
  /** Applied first, before the rebind plan, so the plan sees the repaired definition. */
  repairs?: RepairOp[];
}

export interface RepairPlanRequest {
  /** Datasets already chosen for identifiers whose own dataset is gone. */
  rebinds?: RebindRequest[];
}

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
    request: RebindRequest[] | PreviewRequest
  ): Promise<RebindPreview> {
    const body: PreviewRequest = Array.isArray(request) ? { rebinds: request } : request;
    return unwrap(
      apiClient.post<ApiResponse<RebindPreview>>(
        `/authoring/${assetType}/${assetId}/rebind/preview`,
        body
      ),
      'Failed to preview the rebind'
    );
  },

  /**
   * Read-only. Everything that stops QuickSight from writing this definition,
   * each with a fix. `rebinds` names datasets already chosen for identifiers
   * whose own dataset is gone.
   */
  planRepair(
    assetType: AuthorableAssetType,
    assetId: string,
    request: RepairPlanRequest = {}
  ): Promise<RepairPlan> {
    return unwrap(
      apiClient.post<ApiResponse<RepairPlan>>(
        `/authoring/${assetType}/${assetId}/repair/plan`,
        request
      ),
      'Failed to plan the repair'
    );
  },

  /** Views from the portal's activity data and, for dashboards, CloudWatch health. */
  getInsights(assetType: AuthorableAssetType, assetId: string): Promise<AssetInsights> {
    return unwrap(
      apiClient.get<ApiResponse<AssetInsights>>(`/authoring/${assetType}/${assetId}/insights`),
      'Failed to load insights'
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
