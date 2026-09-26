import type { components, paths } from '@shared/generated/types';

import { client, unwrap } from '../typed';
import { jobsApi } from './jobs';

type Schemas = components['schemas'];

export type AuthorableAssetType = Schemas['AuthorableAssetType'];
type DefinitionDatasets = Schemas['DefinitionDatasets'];
export type DefinitionDataset = Schemas['DefinitionDataset'];
export type ColumnUsage = Schemas['ColumnUsage'];
export type RebindRequest = Schemas['RebindRequest'];
export type RebindPlan = Schemas['RebindPlan'];
export type DatasetRebindPlan = Schemas['DatasetRebindPlan'];
export type ColumnResolution = Schemas['ColumnResolution'];
export type ApplyRebindRequest = Schemas['ApplyRebindRequest'];
type ApplyRebindResult = Schemas['ApplyRebindResult'];
type ProposeRequest = Schemas['ProposeRequest'];
export type Proposal = Schemas['Proposal'];
type RebindPreview = Schemas['RebindPreview'];
export type DefinitionOp = Schemas['DefinitionOp'];
export type DefinitionChange = Schemas['DefinitionChange'];
export type SheetOutline = Schemas['SheetOutline'];
export type SheetOutlineElement = Schemas['SheetOutlineElement'];
export type AssetInsights = Schemas['AssetInsights'];
export type VisualHealth = Schemas['VisualHealth'];
export type RepairOp = Schemas['RepairOp'];
export type RepairFix = Schemas['RepairFix'];
export type RepairIssue = Schemas['RepairIssue'];
export type RepairPlan = Schemas['RepairPlan'];

type PostBody<P extends keyof paths> = paths[P] extends {
  post: { requestBody?: { content: { 'application/json': infer B } } };
}
  ? B
  : never;

/** Rebinds plus edits: calculated fields, ops, repairs (applied first), a template, type rules. */
type PreviewRequest = PostBody<'/api/authoring/{assetType}/{assetId}/rebind/preview'>;

/** Datasets already chosen for identifiers whose own dataset is gone. */
type RepairPlanRequest = PostBody<'/api/authoring/{assetType}/{assetId}/repair/plan'>;

/**
 * Authoring API - programmatic edits to dashboard and analysis definitions.
 *
 * The same three calls back the UI, the CLI and the planner: read what a
 * definition depends on, dry-run a rebind, apply it in place or as a clone.
 */
export const authoringApi = {
  /** The datasets a definition declares and the columns it reads from each. */
  async getDatasets(assetType: AuthorableAssetType, assetId: string): Promise<DefinitionDatasets> {
    return unwrap(
      await client.GET('/api/authoring/{assetType}/{assetId}/datasets', {
        params: { path: { assetType, assetId } },
      }),
      'Failed to read the definition'
    );
  },

  /** Read-only. Resolves every referenced column against the target datasets. */
  async planRebind(
    assetType: AuthorableAssetType,
    assetId: string,
    rebinds: RebindRequest[]
  ): Promise<RebindPlan> {
    return unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/rebind/plan', {
        params: { path: { assetType, assetId } },
        body: { rebinds },
      }),
      'Failed to plan the rebind'
    );
  },

  /** Writes to QuickSight. Refused unless the plan resolves completely. */
  async applyRebind(
    assetType: AuthorableAssetType,
    assetId: string,
    request: ApplyRebindRequest
  ): Promise<ApplyRebindResult> {
    return unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/rebind', {
        params: { path: { assetType, assetId } },
        body: request,
      }),
      'Failed to apply the rebind'
    );
  },

  /** The plan plus the definition as apply would write it, for mockups. */
  async previewRebind(
    assetType: AuthorableAssetType,
    assetId: string,
    request: RebindRequest[] | PreviewRequest
  ): Promise<RebindPreview> {
    return unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/rebind/preview', {
        params: { path: { assetType, assetId } },
        body: Array.isArray(request) ? { rebinds: request } : request,
      }),
      'Failed to preview the rebind'
    );
  },

  /**
   * Read-only. Everything that stops QuickSight from writing this definition,
   * each with a fix. `rebinds` names datasets already chosen for identifiers
   * whose own dataset is gone.
   */
  async planRepair(
    assetType: AuthorableAssetType,
    assetId: string,
    request: RepairPlanRequest = {}
  ): Promise<RepairPlan> {
    return unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/repair/plan', {
        params: { path: { assetType, assetId } },
        body: request,
      }),
      'Failed to plan the repair'
    );
  },

  /** Views from the portal's activity data and, for dashboards, CloudWatch health. */
  async getInsights(assetType: AuthorableAssetType, assetId: string): Promise<AssetInsights> {
    return unwrap(
      await client.GET('/api/authoring/{assetType}/{assetId}/insights', {
        params: { path: { assetType, assetId } },
      }),
      'Failed to load insights'
    );
  },

  /**
   * Natural language in, a validated proposal out. Never applies anything.
   * The planner runs as a job (a long think would outlive the gateway), so
   * this queues it and waits for the result.
   */
  async propose(
    assetType: AuthorableAssetType,
    assetId: string,
    request: ProposeRequest
  ): Promise<Proposal> {
    const queued = unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/propose', {
        params: { path: { assetType, assetId } },
        body: request,
      }),
      'Failed to queue the proposal'
    );
    return jobsApi.awaitResult<Proposal>(queued.jobId);
  },
};
