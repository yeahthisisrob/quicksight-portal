import { type AssetType } from '../../../shared/types/assetTypes';

// Keep original types for backward compatibility but map to new types
export type ActivityData = AssetActivityData;
export type UserActivity = UserActivityData;

export interface ActivityRefreshRequest {
  assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
  days?: number;
}

export interface ActivityRefreshResponse {
  success: boolean;
  message: string;
  refreshed: {
    dashboards?: number;
    analyses?: number;
    users?: number;
  };
}

export interface ActivitySummaryResponse {
  dashboards: {
    totalViews: number;
    uniqueViewers: number;
    activeAssets: number;
  };
  analyses: {
    totalViews: number;
    uniqueViewers: number;
    activeAssets: number;
  };
  users: {
    activeUsers: number;
    totalActivities: number;
  };
}

/**
 * Coarse action category for a mutation event — derived from event name by classifyAction().
 * Stored on the MinimalEvent so filters don't have to re-parse the event name on every read.
 *
 * - create: Create* / Register* / StartIngestion-like
 * - update: Update* / Put* / Restore*
 * - delete: Delete* / Cancel*
 * - publish: UpdateDashboardPublishedVersion / UpdateBrandPublishedVersion
 * - grant: Update*Permissions (sharing / ACL change)
 * - revoke: Delete*Permissions
 * - member: Create*Membership / Delete*Membership
 * - tag: TagResource / UntagResource
 * - job: Start* (long-running jobs — asset bundles, snapshots, automation)
 * - batch: Batch* (bulk operations)
 */
export type ActionCategory =
  | 'create'
  | 'update'
  | 'delete'
  | 'publish'
  | 'grant'
  | 'revoke'
  | 'member'
  | 'tag'
  | 'job'
  | 'batch';

/**
 * Kind of a CloudTrail event: view (Get/Describe) or mutation
 * (Create/Update/Delete/...). Missing field is treated as 'view' for
 * backward compatibility with pre-timeline cache entries.
 */
export type EventKind = 'view' | 'mutation';

/**
 * Resource type for a timeline event. Extends the portal's AssetType (7 catalog types)
 * with 'other' for QuickSight resources the catalog doesn't track — templates, themes,
 * brands, topics, action connectors, VPC connections, namespaces, and account-level
 * settings mutations. 'other' events render in the timeline but without an asset chip
 * or click-through link.
 */
export type TimelineResourceType = AssetType | 'other';

/**
 * Stored activity event. Pruned — the full CloudTrail log is never kept —
 * but with readable field names: the single-char minification (t/e/u/r)
 * saved ~30% blob size at too high a debuggability cost (schema v5).
 */
export interface MinimalEvent {
  /** Event time (ISO string). */
  timestamp: string;
  /** CloudTrail event name (GetDashboard, UpdateAnalysis, ...). */
  eventName: string;
  /** User name or ARN that performed the action. */
  user: string;
  /** Resource id (dashboardId, analysisId, ...). */
  resourceId?: string;
  /** Asset name captured from the CloudTrail payload itself. */
  name?: string;
  /** Kind — missing = 'view' (backward-compat). */
  kind?: EventKind;
  /** Derived action category (mutations only). */
  action?: ActionCategory;
  /** Resource type this event targets — catalog asset type or 'other'. */
  resourceType?: TimelineResourceType;
  /** Metadata (optional, for future event types). */
  metadata?: any;
  /**
   * Allowlisted slice of the CloudTrail payload — mutations only. Holds
   * request/response identifiers, names, ARNs, the console
   * eventRequestDetails array, and error fields (size-capped). Views stay
   * minimal for volume; mutations keep enough to debug and hydrate names.
   */
  details?: Record<string, unknown>;
  /**
   * Stable CloudTrail EventId (UUID). Optional for backward compat with
   * older cache entries; used for dedup on incremental merge.
   */
  eventId?: string;
}

/**
 * Bumped when ActivityCache shape changes in a way that requires re-fetch.
 * A cache read with a missing or older schemaVersion forces a full 90-day
 * rescan on the next refresh (watermarks are discarded and event buckets are
 * wiped before merge).
 *
 * v2: introduced perEventNameWatermark / id-based dedup.
 * v3: console-originated mutation events (array-shaped eventRequestDetails,
 *     e.g. UpdateAnalysis) now extract the asset id — cached events ingested
 *     before that fix lack `r`, so catalog name hydration can't key them.
 *     Full rescan re-extracts ids for the whole window.
 * v4: mutation events capture an allowlisted CloudTrail payload slice (`d`)
 *     for debugging and name hydration. Full rescan populates it for the
 *     whole 90-day window.
 * v5: stored events use readable field names (timestamp/eventName/user/...)
 *     instead of single-char keys, and mutation id extraction gained an
 *     ARN-scan fallback. Full rescan rewrites the window in the new shape.
 */
export const ACTIVITY_CACHE_SCHEMA_VERSION = 5;

// Activity cache - stores raw events grouped by date
export interface ActivityCache {
  version: string;
  /**
   * Cache schema version. Missing = pre-v2 (legacy) — read paths still work,
   * but the next refresh runs a full scan and rewrites at the current version.
   */
  schemaVersion?: number;
  lastUpdated: string;
  dateRange: {
    start: string;
    end: string;
  };
  // Events grouped by date for efficiency
  events: {
    [date: string]: MinimalEvent[]; // "2025-07-21": [...]
  };
  /**
   * Latest CloudTrail EventTime (ISO) successfully ingested per event-name.
   * Drives incremental refresh: next fetch starts at watermark - overlap.
   * Per-name (not global) so a transient failure on one event-name doesn't
   * rewind everyone else.
   */
  perEventNameWatermark?: { [eventName: string]: string };
}

// Persistence cache - stores only last activity dates that persist forever
export interface ActivityPersistence {
  version: string;
  lastUpdated: string;
  // Last activity dates by type and ID
  dashboards: { [dashboardId: string]: string }; // dashboardId -> lastViewedDate
  analyses: { [analysisId: string]: string }; // analysisId -> lastViewedDate
  users: { [userName: string]: string }; // userName -> lastActiveDate
  // Extensible for future types
  [key: string]: any;
}

// API Response types (computed on-the-fly from events)
export interface AssetActivityData {
  assetId: string;
  assetName?: string; // Added for frontend display
  assetType: string;
  totalViews: number;
  uniqueViewers: number;
  lastViewed: string;
  viewsByDate: { [date: string]: number };
  viewers: Array<{
    userName: string;
    viewCount: number;
    lastViewed: string;
    groups: string[];
  }>;
}

/**
 * A dashboard/analysis that uses a dataset — resolved from lineage by the
 * caller (lineage stays outside the activity slice; only ids/names come in).
 */
export interface DatasetDependentRef {
  assetId: string;
  assetName?: string;
  assetType: 'dashboard' | 'analysis';
}

/** Per-dependent activity block inside DatasetActivityData. */
export interface DatasetDependentActivity extends DatasetDependentRef {
  totalViews: number;
  uniqueViewers: number;
  lastViewed: string | null;
  lastUpdated: string | null;
}

/**
 * Activity for a dataset: refresh (ingestion) history from the ingestions
 * cache plus aggregated view/update activity of the dashboards and analyses
 * that use it. Computed on read, same as asset/user activity.
 */
export interface DatasetActivityData {
  datasetId: string;
  datasetName?: string;
  totalViews: number;
  uniqueViewers: number;
  lastViewed: string | null;
  viewsByDate: { [date: string]: number };
  usedBy: DatasetDependentActivity[];
  refreshSummary: {
    totalIngestions: number;
    failedIngestions: number;
    lastIngestionTime: string | null;
    lastIngestionStatus: string | null;
  };
  ingestions: any[];
}

export interface UserActivityData {
  userName: string;
  lastActive: string;
  totalActivities: number;
  activitiesByDate: { [date: string]: number };
  dashboards: Array<{
    dashboardId: string;
    dashboardName?: string; // Added for frontend display
    viewCount: number;
    lastViewed: string;
  }>;
  analyses: Array<{
    analysisId: string;
    analysisName?: string; // Added for frontend display
    viewCount: number;
    lastViewed: string;
  }>;
}

/**
 * One entry in the activity timeline — wire format returned to the frontend.
 * Hydrated from MinimalEvent + catalog lookup on the backend.
 */
export interface TimelineEvent {
  id: string; // stable — hash of `${t}_${e}_${r}_${u}`
  timestamp: string; // ISO
  eventName: string; // CreateDashboard, UpdateDataSet, ...
  kind: 'view' | 'mutation';
  action?: ActionCategory;
  user: string;
  resourceType?: TimelineResourceType; // catalog asset type, 'other', or undefined
  assetType?: AssetType; // set only when resourceType is a catalog asset (for navigation)
  assetId?: string;
  assetName?: string; // hydrated from catalog; undefined if catalog doesn't know the asset
  arn?: string;
  /** The stored MinimalEvent, verbatim — powers the per-event JSON view. */
  raw?: MinimalEvent;
}

/**
 * Query params accepted by the /activity/timeline endpoint.
 * For per-asset routes, assetType and assetId are pinned by the URL and
 * the remaining fields narrow further.
 */
export interface TimelineQuery {
  cursor?: string; // ISO timestamp — returns events strictly older than this
  limit?: number; // default 50, max 200
  resourceTypes?: TimelineResourceType[]; // filter by catalog asset type or 'other'
  users?: string[];
  eventNames?: string[]; // include — when set, only these events match
  excludeEventNames?: string[]; // exclude — events in this list are dropped
  actions?: ActionCategory[];
  startDate?: string; // ISO
  endDate?: string; // ISO
  assetId?: string; // pinned by URL for per-asset route
  assetType?: AssetType; // pinned by URL for per-asset route
}

/**
 * Paginated timeline response. nextCursor is the ISO timestamp of the last
 * item in `items` — pass it back on the next request to continue scrolling.
 * nextCursor is null when there are no more events.
 */
export interface TimelinePage {
  items: TimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
  /**
   * ISO timestamp of when the activity cache was last refreshed via the
   * /activity/refresh job. Populated on every request so the UI can show a
   * "last refreshed X ago" hint without a second round-trip.
   */
  cacheLastUpdated?: string;
}
