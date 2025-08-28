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

// Minimal event structure for storage (extensible for any event type)
export interface MinimalEvent {
  t: string; // time (ISO string)
  e: string; // event name (GetDashboard, GetAnalysis, etc)
  u: string; // user (userName or ARN)
  r?: string; // resource id (dashboardId, analysisId, etc)
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
