import { components } from '@shared/generated/types';

import { api } from '../client';
import { ApiResponse } from '../types';

type ActivityData = components['schemas']['ActivityData'];
type UserActivity = components['schemas']['UserActivity'];
type ResolvedRecipient = components['schemas']['ResolvedRecipient'];

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
};