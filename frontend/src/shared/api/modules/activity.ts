import { components } from '@shared/generated/types';

import { api } from '../client';
import { ApiResponse } from '../types';

type ActivityData = components['schemas']['ActivityData'];
type UserActivity = components['schemas']['UserActivity'];
type ResolvedRecipient = components['schemas']['ResolvedRecipient'];
type UserInactiveAnalysis = components['schemas']['UserInactiveAnalysis'];
type UserUnusedDataset = components['schemas']['UserUnusedDataset'];
export type TimelineEvent = components['schemas']['TimelineEvent'];
export type TimelinePage = components['schemas']['TimelinePage'];

/** Query params for the activity timeline endpoints. */
export interface TimelineQueryParams {
  cursor?: string;
  limit?: number;
  resourceTypes?: string[];
  users?: string[];
  eventNames?: string[];
  actions?: string[];
  startDate?: string;
  endDate?: string;
}

/**
 * The backend accepts comma-separated arrays as query params.
 * Strip empty arrays so they don't become `?users=&` on the wire.
 */
function buildTimelineQueryString(params: TimelineQueryParams): Record<string, string | undefined> {
  return {
    cursor: params.cursor,
    limit: params.limit?.toString(),
    resourceTypes: params.resourceTypes?.length ? params.resourceTypes.join(',') : undefined,
    users: params.users?.length ? params.users.join(',') : undefined,
    eventNames: params.eventNames?.length ? params.eventNames.join(',') : undefined,
    actions: params.actions?.length ? params.actions.join(',') : undefined,
    startDate: params.startDate,
    endDate: params.endDate,
  };
}

export interface RecipientsData {
  users: ResolvedRecipient[];
  groups: Array<{ groupName: string; members: ResolvedRecipient[] }>;
}

export const activityApi = {
  /**
   * Refresh activity data for specified asset types
   * Now returns a job that runs in the background
   */
  async refreshActivity(params: {
    assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
    days?: number;
  }): Promise<{
    jobId: string;
    status: string;
    message: string;
  }> {
    const response = await api.post<ApiResponse<any>>(
      '/activity/refresh',
      params
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to start activity refresh job');
    }
    return response.data.data;
  },

  /**
   * Get activity data for a specific asset
   */
  async getActivityData(assetType: 'dashboard' | 'analysis' | 'user', assetId: string): Promise<ActivityData | UserActivity> {
    const response = await api.get<ApiResponse<ActivityData | UserActivity>>(
      `/activity/${assetType}/${assetId}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch activity data');
    }
    return response.data.data;
  },

  /**
   * Get activity summary
   */
  async getActivitySummary(days?: number): Promise<{
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
  }> {
    const response = await api.get<ApiResponse<any>>('/activity/summary', {
      params: { days }
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch activity summary');
    }
    return response.data.data;
  },

  /**
   * Refresh dashboard view statistics (legacy compatibility)
   */
  async refreshDashboardViews(dashboardIds?: string[], days: number = 90): Promise<any> {
    return this.refreshActivity({ 
      assetTypes: dashboardIds ? ['dashboard'] : ['all'], 
      days 
    });
  },

  /**
   * Refresh analysis view statistics
   */
  async refreshAnalysisViews(analysisIds?: string[], days: number = 90): Promise<any> {
    return this.refreshActivity({ 
      assetTypes: analysisIds ? ['analysis'] : ['all'], 
      days 
    });
  },

  /**
   * Get dashboard view statistics
   */
  async getDashboardViewStats(dashboardId: string): Promise<ActivityData> {
    return this.getActivityData('dashboard', dashboardId) as Promise<ActivityData>;
  },

  /**
   * Get analysis view statistics
   */
  async getAnalysisViewStats(analysisId: string): Promise<ActivityData> {
    return this.getActivityData('analysis', analysisId) as Promise<ActivityData>;
  },

  /**
   * Get user activity
   */
  async getUserActivity(userName: string): Promise<UserActivity> {
    return this.getActivityData('user', userName) as Promise<UserActivity>;
  },

  /**
   * Resolve asset permissions to recipient emails for mailto composition
   */
  async resolveRecipients(
    assetType: 'dashboard' | 'analysis',
    assetId: string
  ): Promise<RecipientsData> {
    const response = await api.post<ApiResponse<RecipientsData>>(
      '/activity/recipients',
      { assetType, assetId }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to resolve recipients');
    }
    return response.data.data;
  },

  /**
   * Get inactive analyses owned by a specific user
   */
  async getUserInactiveAnalyses(userName: string): Promise<UserInactiveAnalysis[]> {
    const response = await api.post<ApiResponse<{ analyses: UserInactiveAnalysis[] }>>(
      '/activity/user-inactive-analyses',
      { userName }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch user inactive analyses');
    }
    return response.data.data.analyses;
  },

  /**
   * Get unused datasets owned by a specific user
   */
  async getUserUnusedDatasets(userName: string): Promise<UserUnusedDataset[]> {
    const response = await api.post<ApiResponse<{ datasets: UserUnusedDataset[] }>>(
      '/activity/user-unused-datasets',
      { userName }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch user unused datasets');
    }
    return response.data.data.datasets;
  },

  /**
   * Get a page of activity timeline events (global feed of QuickSight mutations).
   * Cursor-based pagination: pass the `nextCursor` from the previous response.
   */
  async getTimeline(params: TimelineQueryParams = {}): Promise<TimelinePage> {
    const response = await api.get<ApiResponse<TimelinePage>>('/activity/timeline', {
      params: buildTimelineQueryString(params),
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch activity timeline');
    }
    return response.data.data;
  },

  /**
   * Get a page of activity timeline events pre-filtered to one catalog asset.
   * Used by the per-asset drill-down from the asset table's actions menu.
   */
  async getAssetTimeline(
    assetType: 'dashboard' | 'analysis' | 'dataset' | 'datasource' | 'folder' | 'group' | 'user',
    assetId: string,
    params: TimelineQueryParams = {}
  ): Promise<TimelinePage> {
    const response = await api.get<ApiResponse<TimelinePage>>(
      `/activity/timeline/${assetType}/${encodeURIComponent(assetId)}`,
      { params: buildTimelineQueryString(params) }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to fetch asset activity timeline');
    }
    return response.data.data;
  },
};