/**
 * Authoring - programmatic edits to dashboard and analysis definitions.
 *
 * The vocabulary here is deliberately small and stable because three
 * callers share it: the portal UI, the CLI, and (later) an LLM
 * planner. A caller proposes a *rebind* (point a dataset identifier at another
 * dataset, optionally renaming columns), asks for a *plan* (what the
 * definition references and whether the target satisfies it), and only then
 * *applies* it - in place, or as a clone.
 */

import type { DefinitionChange, DefinitionOp } from '../lib/definitionOps';
import type { SheetOutline } from '../lib/definitionOutline';

export type { DefinitionChange, DefinitionOp, SheetOutline };

import type { RepairOp } from '../lib/definitionRepairs';

export type { RepairFix, RepairIssue, RepairIssueKind, RepairPlan } from '../lib/repairPlan';
export type { RepairOp };

export type AuthorableAssetType = 'analysis' | 'dashboard';

export const AUTHORABLE_ASSET_TYPES: readonly AuthorableAssetType[] = ['analysis', 'dashboard'];

export function isAuthorableAssetType(value: string): value is AuthorableAssetType {
  return (AUTHORABLE_ASSET_TYPES as readonly string[]).includes(value);
}

/**
 * Where in a definition a column is referenced. Coarse on purpose: enough for
 * a reader (or a planner) to judge the blast radius of a missing column.
 */
export type ColumnUsageSite =
  | 'visual'
  | 'filter'
  | 'calculatedField'
  | 'parameter'
  | 'control'
  | 'other';

export interface ColumnUsage {
  visual: number;
  filter: number;
  calculatedField: number;
  parameter: number;
  control: number;
  other: number;
}

/** One dataset column a definition depends on. */
export interface ReferencedColumn {
  name: string;
  usage: ColumnUsage;
}

/** One `DataSetIdentifierDeclarations` entry, with what the definition takes from it. */
export interface DefinitionDataset {
  identifier: string;
  dataSetArn: string;
  dataSetId: string;
  /** Columns the definition reads from this dataset, calculated fields excluded. */
  columns: ReferencedColumn[];
  /** Calculated fields the definition declares against this dataset. */
  calculatedFields: string[];
}

/** A request to point one dataset identifier at a different dataset. */
export interface RebindRequest {
  identifier: string;
  targetDataSetId: string;
  /** Source column name -> target column name, for columns whose names differ. */
  columnMap?: Record<string, string>;
}

export type ColumnResolutionStatus =
  /** Same name exists in the target. */
  | 'matched'
  /** Renamed through `columnMap` to a column the target has. */
  | 'mapped'
  /** Not in the target, but a near match exists - offered as `suggestion`. */
  | 'suggested'
  /** Not in the target and nothing close. Applying would fail. */
  | 'missing';

export interface ColumnResolution {
  name: string;
  status: ColumnResolutionStatus;
  /** The column name the definition will use after the rebind (matched/mapped). */
  resolvedTo?: string;
  /** A target column that differs only in case, separators or spacing. */
  suggestion?: string;
  targetType?: string;
  usage: ColumnUsage;
}

export interface DatasetRebindPlan {
  identifier: string;
  current: { dataSetId: string; dataSetArn: string };
  target: { dataSetId: string; dataSetArn: string; name: string; columnCount: number };
  columns: ColumnResolution[];
  /** Target columns nothing in the definition uses. Informational. */
  unusedTargetColumns: string[];
  summary: Record<ColumnResolutionStatus, number>;
}

export interface RebindPlan {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  datasets: DatasetRebindPlan[];
  /** True when every referenced column resolves. Apply refuses otherwise. */
  canApply: boolean;
}

export type ApplyMode =
  /** Rewrite the asset in place (dashboards get a new published version). */
  | 'update'
  /** Create a new asset with the rewritten definition and the source's permissions. */
  | 'clone';

export interface ApplyRequest {
  mode: ApplyMode;
  rebinds: RebindRequest[];
  /** Required for clone. Optional rename for update. */
  name?: string;
  /** Clone only. Generated when omitted. */
  newAssetId?: string;
  /** Calculated fields to add to the written definition, e.g. from the template library. */
  addCalculatedFields?: AddedCalculatedField[];
  /** Edits applied after rebinds and added fields, in order. */
  ops?: DefinitionOp[];
  /** Repairs applied first, before the rebind plan (see the repair plan endpoint). */
  repairs?: RepairOp[];
  /** Clone only: put the new asset in this folder. */
  folderId?: string;
}

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

export interface RebindPreview {
  plan: RebindPlan;
  definition: Record<string, any>;
  changes: DefinitionChange[];
  outline: SheetOutline[];
}

export interface AddedCalculatedField {
  identifier: string;
  name: string;
  expression: string;
  templateId?: string;
}

export interface ApplyResult {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  arn: string;
  mode: ApplyMode;
  /** Dashboards: the version that was created (and, for update, published). */
  versionNumber?: number;
  plan: RebindPlan;
  changes: DefinitionChange[];
  folderId?: string;
}

// ---------------------------------------------------------------------------
// Planner - natural language in, a validated proposal out. Never applies.
// ---------------------------------------------------------------------------

export interface ProposeRequest {
  /** What the person wants, in their words. */
  ask: string;
  /** Restrict the datasets the planner may choose from. Defaults to every active dataset. */
  candidateDataSetIds?: string[];
}

export interface ProposedRebind extends RebindRequest {
  /** Why the planner chose this dataset, in one sentence. */
  reason: string;
}

export interface UnmappedColumn {
  identifier: string;
  column: string;
  reason: string;
}

export interface Proposal {
  ask: string;
  /** `unclear` when the ask is not a rebind/clone the planner can express. */
  intent: 'rebind' | 'unclear';
  mode: ApplyMode;
  /** Proposed name; absent means keep the current one. */
  name?: string;
  reason: string;
  rebinds: ProposedRebind[];
  /** Columns the planner looked at and could not map. */
  unmapped: UnmappedColumn[];
  /** Layout and visual edits the planner proposes, already validated. */
  ops: DefinitionOp[];
  /** The server's own dry run of the proposal. Null when the intent is unclear. */
  plan: RebindPlan | null;
  model: { provider: string; model: string };
}
