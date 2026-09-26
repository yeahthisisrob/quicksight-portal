import type { AiModelKey } from '../../../shared/ai/modelCatalog';

/** One line of the conversation as the client keeps it: text only. */
export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * The run protocol follows AG-UI 1.0 (docs.ag-ui.com): a question the agent
 * asks ends the run with an `interrupt` outcome; the next run carries the
 * answer as a `resume` entry. Only the data model is adopted; the transport
 * stays a job the page polls.
 */
export interface AgUiInterrupt {
  id: string;
  /** 'input_required' for a question to the person. */
  reason: string;
  message?: string;
  toolCallId?: string;
  /** JSON Schema of the answer the resume payload must match. */
  responseSchema?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

type RunOutcome = { type: 'success' } | { type: 'interrupt'; interrupts: AgUiInterrupt[] };

export interface ResumeEntry {
  interruptId: string;
  status: 'resolved' | 'cancelled';
  payload?: unknown;
}

/** One option of a question, tied to an entity when it names one. */
export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  /** A context-graph entity id (dataset:abc, folder:xyz). */
  entityId?: string;
  /** Filled in from the graph when entityId is known. */
  summary?: string;
  path?: string;
}

/**
 * What the page holds between answers (AG-UI state): actions prepared and
 * not run (the working draft), and actions the person ran, with results.
 */
export interface WorkingState {
  drafts: Array<{ title: string; method: string; path: string; body?: unknown }>;
  ran: Array<{
    title: string;
    method: string;
    path: string;
    status: 'done' | 'failed' | 'running';
    result?: unknown;
    error?: string;
    jobId?: string;
  }>;
}

/** A call the assistant made itself (reads and previews). */
export interface AssistantCall {
  method: string;
  path: string;
  status: number;
  ok: boolean;
}

/**
 * Something to show the person, by reference: the page fetches or re-runs
 * it and draws it, so a whole definition never rides in the job result.
 * - preview: a read-only preview call; drawn as a wireframe of what it
 *   would publish, with its warnings.
 * - asset: an existing dashboard or analysis, drawn as it is now.
 * - lineage: a calculated field's lineage, both ways.
 */
export type AssistantArtifact =
  | { id: string; kind: 'preview'; title: string; method: 'POST'; path: string; body?: unknown }
  | {
      id: string;
      kind: 'asset';
      title: string;
      assetType: 'dashboard' | 'analysis';
      assetId: string;
    }
  | { id: string; kind: 'lineage'; title: string; fieldKey: string }
  | ({ id: string; kind: 'plan'; title: string } & BuildPlan)
  | { id: string; kind: 'fields'; title: string; fields: FieldVerdict[] };

type PlanStatus = 'existing' | 'new' | 'edited';

/**
 * What a change will build, as a lineage: the SMUS listings it reads, the
 * datasets over them (existing or new, and through which data source),
 * any calculated fields it adds, and the analysis or dashboard it makes or
 * changes. Drawn before anything is run.
 */
export interface BuildPlan {
  sources: Array<{ listing: string; project?: string; table?: string }>;
  datasets: Array<{ name: string; id?: string; status: 'existing' | 'new'; dataSource?: string }>;
  calculatedFields?: Array<{
    name: string;
    expression?: string;
    status: 'existing' | 'new';
    /** The id of the dataset it is computed on, when that dataset exists. */
    dataset?: string;
  }>;
  /** The filters the asset will carry, each a control in the sheet's control bar. */
  filters?: Array<{ column: string; title?: string }>;
  asset: { kind: 'dashboard' | 'analysis'; name: string; id?: string; status: PlanStatus };
}

/** A write the assistant prepared; the person runs it, under their own session. */
export interface AssistantAction {
  id: string;
  title: string;
  why: string;
  method: 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  /** The preview this action publishes, to confirm against before running. */
  previewId?: string;
  /** The plan (lineage) this action is part of. */
  planId?: string;
}

export interface AssistantChatResult {
  reply: string;
  calls: AssistantCall[];
  actions: AssistantAction[];
  artifacts: AssistantArtifact[];
  model: { key: AiModelKey; label: string; modelId: string };
  usage: { inputTokens: number; outputTokens: number };
  /** Dollars at list price; a rough guide. */
  cost: number;
  rounds: number;
  /** How the run ended: done, or waiting on the person's answer (AG-UI outcome). */
  outcome: RunOutcome;
  /** Other models this answer used through the portal, such as the planner. */
  helpers?: Array<{ role: 'planner'; label: string; modelId: string; provider: string }>;
}

/**
 * A calculated field a change adds, and where it belongs under the
 * push-down-to-gold strategy:
 * - use-column: row-level, and the dataset already has a column by that
 *   name, so the column is used instead of recomputing it;
 * - push-down: row-level with no such column, and the guidance says to
 *   materialise it upstream in the source (a follow-up);
 * - dataset: the same, and the guidance says to materialise it in the
 *   QuickSight dataset;
 * - row-level: the same, with no preference in the guidance;
 * - analysis: aggregates, table or level-aware calculations, or reads a
 *   parameter, so it can only be computed in the analysis.
 */
export interface FieldVerdict {
  name: string;
  expression: string;
  dataset?: string;
  verdict: 'use-column' | 'push-down' | 'dataset' | 'row-level' | 'analysis';
  /** The existing column, for use-column. */
  column?: string;
  /** Why, in words. */
  note: string;
}
