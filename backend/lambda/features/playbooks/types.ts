/**
 * A playbook is a fix across the account, in four parts:
 *
 *   scope   which assets it could touch (read from the cache: cheap, all at once)
 *   plan    for one asset, what it would change, read live: change, review or skip
 *   apply   make that change
 *   stage   (optional) the order kinds of asset must go in
 *
 * Plans and applies go through the portal's own API, in-process, as the
 * person who started the run: a playbook can only do what that person could
 * do by hand or with an API key, every write is attributed to them, and every
 * step is one the Assistant and the API already offer. The engine owns the
 * rest: rows per asset, concurrency, a failure threshold, resuming after the
 * Lambda time limit, retrying what failed.
 */
import type { CatalogEntry } from '../../shared/models/asset.model';
import type { AssetType } from '../../shared/types/assetTypes';

export interface PlaybookTarget {
  assetType: AssetType;
  assetId: string;
  name: string;
}

/** A target as scope found it, with what the gates judge it by. */
export interface ScopedTarget extends PlaybookTarget {
  /** Its tags (the opt-out tag, onlyTagged). */
  tags?: Array<{ key: string; value: string }>;
  /** When it last changed (editedWithinDays). */
  lastUpdatedTime?: string | Date;
  /** The cache entry, when scope read one (a playbook's own gates may read more of it). */
  entry?: CatalogEntry;
}

/**
 * A condition an asset must pass to be worked on. An asset a gate keeps
 * out is still listed, skipped, with the gate's reason, so a preview shows
 * what was held back and why.
 */
export interface GateSpec {
  key: string;
  label: string;
  kind: 'number' | 'text' | 'boolean';
  help?: string;
  /** Used when the request does not set it; absent means off. */
  default?: number | string | boolean;
}

export interface Gate extends GateSpec {
  /** Why this asset is kept out, or null to let it through. Only called with a value set. */
  exclude(target: ScopedTarget, value: number | string | boolean, now: number): string | null;
}

export interface ItemPlan {
  verdict: 'change' | 'review' | 'skip';
  /** One line: what it found. */
  summary: string;
  /** Each change it would make, in words. */
  changes?: string[];
  /** What the playbook needs back to apply it (kept on the item row). */
  data?: unknown;
}

interface ItemOutcome {
  summary: string;
  warnings?: string[];
}

/** A value a playbook asks for before it runs. */
export interface PlaybookParam {
  key: string;
  label: string;
  kind: 'datasource' | 'text' | 'boolean' | 'number' | 'engine' | 'folder' | 'theme';
  help?: string;
  required?: boolean;
  /** datasource only: offer only data sources of this engine. */
  dataSourceType?: string;
  default?: string | number | boolean;
}

/** A call to the portal's own API. Throws PortalCallError on anything but 2xx. */
export type PortalCall = <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;

export class PortalCallError extends Error {
  public constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'PortalCallError';
  }
}

/** A model asked for JSON that fits a schema (the worker wires it to the run's model). */
export interface InferRequest {
  /** Short tag for logs. */
  label: string;
  system: string;
  user: string;
  schemaName: string;
  schemaDescription: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

export type Infer = (request: InferRequest) => Promise<unknown>;

export interface PlaybookContext {
  call: PortalCall;
  params: Record<string, unknown>;
  /** Present when the run has a model; steps that infer send uncertain work to review without one. */
  infer?: Infer;
}

export interface Playbook {
  id: string;
  title: string;
  /** What it does and why, for the card. */
  description: string;
  /** What kind of fix it is, to group the cards. */
  category: 'repair' | 'data' | 'cleanup' | 'custom';
  params: PlaybookParam[];
  /** What it writes to, so the run can say so and the cache can follow. */
  writes: AssetType[];
  /** True when applying it deletes (the asset is archived first, and restorable). */
  deletes?: boolean;
  /** Conditions of its own, beside the ones every playbook has. */
  gates?: Gate[];
  /** Defaults for any gate's value (its own or the common ones). */
  gateDefaults?: Record<string, number | string | boolean>;
  scope(ctx: PlaybookContext): Promise<ScopedTarget[]>;
  plan(ctx: PlaybookContext, target: PlaybookTarget): Promise<ItemPlan>;
  apply(ctx: PlaybookContext, target: PlaybookTarget, plan: ItemPlan): Promise<ItemOutcome>;
  /** Set when it is built from a spec (shipped or saved): the builder can copy it. */
  spec?: unknown;
  /** Some step asks a model (the preview then carries the model chosen). */
  infers?: boolean;
  /** Lower stages finish before higher ones start. Default 0. */
  stage?(target: PlaybookTarget): number;
}

/** How a run behaves. */
export interface RunLimits {
  /** How many assets are worked on at once. */
  concurrency: number;
  /** Stop starting new items once this share of those tried have failed... */
  failureThreshold: number;
  /** ...but only after this many have been tried. */
  failureMinimum: number;
}

export const DEFAULT_RUN_LIMITS: RunLimits = {
  concurrency: 4,
  failureThreshold: 0.2,
  failureMinimum: 5,
};

/** What a playbook job was asked to do. */
export type PlaybookJobRequest =
  | {
      mode: 'preview';
      playbookId: string;
      params: Record<string, unknown>;
      /** Gate values by key; null turns a gate with a default off. */
      gates?: Record<string, number | string | boolean | null>;
      /** A model catalog key for steps that infer; the run uses the preview's. */
      model?: string;
    }
  | {
      mode: 'run';
      playbookId: string;
      params: Record<string, unknown>;
      /** The preview this run applies; its 'change' rows are the run's items. */
      previewJobId: string;
      /** Only these item keys (default: every 'change' row). */
      keys?: string[];
      /** Retry: the rows of this earlier run that failed. */
      retryOf?: string;
      model?: string;
      limits?: Partial<RunLimits>;
    };
