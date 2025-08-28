import { subDays } from 'date-fns';

import { type CloudTrailAdapter } from '../../../adapters/aws/CloudTrailAdapter';
import { type CacheService } from '../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import { ASSET_TYPES, type AssetType } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import { type GroupService } from '../../organization/services/GroupService';
import {
  type ActivityRefreshRequest,
  type ActivityRefreshResponse,
  type ActivitySummaryResponse,
  type ActivityCache,
  type MinimalEvent,
  type AssetActivityData,
  type UserActivityData,
} from '../types';

/**
 * Activity service constants
 */
const ACTIVITY_CONSTANTS = {
  // Time limits
  MAX_LOOKBACK_DAYS: 90,

  // CloudTrail event sources
  QUICKSIGHT_EVENT_SOURCE: 'quicksight.amazonaws.com',

  // Cache version
  CACHE_VERSION: '2.0',
  PERSISTENCE_VERSION: '1.0',

  // String patterns
  SESSION_SEPARATOR: '/',
  SSO_PREFIX: 'AWSReservedSSO_',
  DATE_SEPARATOR: 'T',
  COLON_SEPARATOR: ':',
  UNKNOWN_USER: 'Unknown',
} as const;

/**
 * Asset type configurations for event processing
 */
const ASSET_EVENT_CONFIG = {
  dashboard: {
    events: ['GetDashboard', 'GetDashboardEmbedUrl'],
    extractId: (event: any) => {
      const id =
        event.requestParameters?.dashboardId ||
        event.serviceEventDetails?.eventRequestDetails?.dashboardId ||
        event.serviceEventDetails?.dashboardId ||
        event.serviceEventDetails?.eventRequestDetails?.DashboardId ||
        event.requestParameters?.DashboardId;
      return id ? id.split('/').pop() : null;
    },
  },
  analysis: {
    events: ['GetAnalysis'],
    extractId: (event: any) => {
      const id =
        event.requestParameters?.analysisId ||
        event.serviceEventDetails?.eventRequestDetails?.analysisId ||
        event.serviceEventDetails?.analysisId ||
        event.serviceEventDetails?.eventRequestDetails?.AnalysisId ||
        event.requestParameters?.AnalysisId;
      return id ? id.split('/').pop() : null;
    },
  },
} as const;

export class ActivityService {
  private static readonly ANALYSIS_EVENTS = [...ASSET_EVENT_CONFIG.analysis.events];
  private static readonly DASHBOARD_EVENTS = [...ASSET_EVENT_CONFIG.dashboard.events];

  /**
   * Check if event is analysis-related
   */
  private static isAnalysisEvent(eventName: string): eventName is 'GetAnalysis' {
    return (ActivityService.ANALYSIS_EVENTS as string[]).includes(eventName);
  }

  /**
   * Check if event is dashboard-related
   */
  private static isDashboardEvent(
    eventName: string
  ): eventName is 'GetDashboard' | 'GetDashboardEmbedUrl' {
    return (ActivityService.DASHBOARD_EVENTS as string[]).includes(eventName);
  }

  constructor(
    private readonly cacheService: CacheService,
    private readonly cloudTrailAdapter: CloudTrailAdapter,
    private readonly groupService?: GroupService
  ) {}

  /**
   * Get activity summary across all assets
   */
  public async getActivitySummary(): Promise<ActivitySummaryResponse> {
    const cache = await this.cacheService.getActivityCache();

    if (!cache) {
      return this.getEmptyActivitySummary();
    }

    const stats = this.computeActivityStats(cache);
    return this.buildActivitySummaryResponse(stats);
  }

  /**
   * Get activity data for a specific asset
   */
  public async getAssetActivity(
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
    assetId: string
  ): Promise<AssetActivityData | null> {
    const cache = await this.cacheService.getActivityCache();
    const persistence = await this.cacheService.getActivityPersistence();

    if (!cache) {
      return null;
    }

    const activityData = this.processAssetActivityEvents(cache, assetType, assetId);
    const lastViewed =
      activityData.lastViewed || this.getPersistedDate(persistence, assetType, assetId);

    if (!lastViewed) {
      return null;
    }

    const assetName = await this.getAssetNameFromCache(assetType, assetId);

    // Get user groups for all viewers efficiently
    const viewerNames = Array.from(activityData.viewers.keys());
    const userGroupsMap = await this.getUserGroupsMap(viewerNames);

    return this.buildAssetActivityResponse(
      assetId,
      assetName,
      assetType,
      activityData,
      lastViewed,
      userGroupsMap
    );
  }

  /**
   * Get activity counts for multiple assets (for asset listing APIs)
   */
  public async getAssetActivityCounts(
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
    assetIds: string[]
  ): Promise<Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }>> {
    const cache = await this.cacheService.getActivityCache();
    const persistence = await this.cacheService.getActivityPersistence();

    if (!cache) {
      return this.createEmptyAssetActivityResults(assetIds);
    }

    const relevantEvents = this.getRelevantEventsForAssetType(assetType);
    const results = this.initializeAssetActivityResults(assetIds);
    const assetViewers = this.processEventsForAssetCounts(cache, relevantEvents, assetIds, results);

    this.updateUniqueViewerCounts(results, assetViewers);
    this.addPersistedDatesForAssets(persistence, assetType, assetIds, results);

    return results;
  }

  /**
   * Get user activity data
   */
  public async getUserActivity(userName: string): Promise<UserActivityData | null> {
    const cache = await this.cacheService.getActivityCache();
    const persistence = await this.cacheService.getActivityPersistence();

    if (!cache) {
      return null;
    }

    const activityData = this.processUserActivityEvents(cache, userName);
    const lastActive = activityData.lastActive || this.findPersistedUserDate(persistence, userName);

    if (!lastActive) {
      return null;
    }

    const assetNames = await this.getAssetNamesForUser();
    return this.buildUserActivityResponse(userName, lastActive, activityData, assetNames);
  }

  /**
   * Get user activity counts for multiple users (for user listing APIs)
   */
  public async getUserActivityCounts(
    userNames: string[]
  ): Promise<
    Map<
      string,
      { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
    >
  > {
    const cache = await this.cacheService.getActivityCache();
    const persistence = await this.cacheService.getActivityPersistence();

    if (!cache) {
      logger.warn('No activity cache found for getUserActivityCounts');
      return this.createEmptyUserActivityResults(userNames);
    }

    const results = this.initializeUserActivityResults(userNames);
    const { userDashboards, userAnalyses } = this.processEventsForUserCounts(
      cache,
      userNames,
      results
    );

    this.updateUniqueAssetCounts(userNames, results, userDashboards, userAnalyses);
    this.addPersistedDatesForUsers(persistence, userNames, results);

    return results;
  }

  /**
   * Refresh activity data for specified asset types
   */
  public async refreshActivity(request: ActivityRefreshRequest): Promise<ActivityRefreshResponse> {
    try {
      const days = Math.min(
        request.days || ACTIVITY_CONSTANTS.MAX_LOOKBACK_DAYS,
        ACTIVITY_CONSTANTS.MAX_LOOKBACK_DAYS
      );

      logger.info('Starting activity refresh', {
        assetTypes: request.assetTypes,
        days,
      });

      // Step 1: Fetch new events from CloudTrail
      const endTime = new Date();
      const startTime = subDays(endTime, days);
      const newEvents = await this.fetchEventsFromCloudTrail(
        startTime,
        endTime,
        request.assetTypes
      );

      logger.info('Fetched events from CloudTrail', {
        eventCount: newEvents.length,
        dateRange: { start: startTime, end: endTime },
      });

      // Step 2: Build new cache with events
      const updatedCache = this.buildActivityCache(newEvents, startTime, endTime);

      // Step 3: Update persistence with latest activity dates
      await this.updatePersistence(updatedCache);

      // Step 4: Save cache
      await this.cacheService.putActivityCache(updatedCache);

      // Step 5: Count affected items
      const counts = this.countAffectedItems(updatedCache, request.assetTypes);

      return {
        success: true,
        message: `Successfully refreshed activity data for ${counts.total} items`,
        refreshed: counts.refreshed,
      };
    } catch (error) {
      logger.error('Error refreshing activity', {
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
              }
            : error,
      });
      return {
        success: false,
        message: `Error refreshing activity: ${error instanceof Error ? error.message : 'Unknown error'}`,
        refreshed: {},
      };
    }
  }

  /**
   * Add persisted dates for assets with no recent activity
   */
  private addPersistedDatesForAssets(
    persistence: any,
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
    assetIds: string[],
    results: Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }>
  ): void {
    if (!persistence) {
      return;
    }

    const persistedDates =
      assetType === ASSET_TYPES.dashboard ? persistence.dashboards : persistence.analyses;

    for (const assetId of assetIds) {
      const current = results.get(assetId);
      if (current && !current.lastViewed && persistedDates[assetId]) {
        current.lastViewed = persistedDates[assetId];
      }
    }
  }

  /**
   * Add persisted dates for users with no recent activity
   */
  private addPersistedDatesForUsers(
    persistence: any,
    userNames: string[],
    results: Map<
      string,
      { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
    >
  ): void {
    if (!persistence) {
      return;
    }

    for (const userName of userNames) {
      const current = results.get(userName);
      if (!current?.lastActive) {
        const persistedDate = this.findPersistedUserDate(persistence, userName);
        if (current && persistedDate) {
          current.lastActive = persistedDate;
        }
      }
    }
  }

  /**
   * Add asset to user's asset set
   */
  private addToUserAssetSet(
    assetMap: Map<string, Set<string>>,
    userName: string,
    assetId: string
  ): void {
    if (!assetMap.has(userName)) {
      assetMap.set(userName, new Set());
    }
    const assets = assetMap.get(userName);
    if (assets) {
      assets.add(assetId);
    }
  }

  /**
   * Build activity cache from events
   */
  private buildActivityCache(
    events: MinimalEvent[],
    startTime: Date,
    endTime: Date
  ): ActivityCache {
    // Group events by date
    const eventsByDate: { [date: string]: MinimalEvent[] } = {};

    for (const event of events) {
      const datePart = event.t.split(ACTIVITY_CONSTANTS.DATE_SEPARATOR)[0];
      if (datePart) {
        if (!eventsByDate[datePart]) {
          eventsByDate[datePart] = [];
        }
        eventsByDate[datePart].push(event);
      }
    }

    return {
      version: ACTIVITY_CONSTANTS.CACHE_VERSION,
      lastUpdated: new Date().toISOString(),
      dateRange: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
      },
      events: eventsByDate,
    };
  }

  /**
   * Build activity summary response from computed statistics
   */
  private buildActivitySummaryResponse(stats: {
    dashboardStats: Map<string, Set<string>>;
    analysisStats: Map<string, Set<string>>;
    userStats: Map<string, number>;
    dashboardViews: number;
    analysisViews: number;
  }): ActivitySummaryResponse {
    // Compute unique viewers across all dashboards
    const allDashboardViewers = this.getAllViewers(stats.dashboardStats);
    const allAnalysisViewers = this.getAllViewers(stats.analysisStats);

    return {
      dashboards: {
        totalViews: stats.dashboardViews,
        uniqueViewers: allDashboardViewers.size,
        activeAssets: stats.dashboardStats.size,
      },
      analyses: {
        totalViews: stats.analysisViews,
        uniqueViewers: allAnalysisViewers.size,
        activeAssets: stats.analysisStats.size,
      },
      users: {
        activeUsers: stats.userStats.size,
        totalActivities: Array.from(stats.userStats.values()).reduce(
          (sum, count) => sum + count,
          0
        ),
      },
    };
  }

  /**
   * Build asset activity response
   */
  private buildAssetActivityResponse(
    assetId: string,
    assetName: string | undefined,
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
    activityData: {
      viewers: Map<string, { count: number; lastViewed: string }>;
      viewsByDate: Map<string, number>;
      totalViews: number;
      lastViewed: string;
    },
    lastViewed: string,
    userGroupsMap: Map<string, string[]>
  ): AssetActivityData {
    const viewersArray = Array.from(activityData.viewers.entries())
      .map(([userName, stats]) => ({
        userName,
        viewCount: stats.count,
        lastViewed: stats.lastViewed,
        groups: userGroupsMap.get(userName) || [],
      }))
      .sort((a, b) => b.viewCount - a.viewCount);

    return {
      assetId,
      assetName,
      assetType,
      totalViews: activityData.totalViews,
      uniqueViewers: activityData.viewers.size,
      lastViewed,
      viewsByDate: Object.fromEntries(activityData.viewsByDate),
      viewers: viewersArray,
    };
  }

  /**
   * Build user activity response
   */
  private buildUserActivityResponse(
    userName: string,
    lastActive: string,
    activityData: {
      dashboards: Map<string, { count: number; lastViewed: string }>;
      analyses: Map<string, { count: number; lastViewed: string }>;
      activitiesByDate: Map<string, number>;
      totalActivities: number;
      lastActive: string;
    },
    assetNames: {
      dashboardNames: { [id: string]: string };
      analysisNames: { [id: string]: string };
    }
  ): UserActivityData {
    const dashboardsArray = this.convertToAssetArray(
      activityData.dashboards,
      assetNames.dashboardNames,
      ASSET_TYPES.dashboard
    );
    const analysesArray = this.convertToAssetArray(
      activityData.analyses,
      assetNames.analysisNames,
      ASSET_TYPES.analysis
    );

    return {
      userName,
      lastActive,
      totalActivities: activityData.totalActivities,
      activitiesByDate: Object.fromEntries(activityData.activitiesByDate),
      dashboards: dashboardsArray,
      analyses: analysesArray,
    };
  }

  /**
   * Compute activity statistics from cache events
   */
  private computeActivityStats(cache: ActivityCache): {
    dashboardStats: Map<string, Set<string>>;
    analysisStats: Map<string, Set<string>>;
    userStats: Map<string, number>;
    dashboardViews: number;
    analysisViews: number;
  } {
    const dashboardStats = new Map<string, Set<string>>(); // dashboardId -> Set of viewers
    const analysisStats = new Map<string, Set<string>>(); // analysisId -> Set of viewers
    const userStats = new Map<string, number>(); // userName -> activity count
    let dashboardViews = 0;
    let analysisViews = 0;

    for (const events of Object.values(cache.events)) {
      for (const event of events as MinimalEvent[]) {
        // Track user activity
        userStats.set(event.u, (userStats.get(event.u) || 0) + 1);

        // Track dashboard activity
        if (ActivityService.isDashboardEvent(event.e) && event.r) {
          dashboardViews++;
          this.updateAssetStats(dashboardStats, event.r, event.u);
        }

        // Track analysis activity
        if (ActivityService.isAnalysisEvent(event.e) && event.r) {
          analysisViews++;
          this.updateAssetStats(analysisStats, event.r, event.u);
        }
      }
    }

    return {
      dashboardStats,
      analysisStats,
      userStats,
      dashboardViews,
      analysisViews,
    };
  }

  /**
   * Convert asset map to array for response
   */
  private convertToAssetArray(
    assetMap: Map<string, { count: number; lastViewed: string }>,
    assetNames: { [id: string]: string },
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>
  ): any[] {
    return Array.from(assetMap.entries())
      .map(([id, stats]) => ({
        [`${assetType}Id`]: id,
        [`${assetType}Name`]: assetNames[id],
        viewCount: stats.count,
        lastViewed: stats.lastViewed,
      }))
      .sort((a, b) => b.viewCount - a.viewCount);
  }

  /**
   * Convert raw CloudTrail events to minimal format
   */
  private convertToMinimalEvents(rawEvents: any[], eventType: string): MinimalEvent[] {
    const minimalEvents: MinimalEvent[] = [];

    for (const rawEvent of rawEvents) {
      try {
        // Parse nested JSON if needed
        let event = rawEvent;
        if (rawEvent.CloudTrailEvent && typeof rawEvent.CloudTrailEvent === 'string') {
          event = JSON.parse(rawEvent.CloudTrailEvent);
        }

        // Skip non-QuickSight events
        if (event.eventSource !== ACTIVITY_CONSTANTS.QUICKSIGHT_EVENT_SOURCE) {
          continue;
        }

        // Extract minimal data
        const minimalEvent: MinimalEvent = {
          t: event.eventTime || rawEvent.EventTime,
          e: eventType,
          u: this.extractUserName(event) || ACTIVITY_CONSTANTS.UNKNOWN_USER,
        };

        // Extract resource ID based on event type
        if (ActivityService.isDashboardEvent(eventType)) {
          const dashboardId = ASSET_EVENT_CONFIG.dashboard.extractId(event);
          if (dashboardId) {
            minimalEvent.r = dashboardId;
          }
        } else if (ActivityService.isAnalysisEvent(eventType)) {
          const analysisId = ASSET_EVENT_CONFIG.analysis.extractId(event);
          if (analysisId) {
            minimalEvent.r = analysisId;
          }
        }

        if (minimalEvent.t && minimalEvent.r) {
          minimalEvents.push(minimalEvent);
        }
      } catch (error) {
        logger.debug('Failed to process event', { error });
      }
    }

    return minimalEvents;
  }

  /**
   * Count affected items in the cache
   */
  private countAffectedItems(
    cache: ActivityCache,
    assetTypes: string[]
  ): { refreshed: any; total: number } {
    const dashboards = new Set<string>();
    const analyses = new Set<string>();
    const users = new Set<string>();

    for (const events of Object.values(cache.events)) {
      for (const event of events as MinimalEvent[]) {
        if (event.r) {
          if (ActivityService.isDashboardEvent(event.e)) {
            dashboards.add(event.r);
          } else if (ActivityService.isAnalysisEvent(event.e)) {
            analyses.add(event.r);
          }
        }
        users.add(event.u);
      }
    }

    const refreshed: any = {};
    if (assetTypes.includes(ASSET_TYPES.dashboard) || assetTypes.includes('all')) {
      refreshed.dashboards = dashboards.size;
    }
    if (assetTypes.includes(ASSET_TYPES.analysis) || assetTypes.includes('all')) {
      refreshed.analyses = analyses.size;
    }
    if (assetTypes.includes(ASSET_TYPES.user) || assetTypes.includes('all')) {
      refreshed.users = users.size;
    }

    return {
      refreshed,
      total: dashboards.size + analyses.size + users.size,
    };
  }

  /**
   * Create empty results map for asset activity
   */
  private createEmptyAssetActivityResults(
    assetIds: string[]
  ): Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }> {
    const results = new Map<
      string,
      { totalViews: number; uniqueViewers: number; lastViewed: string }
    >();
    for (const assetId of assetIds) {
      results.set(assetId, { totalViews: 0, uniqueViewers: 0, lastViewed: '' });
    }
    return results;
  }

  /**
   * Create empty results map for user activity
   */
  private createEmptyUserActivityResults(
    userNames: string[]
  ): Map<
    string,
    { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
  > {
    const results = new Map<
      string,
      { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
    >();
    for (const userName of userNames) {
      results.set(userName, {
        totalActivities: 0,
        lastActive: '',
        dashboardCount: 0,
        analysisCount: 0,
      });
    }
    return results;
  }

  /**
   * Extract user name from event
   */
  private extractUserName(event: any): string | null {
    // For SSO users, construct the full username from sessionContext
    if (
      event.userIdentity?.sessionContext?.sessionIssuer?.userName &&
      event.userIdentity?.principalId
    ) {
      const sessionName = event.userIdentity.principalId.split(
        ACTIVITY_CONSTANTS.COLON_SEPARATOR
      )[1];
      if (sessionName) {
        return `${event.userIdentity.sessionContext.sessionIssuer.userName}${ACTIVITY_CONSTANTS.SESSION_SEPARATOR}${sessionName}`;
      }
    }

    // Direct userName (for non-SSO users)
    if (event.userIdentity?.userName) {
      return event.userIdentity.userName;
    }

    // Fallback to ARN if no userName
    if (event.userIdentity?.arn) {
      const parts = event.userIdentity.arn.split(ACTIVITY_CONSTANTS.SESSION_SEPARATOR);
      return parts[parts.length - 1];
    }

    return null;
  }

  /**
   * Fetch events from CloudTrail based on requested asset types
   */
  private async fetchEventsFromCloudTrail(
    startTime: Date,
    endTime: Date,
    assetTypes: string[]
  ): Promise<MinimalEvent[]> {
    const allEvents: MinimalEvent[] = [];
    const eventTypesToFetch = new Set<string>();

    // Determine which event types to fetch
    for (const assetType of assetTypes) {
      if (assetType === 'all' || assetType === ASSET_TYPES.dashboard) {
        ActivityService.DASHBOARD_EVENTS.forEach((e) => eventTypesToFetch.add(e));
      }
      if (assetType === 'all' || assetType === ASSET_TYPES.analysis) {
        ActivityService.ANALYSIS_EVENTS.forEach((e) => eventTypesToFetch.add(e));
      }
      // User activity comes from all event types
      if (assetType === 'all' || assetType === ASSET_TYPES.user) {
        ActivityService.DASHBOARD_EVENTS.forEach((e) => eventTypesToFetch.add(e));
        ActivityService.ANALYSIS_EVENTS.forEach((e) => eventTypesToFetch.add(e));
      }
    }

    // Fetch events
    for (const eventType of Array.from(eventTypesToFetch)) {
      const rawEvents = await this.cloudTrailAdapter.getEventsByName(eventType, startTime, endTime);

      const minimalEvents = this.convertToMinimalEvents(rawEvents, eventType);
      allEvents.push(...minimalEvents);
    }

    return allEvents;
  }

  /**
   * Find matching user from userNames list
   */
  private findMatchingUser(eventUser: string, userNames: string[]): string | null {
    for (const userName of userNames) {
      if (this.userMatches(eventUser, userName)) {
        return userName;
      }
    }
    return null;
  }

  /**
   * Find persisted date for user
   */
  private findPersistedUserDate(persistence: any, userName: string): string | null {
    // Check direct match first
    if (persistence.users[userName]) {
      return persistence.users[userName];
    }

    // Check all persisted users for matches
    for (const [persistedUser, persistedDate] of Object.entries(persistence.users)) {
      if (this.userMatches(persistedUser, userName)) {
        return persistedDate as string;
      }
    }

    return null;
  }

  /**
   * Get all unique viewers from asset statistics
   */
  private getAllViewers(assetStats: Map<string, Set<string>>): Set<string> {
    const allViewers = new Set<string>();
    for (const viewers of Array.from(assetStats.values())) {
      Array.from(viewers).forEach((v) => allViewers.add(v));
    }
    return allViewers;
  }

  /**
   * Get asset name from master cache
   */
  private async getAssetNameFromCache(
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
    assetId: string
  ): Promise<string | undefined> {
    try {
      const assetEntries = await this.cacheService.getCacheEntries({
        assetType,
        statusFilter: AssetStatusFilter.ALL,
      });
      const asset = assetEntries.find((a: any) => a.assetId === assetId);
      return asset?.assetName;
    } catch (error) {
      logger.debug('Failed to get asset name from cache', { error });
      return undefined;
    }
  }

  /**
   * Get asset names for user activity
   */
  private async getAssetNamesForUser(): Promise<{
    dashboardNames: { [id: string]: string };
    analysisNames: { [id: string]: string };
  }> {
    const dashboardNames: { [id: string]: string } = {};
    const analysisNames: { [id: string]: string } = {};

    try {
      const [dashboards, analyses] = await Promise.all([
        this.cacheService.getCacheEntries({
          assetType: ASSET_TYPES.dashboard,
          statusFilter: AssetStatusFilter.ALL,
        }),
        this.cacheService.getCacheEntries({
          assetType: ASSET_TYPES.analysis,
          statusFilter: AssetStatusFilter.ALL,
        }),
      ]);

      dashboards.forEach((d: any) => {
        dashboardNames[d.assetId] = d.assetName;
      });

      analyses.forEach((a: any) => {
        analysisNames[a.assetId] = a.assetName;
      });
    } catch (error) {
      logger.debug('Failed to get asset names from cache', { error });
    }

    return { dashboardNames, analysisNames };
  }

  /**
   * Get empty activity summary structure
   */
  private getEmptyActivitySummary(): ActivitySummaryResponse {
    return {
      dashboards: { totalViews: 0, uniqueViewers: 0, activeAssets: 0 },
      analyses: { totalViews: 0, uniqueViewers: 0, activeAssets: 0 },
      users: { activeUsers: 0, totalActivities: 0 },
    };
  }

  /**
   * Get persisted date for asset from persistence cache
   */
  private getPersistedDate(
    persistence: any,
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
    assetId: string
  ): string | undefined {
    if (!persistence) {
      return undefined;
    }
    const persistedDate =
      assetType === ASSET_TYPES.dashboard
        ? persistence.dashboards[assetId]
        : persistence.analyses[assetId];
    return persistedDate || undefined;
  }

  /**
   * Get relevant events for asset type
   */
  private getRelevantEventsForAssetType(
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>
  ): string[] {
    return assetType === ASSET_TYPES.dashboard
      ? ActivityService.DASHBOARD_EVENTS
      : ActivityService.ANALYSIS_EVENTS;
  }

  /**
   * Get user groups map for efficient lookup
   */
  private async getUserGroupsMap(userNames: string[]): Promise<Map<string, string[]>> {
    const userGroupsMap = new Map<string, string[]>();

    // If GroupService is not available, return empty groups
    if (!this.groupService) {
      for (const userName of userNames) {
        userGroupsMap.set(userName, []);
      }
      return userGroupsMap;
    }

    // Get groups for each user using GroupService
    for (const userName of userNames) {
      const userGroups = await this.groupService.getUserGroups(userName);
      const groupNames = userGroups.map((g) => g.groupName);
      userGroupsMap.set(userName, groupNames);
    }

    return userGroupsMap;
  }

  /**
   * Initialize asset activity results
   */
  private initializeAssetActivityResults(
    assetIds: string[]
  ): Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }> {
    return this.createEmptyAssetActivityResults(assetIds);
  }

  /**
   * Initialize user activity results
   */
  private initializeUserActivityResults(
    userNames: string[]
  ): Map<
    string,
    { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
  > {
    return this.createEmptyUserActivityResults(userNames);
  }

  /**
   * Check if event is relevant for asset counting
   */
  private isRelevantAssetEvent(
    event: MinimalEvent,
    relevantEvents: string[],
    assetIds: string[]
  ): boolean {
    return relevantEvents.includes(event.e) && Boolean(event.r) && event.r
      ? assetIds.includes(event.r)
      : false;
  }

  /**
   * Process activity events for a specific asset
   */
  private processAssetActivityEvents(
    cache: ActivityCache,
    assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
    assetId: string
  ): {
    viewers: Map<string, { count: number; lastViewed: string }>;
    viewsByDate: Map<string, number>;
    totalViews: number;
    lastViewed: string;
  } {
    const viewers = new Map<string, { count: number; lastViewed: string }>();
    const viewsByDate = new Map<string, number>();
    let totalViews = 0;
    let lastViewed = '';

    // Process events
    for (const [date, events] of Object.entries(cache.events)) {
      for (const event of events as MinimalEvent[]) {
        const isRelevant =
          (assetType === ASSET_TYPES.dashboard && ActivityService.isDashboardEvent(event.e)) ||
          (assetType === ASSET_TYPES.analysis && ActivityService.isAnalysisEvent(event.e));

        if (isRelevant && event.r === assetId) {
          totalViews++;
          this.updateViewerInfo(viewers, event.u, event.t);
          viewsByDate.set(date, (viewsByDate.get(date) || 0) + 1);

          if (event.t > lastViewed) {
            lastViewed = event.t;
          }
        }
      }
    }

    return { viewers, viewsByDate, totalViews, lastViewed };
  }

  /**
   * Process events for asset counts and track viewers
   */
  private processEventsForAssetCounts(
    cache: ActivityCache,
    relevantEvents: string[],
    assetIds: string[],
    results: Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }>
  ): Map<string, Set<string>> {
    const assetViewers = new Map<string, Set<string>>();

    for (const events of Object.values(cache.events)) {
      for (const event of events as MinimalEvent[]) {
        if (this.isRelevantAssetEvent(event, relevantEvents, assetIds)) {
          this.updateAssetViewCount(results, event);
          this.trackAssetViewer(assetViewers, event);
        }
      }
    }

    return assetViewers;
  }

  /**
   * Process events for user counts and track unique assets
   */
  private processEventsForUserCounts(
    cache: ActivityCache,
    userNames: string[],
    results: Map<
      string,
      { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
    >
  ): { userDashboards: Map<string, Set<string>>; userAnalyses: Map<string, Set<string>> } {
    const userDashboards = new Map<string, Set<string>>();
    const userAnalyses = new Map<string, Set<string>>();

    for (const [, events] of Object.entries(cache.events)) {
      for (const event of events as MinimalEvent[]) {
        const matchedUserName = this.findMatchingUser(event.u, userNames);

        if (matchedUserName) {
          this.updateUserActivity(results, matchedUserName, event);
          this.trackUserAssets(userDashboards, userAnalyses, matchedUserName, event);
        }
      }
    }

    return { userDashboards, userAnalyses };
  }

  /**
   * Process user activity events from cache
   */
  private processUserActivityEvents(
    cache: ActivityCache,
    userName: string
  ): {
    dashboards: Map<string, { count: number; lastViewed: string }>;
    analyses: Map<string, { count: number; lastViewed: string }>;
    activitiesByDate: Map<string, number>;
    totalActivities: number;
    lastActive: string;
  } {
    const dashboards = new Map<string, { count: number; lastViewed: string }>();
    const analyses = new Map<string, { count: number; lastViewed: string }>();
    const activitiesByDate = new Map<string, number>();
    let totalActivities = 0;
    let lastActive = '';

    // Process events
    for (const [date, events] of Object.entries(cache.events)) {
      const userEvents = (events as MinimalEvent[]).filter((e) => this.userMatches(e.u, userName));

      for (const event of userEvents) {
        totalActivities++;

        if (event.t > lastActive) {
          lastActive = event.t;
        }

        this.trackUserAssetActivity(dashboards, analyses, event);
      }

      // Track activities by date
      if (userEvents.length > 0) {
        activitiesByDate.set(date, userEvents.length);
      }
    }

    return { dashboards, analyses, activitiesByDate, totalActivities, lastActive };
  }

  /**
   * Track unique viewers for each asset
   */
  private trackAssetViewer(assetViewers: Map<string, Set<string>>, event: MinimalEvent): void {
    if (!event.r) {
      return;
    }

    if (!assetViewers.has(event.r)) {
      assetViewers.set(event.r, new Set());
    }
    const viewers = assetViewers.get(event.r);
    if (viewers) {
      viewers.add(event.u);
    }
  }

  /**
   * Track asset activity for user
   */
  private trackUserAssetActivity(
    dashboards: Map<string, { count: number; lastViewed: string }>,
    analyses: Map<string, { count: number; lastViewed: string }>,
    event: MinimalEvent
  ): void {
    // Track dashboards
    if (ActivityService.isDashboardEvent(event.e) && event.r) {
      this.updateAssetActivity(dashboards, event.r, event.t);
    }

    // Track analyses
    if (ActivityService.isAnalysisEvent(event.e) && event.r) {
      this.updateAssetActivity(analyses, event.r, event.t);
    }
  }

  /**
   * Track unique assets accessed by user
   */
  private trackUserAssets(
    userDashboards: Map<string, Set<string>>,
    userAnalyses: Map<string, Set<string>>,
    userName: string,
    event: MinimalEvent
  ): void {
    if (ActivityService.isDashboardEvent(event.e) && event.r) {
      this.addToUserAssetSet(userDashboards, userName, event.r);
    }

    if (ActivityService.isAnalysisEvent(event.e) && event.r) {
      this.addToUserAssetSet(userAnalyses, userName, event.r);
    }
  }

  /**
   * Update asset activity tracking
   */
  private updateAssetActivity(
    assetMap: Map<string, { count: number; lastViewed: string }>,
    assetId: string,
    eventTime: string
  ): void {
    if (!assetMap.has(assetId)) {
      assetMap.set(assetId, { count: 0, lastViewed: '' });
    }
    const asset = assetMap.get(assetId);
    if (asset) {
      asset.count++;
      if (eventTime > asset.lastViewed) {
        asset.lastViewed = eventTime;
      }
    }
  }

  /**
   * Update asset statistics with viewer information
   */
  private updateAssetStats(
    assetStats: Map<string, Set<string>>,
    assetId: string,
    userId: string
  ): void {
    if (!assetStats.has(assetId)) {
      assetStats.set(assetId, new Set());
    }
    const stats = assetStats.get(assetId);
    if (stats) {
      stats.add(userId);
    }
  }

  /**
   * Update asset view count and last viewed date
   */
  private updateAssetViewCount(
    results: Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }>,
    event: MinimalEvent
  ): void {
    if (!event.r) {
      return;
    }

    const current = results.get(event.r);
    if (current) {
      current.totalViews++;
      if (event.t > current.lastViewed) {
        current.lastViewed = event.t;
      }
    }
  }

  /**
   * Update persistence with latest activity dates
   */
  private async updatePersistence(cache: ActivityCache): Promise<void> {
    const persistence = (await this.cacheService.getActivityPersistence()) || {
      version: ACTIVITY_CONSTANTS.PERSISTENCE_VERSION,
      lastUpdated: new Date().toISOString(),
      dashboards: {},
      analyses: {},
      users: {},
    };

    // Process all events to find latest activity dates
    for (const events of Object.values(cache.events)) {
      for (const event of events as MinimalEvent[]) {
        // Update dashboard dates
        if (ActivityService.isDashboardEvent(event.e) && event.r) {
          if (!persistence.dashboards[event.r] || event.t > persistence.dashboards[event.r]) {
            persistence.dashboards[event.r] = event.t;
          }
        }

        // Update analysis dates
        if (ActivityService.isAnalysisEvent(event.e) && event.r) {
          if (!persistence.analyses[event.r] || event.t > persistence.analyses[event.r]) {
            persistence.analyses[event.r] = event.t;
          }
        }

        // Update user dates
        if (!persistence.users[event.u] || event.t > persistence.users[event.u]) {
          persistence.users[event.u] = event.t;
        }
      }
    }

    persistence.lastUpdated = new Date().toISOString();
    await this.cacheService.putActivityPersistence(persistence);
  }

  /**
   * Update unique asset counts for all users
   */
  private updateUniqueAssetCounts(
    userNames: string[],
    results: Map<
      string,
      { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
    >,
    userDashboards: Map<string, Set<string>>,
    userAnalyses: Map<string, Set<string>>
  ): void {
    for (const userName of userNames) {
      const current = results.get(userName);
      if (current) {
        current.dashboardCount = userDashboards.get(userName)?.size || 0;
        current.analysisCount = userAnalyses.get(userName)?.size || 0;
      }
    }
  }

  /**
   * Update unique viewer counts from tracked viewers
   */
  private updateUniqueViewerCounts(
    results: Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }>,
    assetViewers: Map<string, Set<string>>
  ): void {
    for (const [assetId, viewers] of Array.from(assetViewers)) {
      const current = results.get(assetId);
      if (current) {
        current.uniqueViewers = viewers.size;
      }
    }
  }

  /**
   * Update user activity counts and timestamps
   */
  private updateUserActivity(
    results: Map<
      string,
      { totalActivities: number; lastActive: string; dashboardCount: number; analysisCount: number }
    >,
    userName: string,
    event: MinimalEvent
  ): void {
    const current = results.get(userName);
    if (current) {
      current.totalActivities++;
      if (event.t > current.lastActive) {
        current.lastActive = event.t;
      }
    }
  }

  /**
   * Update viewer information with new event
   */
  private updateViewerInfo(
    viewers: Map<string, { count: number; lastViewed: string }>,
    userId: string,
    eventTime: string
  ): void {
    if (!viewers.has(userId)) {
      viewers.set(userId, { count: 0, lastViewed: '' });
    }
    const viewer = viewers.get(userId);
    if (viewer) {
      viewer.count++;
      if (eventTime > viewer.lastViewed) {
        viewer.lastViewed = eventTime;
      }
    }
  }

  /**
   * Check if an event user matches a requested username
   */
  private userMatches(eventUser: string, requestedUser: string): boolean {
    // Direct match is all we need
    return eventUser === requestedUser;
  }
}
