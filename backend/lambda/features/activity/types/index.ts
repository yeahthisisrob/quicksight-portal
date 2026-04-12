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

export interface ActivityCacheEntry {
  assetId: string;
  assetType: 'dashboard' | 'analysis' | 'user';
  data: ActivityData | UserActivity;
  lastRefreshed: string;
  refreshedDays: number;
  // Preserved fields - these persist across refreshes
  preserved: {
    lastActivityDate?: string; // Last time this asset had any activity (persists forever)
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
 * Kind of a CloudTrail event: 'v' = view (Get/Describe), 'm' = mutation (Create/Update/Delete/...).
 * Missing field is treated as 'v' for backward compatibility with pre-timeline cache entries.
 */
export type EventKind = 'v' | 'm';

/**
 * Resource type for a timeline event. Extends the portal's AssetType (7 catalog types)
 * with 'other' for QuickSight resources the catalog doesn't track — templates, themes,
 * brands, topics, action connectors, VPC connections, namespaces, and account-level
 * settings mutations. 'other' events render in the timeline but without an asset chip
 * or click-through link.
 */
export type TimelineResourceType = AssetType | 'other';

// Minimal event structure for storage (extensible for any event type)
export interface MinimalEvent {
  t: string; // time (ISO string)
  e: string; // event name (GetDashboard, GetAnalysis, etc)
  u: string; // user (userName or ARN)
  r?: string; // resource id (dashboardId, analysisId, etc)
  n?: string; // asset name captured from the CloudTrail event itself (request/response)
  k?: EventKind; // kind — missing = 'v' (backward-compat)
  a?: ActionCategory; // derived action category (mutations only)
  at?: TimelineResourceType; // resource type this event targets — catalog asset type or 'other'
  m?: any; // metadata (optional, for future event types)
}

// Activity cache - stores raw events grouped by date
export interface ActivityCache {
  version: string;
  lastUpdated: string;
  dateRange: {
    start: string;
    end: string;
  };
  // Events grouped by date for efficiency
  events: {
    [date: string]: MinimalEvent[]; // "2025-07-21": [...]
  };
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
