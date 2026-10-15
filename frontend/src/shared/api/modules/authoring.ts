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
export type DatasetMigrationPreview = Schemas['DatasetMigrationPreview'];
export type DatasetMigrationResult = Schemas['DatasetMigrationResult'];
export type DatasetReadersRepairPreview = Schemas['DatasetReadersRepairPreview'];
export type DatasetReadersRepairResult = Schemas['DatasetReadersRepairResult'];
export type RestoreRequest = Schemas['RestoreRequest'];
export type RestoreResult = Schemas['RestoreResult'];

/** Where a definition is read from: QuickSight, or the portal's archived copy. */
export type DefinitionSource = 'live' | 'archive';

/** `?source=archive` only when it is the archive, so live calls stay as they were. */
const sourceQuery = (source: DefinitionSource = 'live') =>
  source === 'archive' ? { source: 'archive' as const } : {};

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
  /** What moving a legacy dataset to the new data prep experience would carry. Writes nothing. */
  async previewDatasetMigration(dataSetId: string): Promise<DatasetMigrationPreview> {
    return unwrap(
      await client.POST('/api/authoring/datasets/{dataSetId}/migrate/preview', {
        params: { path: { dataSetId } },
      }),
      'Failed to preview the migration'
    );
  },

  /** The twin in the new data prep experience, with the readers repointed when asked. */
  async migrateDataset(
    dataSetId: string,
    body: { name?: string; rebindReaders?: boolean }
  ): Promise<DatasetMigrationResult> {
    return unwrap(
      await client.POST('/api/authoring/datasets/{dataSetId}/migrate', {
        params: { path: { dataSetId } },
        body,
      }),
      'Failed to migrate the dataset'
    );
  },

  /** Every dashboard and analysis on a dataset with its repair plan. Writes nothing. */
  async previewReadersRepair(dataSetId: string): Promise<DatasetReadersRepairPreview> {
    return unwrap(
      await client.POST('/api/authoring/datasets/{dataSetId}/readers/repair/preview', {
        params: { path: { dataSetId } },
      }),
      'Failed to check what reads the dataset'
    );
  },

  /** Apply each reader's proposed fixes in place. */
  async repairReaders(dataSetId: string): Promise<DatasetReadersRepairResult> {
    return unwrap(
      await client.POST('/api/authoring/datasets/{dataSetId}/readers/repair', {
        params: { path: { dataSetId } },
      }),
      'Failed to repair what reads the dataset'
    );
  },

  /** The datasets a definition declares and the columns it reads from each. */
  async getDatasets(
    assetType: AuthorableAssetType,
    assetId: string,
    source?: DefinitionSource
  ): Promise<DefinitionDatasets> {
    return unwrap(
      await client.GET('/api/authoring/{assetType}/{assetId}/datasets', {
        params: { path: { assetType, assetId }, query: sourceQuery(source) },
      }),
      'Failed to read the definition'
    );
  },

  /** Read-only. Resolves every referenced column against the target datasets. */
  async planRebind(
    assetType: AuthorableAssetType,
    assetId: string,
    rebinds: RebindRequest[],
    source?: DefinitionSource
  ): Promise<RebindPlan> {
    return unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/rebind/plan', {
        params: { path: { assetType, assetId }, query: sourceQuery(source) },
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
    request: RebindRequest[] | PreviewRequest,
    source?: DefinitionSource
  ): Promise<RebindPreview> {
    return unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/rebind/preview', {
        params: { path: { assetType, assetId }, query: sourceQuery(source) },
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
    request: RepairPlanRequest = {},
    source?: DefinitionSource
  ): Promise<RepairPlan> {
    return unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/repair/plan', {
        params: { path: { assetType, assetId }, query: sourceQuery(source) },
        body: request,
      }),
      'Failed to plan the repair'
    );
  },

  /**
   * Bring an archived dashboard or analysis back, with the repairs, dataset
   * choices and edits made on it; created under its old id unless another
   * is given, never over anything.
   */
  async restore(
    assetType: AuthorableAssetType,
    assetId: string,
    request: RestoreRequest,
    onProgress?: (message: string) => void
  ): Promise<RestoreResult> {
    // Creating a dashboard and reading it back can outlast a web request,
    // so the API queues it; the job's message says what it is doing.
    const queued = unwrap(
      await client.POST('/api/authoring/{assetType}/{assetId}/restore', {
        params: { path: { assetType, assetId } },
        body: request,
      }),
      'Failed to queue the restore'
    );
    return jobsApi.awaitResult<RestoreResult>(queued.jobId, {
      onProgress: (job) => {
        if (job.message) onProgress?.(job.message);
      },
    });
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
