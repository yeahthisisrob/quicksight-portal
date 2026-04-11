import { subDays } from 'date-fns';
import { vi, type Mocked } from 'vitest';

import { type CloudTrailAdapter } from '../../../../adapters/aws/CloudTrailAdapter';
import { type CacheService } from '../../../../shared/services/cache/CacheService';
import { logger } from '../../../../shared/utils/logger';
import { type GroupService } from '../../../organization/services/GroupService';
import { type ActivityCache, type ActivityRefreshRequest, type MinimalEvent } from '../../types';
import { ActivityService, classifyAction } from '../ActivityService';

// Mock dependencies
vi.mock('../../../../adapters/aws/CloudTrailAdapter');
vi.mock('../../../../shared/services/cache/CacheService');
vi.mock('../../../organization/services/GroupService');
vi.mock('../../../../shared/utils/logger');

// Test constants
const TEST_DASHBOARD_ID = 'dash-123';
const TEST_ANALYSIS_ID = 'anal-456';
const TEST_USER_NAME = 'test-user';
const TEST_DATE = '2024-01-15T10:30:00.000Z';
const EXPECTED_VIEWS = 3;
const EXPECTED_UNIQUE_VIEWERS = 2;
const MAX_LOOKBACK_DAYS = 90;
const TEST_DAYS = 7;
const NUM_EVENTS = 1000;
const EVENT_BATCH_SIZE_2 = 2;
const NUM_USERS = 5;
const NUM_ASSETS = 10;
const DATE_DAY_15 = 15;
const DATE_DAY_INCREMENT = 3;
const PERF_TEST_TIMEOUT_MS = 1000;
const DASHBOARD_EVENT_COUNT = 500;
const ANALYSIS_EVENT_COUNT = 500;
const TOTAL_ACTIVITIES_4 = 4;
const SINGLE_ACTIVITY = 1;
const ZERO_ACTIVITIES = 0;
const MS_PER_DAY = 86400000; // 1000 * 60 * 60 * 24

// Shared test helpers
const createMockEvent = (
  eventName: string,
  resourceId?: string,
  userName = TEST_USER_NAME,
  eventTime = TEST_DATE
): MinimalEvent => ({
  t: eventTime,
  e: eventName,
  u: userName,
  ...(resourceId && { r: resourceId }),
});

const createMockCache = (events: MinimalEvent[] = []): ActivityCache => {
  const eventsByDate: { [date: string]: MinimalEvent[] } = {};

  events.forEach((event) => {
    const date = event.t.split('T')[0];
    if (!date) {
      return;
    }
    if (!eventsByDate[date]) {
      eventsByDate[date] = [];
    }
    eventsByDate[date].push(event);
  });

  return {
    version: '2.0',
    lastUpdated: new Date().toISOString(),
    dateRange: {
      start: subDays(new Date(), TEST_DAYS).toISOString(),
      end: new Date().toISOString(),
    },
    events: eventsByDate,
  };
};

describe('ActivityService - Summary', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      getActivityCache: vi.fn(),
      getActivityPersistence: vi.fn(),
      getCacheEntries: vi.fn(),
    } as any;

    activityService = new ActivityService(mockCacheService, {} as any);
  });

  describe('getActivitySummary', () => {
    it('should return empty summary when no cache exists', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(null);

      const result = await activityService.getActivitySummary();

      expect(result).toEqual({
        dashboards: { totalViews: 0, uniqueViewers: 0, activeAssets: 0 },
        analyses: { totalViews: 0, uniqueViewers: 0, activeAssets: 0 },
        users: { activeUsers: 0, totalActivities: 0 },
      });
    });

    it('should calculate activity summary correctly', async () => {
      const events = [
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user2'),
        createMockEvent('GetDashboard', 'dash-789', 'user1'),
        createMockEvent('GetAnalysis', TEST_ANALYSIS_ID, 'user1'),
      ];

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

      const result = await activityService.getActivitySummary();

      expect(result.dashboards.totalViews).toBe(EXPECTED_VIEWS);
      expect(result.dashboards.uniqueViewers).toBe(EVENT_BATCH_SIZE_2);
      expect(result.dashboards.activeAssets).toBe(EVENT_BATCH_SIZE_2);
      expect(result.analyses.totalViews).toBe(SINGLE_ACTIVITY);
      expect(result.analyses.uniqueViewers).toBe(SINGLE_ACTIVITY);
      expect(result.analyses.activeAssets).toBe(SINGLE_ACTIVITY);
      expect(result.users.activeUsers).toBe(EVENT_BATCH_SIZE_2);
      expect(result.users.totalActivities).toBe(TOTAL_ACTIVITIES_4);
    });
  });
});

describe('ActivityService - Asset Activity', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;
  let mockGroupService: Mocked<GroupService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      getActivityCache: vi.fn(),
      getActivityPersistence: vi.fn(),
      getCacheEntries: vi.fn(),
    } as any;

    mockGroupService = {
      getUserGroups: vi.fn(),
    } as any;

    activityService = new ActivityService(mockCacheService, {} as any, mockGroupService);
  });

  describe('getAssetActivity', () => {
    it('should return null when no cache exists', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(null);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const result = await activityService.getAssetActivity('dashboard', TEST_DASHBOARD_ID);

      expect(result).toBeNull();
    });

    it('should return asset activity data for dashboard', async () => {
      const events = [
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1', '2024-01-15T10:00:00.000Z'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user2', '2024-01-15T11:00:00.000Z'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1', '2024-01-15T12:00:00.000Z'),
      ];

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));
      mockCacheService.getActivityPersistence.mockResolvedValue({
        version: '1.0',
        lastUpdated: TEST_DATE,
        dashboards: {},
        analyses: {},
        users: {},
      });
      mockCacheService.getCacheEntries.mockResolvedValue([
        {
          assetId: TEST_DASHBOARD_ID,
          assetName: 'Test Dashboard',
          assetType: 'dashboard',
          arn: `arn:aws:quicksight:us-east-1:123456789012:dashboard/${TEST_DASHBOARD_ID}`,
          status: 'active',
          enrichmentStatus: 'enriched',
          createdTime: new Date(),
          lastUpdatedTime: new Date(),
          exportedAt: new Date(),
          exportFilePath: `assets/dashboards/${TEST_DASHBOARD_ID}.json`,
          storageType: 'individual',
          tags: [],
          permissions: [],
          metadata: {},
        } as any,
      ]);
      mockGroupService.getUserGroups.mockResolvedValue([]);

      const result = await activityService.getAssetActivity('dashboard', TEST_DASHBOARD_ID);

      expect(result).not.toBeNull();
      expect(result?.assetId).toBe(TEST_DASHBOARD_ID);
      expect(result?.assetName).toBe('Test Dashboard');
      expect(result?.assetType).toBe('dashboard');
      expect(result?.totalViews).toBe(EXPECTED_VIEWS);
      expect(result?.uniqueViewers).toBe(EXPECTED_UNIQUE_VIEWERS);
      expect(result?.lastViewed).toBe('2024-01-15T12:00:00.000Z');
      expect(result?.viewers).toHaveLength(EXPECTED_UNIQUE_VIEWERS);
    });

    it('should include user groups in viewer data', async () => {
      const events = [createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1')];

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));
      mockCacheService.getActivityPersistence.mockResolvedValue(null);
      mockCacheService.getCacheEntries.mockResolvedValue([]);
      mockGroupService.getUserGroups.mockResolvedValue([
        {
          groupName: 'Admins',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Admins',
        },
        {
          groupName: 'Analysts',
          arn: 'arn:aws:quicksight:us-east-1:123456789012:group/default/Analysts',
        },
      ]);

      const result = await activityService.getAssetActivity('dashboard', TEST_DASHBOARD_ID);

      expect(result?.viewers[0]?.groups).toEqual(['Admins', 'Analysts']);
    });
  });

  describe('getAssetActivityCounts', () => {
    it('should return empty counts when no cache exists', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(null);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const result = await activityService.getAssetActivityCounts('dashboard', [TEST_DASHBOARD_ID]);

      expect(result.get(TEST_DASHBOARD_ID)).toEqual({
        totalViews: 0,
        uniqueViewers: 0,
        lastViewed: '',
      });
    });

    it('should calculate activity counts for multiple assets', async () => {
      const events = [
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user2'),
        createMockEvent('GetDashboard', 'dash-789', 'user1'),
      ];

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const result = await activityService.getAssetActivityCounts('dashboard', [
        TEST_DASHBOARD_ID,
        'dash-789',
        'dash-000',
      ]);

      expect(result.get(TEST_DASHBOARD_ID)?.totalViews).toBe(EVENT_BATCH_SIZE_2);
      expect(result.get(TEST_DASHBOARD_ID)?.uniqueViewers).toBe(EVENT_BATCH_SIZE_2);
      expect(result.get('dash-789')?.totalViews).toBe(SINGLE_ACTIVITY);
      expect(result.get('dash-789')?.uniqueViewers).toBe(SINGLE_ACTIVITY);
      expect(result.get('dash-000')?.totalViews).toBe(ZERO_ACTIVITIES);
    });

    it('should include persisted dates for assets with no recent activity', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(createMockCache([]));
      mockCacheService.getActivityPersistence.mockResolvedValue({
        version: '1.0',
        lastUpdated: TEST_DATE,
        dashboards: {
          [TEST_DASHBOARD_ID]: '2024-01-01T10:00:00.000Z',
        },
        analyses: {},
        users: {},
      });

      const result = await activityService.getAssetActivityCounts('dashboard', [TEST_DASHBOARD_ID]);

      expect(result.get(TEST_DASHBOARD_ID)?.lastViewed).toBe('2024-01-01T10:00:00.000Z');
    });
  });
});

describe('ActivityService - User Activity', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;
  let mockCloudTrailAdapter: Mocked<CloudTrailAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      getActivityCache: vi.fn(),
      getActivityPersistence: vi.fn(),
      getCacheEntries: vi.fn(),
    } as any;

    mockCloudTrailAdapter = {
      getEventsByName: vi.fn(),
    } as any;

    activityService = new ActivityService(mockCacheService, mockCloudTrailAdapter);
  });

  describe('getUserActivity', () => {
    it('should return null when no cache exists', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(null);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const result = await activityService.getUserActivity(TEST_USER_NAME);

      expect(result).toBeNull();
    });

    it('should return user activity data', async () => {
      const events = [
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, TEST_USER_NAME),
        createMockEvent('GetDashboard', 'dash-789', TEST_USER_NAME),
        createMockEvent('GetAnalysis', TEST_ANALYSIS_ID, TEST_USER_NAME),
      ];

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));
      mockCacheService.getActivityPersistence.mockResolvedValue(null);
      mockCacheService.getCacheEntries.mockResolvedValue([]);

      const result = await activityService.getUserActivity(TEST_USER_NAME);

      expect(result).not.toBeNull();
      expect(result?.userName).toBe(TEST_USER_NAME);
      expect(result?.totalActivities).toBe(EXPECTED_VIEWS);
      expect(result?.dashboards).toHaveLength(EVENT_BATCH_SIZE_2);
      expect(result?.analyses).toHaveLength(SINGLE_ACTIVITY);
    });
  });

  describe('getUserActivityCounts', () => {
    it('should return empty counts when no cache exists', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(null);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const result = await activityService.getUserActivityCounts([TEST_USER_NAME]);

      expect(result.get(TEST_USER_NAME)).toEqual({
        totalActivities: 0,
        lastActive: '',
        dashboardCount: 0,
        analysisCount: 0,
      });
    });

    it('should calculate activity counts for multiple users', async () => {
      const events = [
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1'),
        createMockEvent('GetDashboard', 'dash-789', 'user1'),
        createMockEvent('GetAnalysis', TEST_ANALYSIS_ID, 'user1'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user2'),
      ];

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const result = await activityService.getUserActivityCounts(['user1', 'user2', 'user3']);

      expect(result.get('user1')?.totalActivities).toBe(EXPECTED_VIEWS);
      expect(result.get('user1')?.dashboardCount).toBe(EVENT_BATCH_SIZE_2);
      expect(result.get('user1')?.analysisCount).toBe(SINGLE_ACTIVITY);
      expect(result.get('user2')?.totalActivities).toBe(SINGLE_ACTIVITY);
      expect(result.get('user2')?.dashboardCount).toBe(SINGLE_ACTIVITY);
      expect(result.get('user3')?.totalActivities).toBe(ZERO_ACTIVITIES);
    });
  });
});

describe('ActivityService - refreshActivity', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;
  let mockCloudTrailAdapter: Mocked<CloudTrailAdapter>;
  let mockGroupService: Mocked<GroupService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      getActivityCache: vi.fn(),
      getActivityPersistence: vi.fn(),
      putActivityCache: vi.fn(),
      putActivityPersistence: vi.fn(),
      getCacheEntries: vi.fn(),
    } as any;

    mockCloudTrailAdapter = {
      getEventsByName: vi.fn(),
    } as any;

    mockGroupService = {
      getUserGroups: vi.fn(),
    } as any;

    activityService = new ActivityService(
      mockCacheService,
      mockCloudTrailAdapter,
      mockGroupService
    );
  });

  describe('refreshActivity', () => {
    const mockCloudTrailEvent: any = {
      eventTime: TEST_DATE,
      eventSource: 'quicksight.amazonaws.com',
      eventName: 'GetDashboard',
      userIdentity: {
        userName: TEST_USER_NAME,
      },
      requestParameters: {
        dashboardId: TEST_DASHBOARD_ID,
      },
    };

    it('should successfully refresh activity data', async () => {
      const request: ActivityRefreshRequest = {
        assetTypes: ['dashboard'],
        days: TEST_DAYS,
      };

      mockCloudTrailAdapter.getEventsByName.mockResolvedValue([mockCloudTrailEvent]);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);
      mockCacheService.putActivityCache.mockResolvedValue(undefined);
      mockCacheService.putActivityPersistence.mockResolvedValue(undefined);

      const result = await activityService.refreshActivity(request);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Successfully refreshed');
      expect(result.refreshed).toHaveProperty('dashboards');
      expect(mockCloudTrailAdapter.getEventsByName).toHaveBeenCalled();
      expect(mockCacheService.putActivityCache).toHaveBeenCalled();
    });

    it('should limit lookback days to maximum', async () => {
      const request: ActivityRefreshRequest = {
        assetTypes: ['all'],
        days: 200, // More than max
      };

      mockCloudTrailAdapter.getEventsByName.mockResolvedValue([]);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      await activityService.refreshActivity(request);

      const calls = mockCloudTrailAdapter.getEventsByName.mock.calls;
      const startTime = calls[0]?.[1] as Date;
      const endTime = calls[0]?.[2] as Date;
      const daysDiff = Math.round((endTime.getTime() - startTime.getTime()) / MS_PER_DAY);

      // Allow 1 day tolerance for timing boundary issues
      expect(daysDiff).toBeLessThanOrEqual(MAX_LOOKBACK_DAYS + 1);
    });

    it('should handle CloudTrail errors gracefully', async () => {
      const request: ActivityRefreshRequest = {
        assetTypes: ['dashboard'],
        days: TEST_DAYS,
      };

      mockCloudTrailAdapter.getEventsByName.mockRejectedValue(new Error('CloudTrail error'));

      const result = await activityService.refreshActivity(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error refreshing activity');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should fetch events for all asset types when requested', async () => {
      const request: ActivityRefreshRequest = {
        assetTypes: ['all'],
        days: 1,
      };

      mockCloudTrailAdapter.getEventsByName.mockResolvedValue([]);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      await activityService.refreshActivity(request);

      // Should fetch both dashboard and analysis events
      expect(mockCloudTrailAdapter.getEventsByName).toHaveBeenCalledWith(
        'GetDashboard',
        expect.any(Date),
        expect.any(Date)
      );
      expect(mockCloudTrailAdapter.getEventsByName).toHaveBeenCalledWith(
        'GetDashboardEmbedUrl',
        expect.any(Date),
        expect.any(Date)
      );
      expect(mockCloudTrailAdapter.getEventsByName).toHaveBeenCalledWith(
        'GetAnalysis',
        expect.any(Date),
        expect.any(Date)
      );
    });
  });
});

describe('ActivityService - Edge cases', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;
  let mockCloudTrailAdapter: Mocked<CloudTrailAdapter>;
  let mockGroupService: Mocked<GroupService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      getActivityCache: vi.fn(),
      getActivityPersistence: vi.fn(),
      putActivityCache: vi.fn(),
      putActivityPersistence: vi.fn(),
      getCacheEntries: vi.fn(),
    } as any;

    mockCloudTrailAdapter = {
      getEventsByName: vi.fn(),
    } as any;

    mockGroupService = {
      getUserGroups: vi.fn(),
    } as any;

    activityService = new ActivityService(
      mockCacheService,
      mockCloudTrailAdapter,
      mockGroupService
    );
  });

  describe('Edge cases and private methods', () => {
    it('should handle SSO user names correctly', async () => {
      const ssoEvent: any = {
        eventTime: TEST_DATE,
        eventSource: 'quicksight.amazonaws.com',
        eventName: 'GetDashboard',
        userIdentity: {
          sessionContext: {
            sessionIssuer: {
              userName: 'AWSReservedSSO_test',
            },
          },
          principalId: 'ABCDEFG:user@example.com',
        },
        requestParameters: {
          dashboardId: TEST_DASHBOARD_ID,
        },
      };

      mockCloudTrailAdapter.getEventsByName.mockResolvedValue([ssoEvent]);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const request: ActivityRefreshRequest = {
        assetTypes: ['dashboard'],
        days: 1,
      };

      await activityService.refreshActivity(request);

      const cacheCall = mockCacheService.putActivityCache.mock.calls[0];
      const cache = cacheCall?.[0] as ActivityCache;
      const events = Object.values(cache.events).flat() as MinimalEvent[];

      expect(events[0]?.u).toBe('AWSReservedSSO_test/user@example.com');
    });

    it('should drop VIEW events that are missing their resource ID', async () => {
      // A view event with no requestParameters — should be filtered out of the
      // cache because views require a resource id to be meaningful. Mutation
      // events (now also fetched by the same refresh pipeline) are allowed
      // to land without a resource id, so we mock getEventsByName to return
      // the event only when called for the view event names and empty
      // otherwise.
      const eventWithoutResource: any = {
        eventTime: TEST_DATE,
        eventSource: 'quicksight.amazonaws.com',
        eventName: 'GetDashboard',
        userIdentity: {
          userName: TEST_USER_NAME,
        },
        // Missing requestParameters
      };

      const VIEW_EVENT_NAMES = new Set(['GetDashboard', 'GetDashboardEmbedUrl', 'GetAnalysis']);
      mockCloudTrailAdapter.getEventsByName.mockImplementation(async (eventName: string) =>
        VIEW_EVENT_NAMES.has(eventName) ? [eventWithoutResource] : []
      );
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const request: ActivityRefreshRequest = {
        assetTypes: ['dashboard'],
        days: 1,
      };

      await activityService.refreshActivity(request);

      const cacheCall = mockCacheService.putActivityCache.mock.calls[0];
      const cache = cacheCall?.[0] as ActivityCache;
      const events = Object.values(cache.events).flat();

      expect(events).toHaveLength(ZERO_ACTIVITIES); // Event should be filtered out
    });

    it('should handle malformed CloudTrail events', async () => {
      const malformedEvent: any = {
        CloudTrailEvent: '{"invalid json',
      };

      mockCloudTrailAdapter.getEventsByName.mockResolvedValue([malformedEvent]);
      mockCacheService.getActivityPersistence.mockResolvedValue(null);

      const request: ActivityRefreshRequest = {
        assetTypes: ['dashboard'],
        days: 1,
      };

      await activityService.refreshActivity(request);

      expect(logger.debug).toHaveBeenCalledWith('Failed to process event', expect.any(Object));
    });

    it('should correctly group events by date', async () => {
      const events = [
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1', '2024-01-15T10:00:00.000Z'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user2', '2024-01-15T11:00:00.000Z'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1', '2024-01-16T10:00:00.000Z'),
      ];

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

      const result = await activityService.getActivitySummary();

      // Should have activity on 2 different dates
      expect(result.dashboards.totalViews).toBe(EXPECTED_VIEWS);
    });

    it('should handle analysis events with different parameter formats', async () => {
      const analysisEvents: any[] = [
        {
          eventTime: TEST_DATE,
          eventSource: 'quicksight.amazonaws.com',
          eventName: 'GetAnalysis',
          userIdentity: { userName: TEST_USER_NAME },
          requestParameters: { analysisId: `account/region/${TEST_ANALYSIS_ID}` },
        },
        {
          eventTime: TEST_DATE,
          eventSource: 'quicksight.amazonaws.com',
          eventName: 'GetAnalysis',
          userIdentity: { userName: TEST_USER_NAME },
          serviceEventDetails: {
            eventRequestDetails: { AnalysisId: TEST_ANALYSIS_ID },
          },
        },
      ];

      for (const event of analysisEvents) {
        mockCloudTrailAdapter.getEventsByName.mockResolvedValueOnce([event]);
        mockCacheService.getActivityPersistence.mockResolvedValue(null);

        await activityService.refreshActivity({
          assetTypes: ['analysis'],
          days: 1,
        });

        const cacheCall = mockCacheService.putActivityCache.mock.calls[0];
        const cache = cacheCall?.[0] as ActivityCache;
        const cachedEvents = Object.values(cache.events).flat() as MinimalEvent[];

        expect(cachedEvents[0]?.r).toBe(TEST_ANALYSIS_ID);

        vi.clearAllMocks();
      }
    });
  });
});

describe('ActivityService - Persistence', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;
  let mockCloudTrailAdapter: Mocked<CloudTrailAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      getActivityCache: vi.fn(),
      getActivityPersistence: vi.fn(),
      putActivityCache: vi.fn(),
      putActivityPersistence: vi.fn(),
      getCacheEntries: vi.fn(),
    } as any;

    mockCloudTrailAdapter = {
      getEventsByName: vi.fn(),
    } as any;

    activityService = new ActivityService(mockCacheService, mockCloudTrailAdapter);
  });

  describe('Activity persistence', () => {
    it('should update persistence with latest activity dates', async () => {
      const events = [
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1', '2024-01-15T10:00:00.000Z'),
        createMockEvent('GetDashboard', TEST_DASHBOARD_ID, 'user1', '2024-01-16T10:00:00.000Z'),
        createMockEvent('GetAnalysis', TEST_ANALYSIS_ID, 'user2', '2024-01-15T11:00:00.000Z'),
      ];

      const createCloudTrailEvent = (e: MinimalEvent, eventName: string) =>
        ({
          eventTime: e.t,
          eventSource: 'quicksight.amazonaws.com',
          eventName,
          userIdentity: { userName: e.u },
          requestParameters: {
            ...(eventName.includes('Dashboard') && { dashboardId: e.r }),
            ...(eventName.includes('Analysis') && { analysisId: e.r }),
          },
        }) as any;

      mockCloudTrailAdapter.getEventsByName.mockImplementation((_eventName) => {
        const filteredEvents = events.filter((e) => e.e === _eventName);
        const cloudTrailEvents = filteredEvents.map((e) => createCloudTrailEvent(e, _eventName));
        return Promise.resolve(cloudTrailEvents);
      });

      mockCacheService.getActivityPersistence.mockResolvedValue({
        version: '1.0',
        lastUpdated: '2024-01-01T00:00:00.000Z',
        dashboards: {},
        analyses: {},
        users: {},
      });

      await activityService.refreshActivity({
        assetTypes: ['all'],
        days: TEST_DAYS,
      });

      const persistenceCall = mockCacheService.putActivityPersistence.mock.calls[0];
      const persistence = persistenceCall?.[0];

      expect(persistence.dashboards[TEST_DASHBOARD_ID]).toBe('2024-01-16T10:00:00.000Z');
      expect(persistence.analyses[TEST_ANALYSIS_ID]).toBe('2024-01-15T11:00:00.000Z');
      expect(persistence.users['user1']).toBe('2024-01-16T10:00:00.000Z');
      expect(persistence.users['user2']).toBe('2024-01-15T11:00:00.000Z');
    });

    it('should use persisted dates when no recent activity exists', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(createMockCache([]));
      mockCacheService.getActivityPersistence.mockResolvedValue({
        version: '1.0',
        lastUpdated: TEST_DATE,
        dashboards: {
          [TEST_DASHBOARD_ID]: '2024-01-01T10:00:00.000Z',
        },
        analyses: {},
        users: {
          [TEST_USER_NAME]: '2024-01-02T10:00:00.000Z',
        },
      });

      const assetResult = await activityService.getAssetActivity('dashboard', TEST_DASHBOARD_ID);
      expect(assetResult?.lastViewed).toBe('2024-01-01T10:00:00.000Z');

      const userResult = await activityService.getUserActivity(TEST_USER_NAME);
      expect(userResult?.lastActive).toBe('2024-01-02T10:00:00.000Z');
    });
  });
});

describe('ActivityService - Performance', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCacheService = {
      getActivityCache: vi.fn(),
      getActivityPersistence: vi.fn(),
      getCacheEntries: vi.fn(),
    } as any;

    activityService = new ActivityService(mockCacheService, {} as any);
  });

  describe('Performance and data handling', () => {
    it('should handle large numbers of events efficiently', async () => {
      const largeEventSet: MinimalEvent[] = [];

      for (let i = 0; i < NUM_EVENTS; i++) {
        largeEventSet.push(
          createMockEvent(
            i % EVENT_BATCH_SIZE_2 === 0 ? 'GetDashboard' : 'GetAnalysis',
            `asset-${i % NUM_ASSETS}`,
            `user-${i % NUM_USERS}`,
            `2024-01-${String(DATE_DAY_15 + (i % DATE_DAY_INCREMENT)).padStart(2, '0')}T10:00:00.000Z`
          )
        );
      }

      mockCacheService.getActivityCache.mockResolvedValue(createMockCache(largeEventSet));

      const startTime = Date.now();
      const result = await activityService.getActivitySummary();
      const endTime = Date.now();

      expect(result.dashboards.totalViews).toBe(DASHBOARD_EVENT_COUNT);
      expect(result.analyses.totalViews).toBe(ANALYSIS_EVENT_COUNT);
      expect(result.users.activeUsers).toBe(NUM_USERS);
      expect(endTime - startTime).toBeLessThan(PERF_TEST_TIMEOUT_MS); // Should complete within 1 second
    });

    it('should handle empty cache gracefully', async () => {
      mockCacheService.getActivityCache.mockResolvedValue(createMockCache([]));
      mockCacheService.getActivityPersistence.mockResolvedValue({
        version: '1.0',
        lastUpdated: TEST_DATE,
        dashboards: {},
        analyses: {},
        users: {},
      });

      const summary = await activityService.getActivitySummary();
      expect(summary.dashboards.totalViews).toBe(ZERO_ACTIVITIES);

      const assetActivity = await activityService.getAssetActivity('dashboard', TEST_DASHBOARD_ID);
      expect(assetActivity).toBeNull();

      const userActivity = await activityService.getUserActivity(TEST_USER_NAME);
      expect(userActivity).toBeNull();
    });
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  Activity Timeline — classifyAction + getTimelinePage                      */
/* ────────────────────────────────────────────────────────────────────────── */

describe('classifyAction', () => {
  it('maps create prefix', () => {
    expect(classifyAction('CreateDashboard')).toBe('create');
    expect(classifyAction('CreateDataSet')).toBe('create');
    expect(classifyAction('CreateFolderMembership')).toBe('member');
    expect(classifyAction('RegisterUser')).toBe('create');
    expect(classifyAction('CreateIngestion')).toBe('create');
  });

  it('maps update prefix', () => {
    expect(classifyAction('UpdateDashboard')).toBe('update');
    expect(classifyAction('UpdateDataSet')).toBe('update');
    expect(classifyAction('RestoreAnalysis')).toBe('update');
    expect(classifyAction('PutDataSetRefreshProperties')).toBe('update');
  });

  it('maps delete prefix', () => {
    expect(classifyAction('DeleteDashboard')).toBe('delete');
    expect(classifyAction('DeleteFolderMembership')).toBe('member');
    expect(classifyAction('CancelIngestion')).toBe('delete');
  });

  it('maps permissions events to grant / revoke', () => {
    expect(classifyAction('UpdateDashboardPermissions')).toBe('grant');
    expect(classifyAction('UpdateAnalysisPermissions')).toBe('grant');
    // Delete*Permissions would be revoke, but QS doesn't have that shape —
    // still the classifier should handle it.
    expect(classifyAction('DeleteDashboardPermissions')).toBe('revoke');
  });

  it('maps publish events', () => {
    expect(classifyAction('UpdateDashboardPublishedVersion')).toBe('publish');
    expect(classifyAction('UpdateBrandPublishedVersion')).toBe('publish');
  });

  it('maps membership events', () => {
    expect(classifyAction('CreateGroupMembership')).toBe('member');
    expect(classifyAction('DeleteGroupMembership')).toBe('member');
    expect(classifyAction('CreateFolderMembership')).toBe('member');
    expect(classifyAction('CreateRoleMembership')).toBe('member');
  });

  it('maps tagging, batch, and job events', () => {
    expect(classifyAction('TagResource')).toBe('tag');
    expect(classifyAction('UntagResource')).toBe('tag');
    expect(classifyAction('BatchCreateTopicReviewedAnswer')).toBe('batch');
    expect(classifyAction('BatchDeleteTopicReviewedAnswer')).toBe('batch');
    expect(classifyAction('StartAssetBundleExportJob')).toBe('job');
    expect(classifyAction('StartDashboardSnapshotJob')).toBe('job');
  });

  it('returns undefined for view events', () => {
    expect(classifyAction('GetDashboard')).toBeUndefined();
    expect(classifyAction('DescribeAnalysis')).toBeUndefined();
    expect(classifyAction('ListDashboards')).toBeUndefined();
    expect(classifyAction('SearchDataSets')).toBeUndefined();
  });
});

/* ───── Shared helpers for the timeline describes ─────────────────────── */

const EXPECTED_THREE_EVENTS = 3;

const timelineMutationEvent = (
  eventName: string,
  resource: string,
  user: string,
  at: MinimalEvent['at'],
  action: MinimalEvent['a'],
  when: string
): MinimalEvent => ({ t: when, e: eventName, u: user, r: resource, k: 'm', at, a: action });

const TIMELINE_CATALOG_ASSETS = [
  { assetId: 'dash-1', assetName: 'Sales Q3', assetType: 'dashboard' },
  { assetId: 'dash-2', assetName: 'Marketing', assetType: 'dashboard' },
  { assetId: 'anal-1', assetName: 'Cohort Analysis', assetType: 'analysis' },
  { assetId: 'ds-1', assetName: 'Customer Data', assetType: 'dataset' },
];

function makeTimelineServiceAndMocks() {
  const mockCacheService = {
    getActivityCache: vi.fn(),
    getActivityPersistence: vi.fn(),
    getCacheEntries: vi
      .fn()
      .mockImplementation(async ({ assetType }: { assetType: string }) =>
        TIMELINE_CATALOG_ASSETS.filter((a) => a.assetType === assetType)
      ),
  } as unknown as Mocked<CacheService>;
  const activityService = new ActivityService(mockCacheService, {} as any);
  return { mockCacheService, activityService };
}

describe('ActivityService.getTimelinePage — basic', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ activityService, mockCacheService } = makeTimelineServiceAndMocks());
  });

  it('returns an empty page when the cache is missing', async () => {
    mockCacheService.getActivityCache.mockResolvedValue(null);
    const page = await activityService.getTimelinePage({ limit: 10 });
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
    expect(page.hasMore).toBe(false);
  });

  it('returns mutation events sorted newest-first with hydrated asset names', async () => {
    const events: MinimalEvent[] = [
      timelineMutationEvent(
        'CreateDashboard',
        'dash-1',
        'alice',
        'dashboard',
        'create',
        '2024-06-01T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'UpdateDashboard',
        'dash-2',
        'bob',
        'dashboard',
        'update',
        '2024-06-02T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'DeleteAnalysis',
        'anal-1',
        'carol',
        'analysis',
        'delete',
        '2024-06-03T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({ limit: 10 });
    expect(page.items).toHaveLength(EXPECTED_THREE_EVENTS);
    // Newest first
    expect(page.items[0]?.eventName).toBe('DeleteAnalysis');
    expect(page.items[1]?.eventName).toBe('UpdateDashboard');
    expect(page.items[2]?.eventName).toBe('CreateDashboard');
    // Names hydrated
    expect(page.items[0]?.assetName).toBe('Cohort Analysis');
    expect(page.items[1]?.assetName).toBe('Marketing');
    expect(page.items[2]?.assetName).toBe('Sales Q3');
    expect(page.hasMore).toBe(false);
  });

  it('excludes view events even when present in the cache (mutations only)', async () => {
    const events: MinimalEvent[] = [
      // Legacy view (no k field) — should be dropped from timeline
      { t: '2024-06-02T12:00:00.000Z', e: 'GetDashboard', u: 'bob', r: 'dash-1' },
      timelineMutationEvent(
        'CreateDashboard',
        'dash-2',
        'alice',
        'dashboard',
        'create',
        '2024-06-01T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({ limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.eventName).toBe('CreateDashboard');
  });
});

describe('ActivityService.getTimelinePage — pagination', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ activityService, mockCacheService } = makeTimelineServiceAndMocks());
  });

  it('paginates via cursor (nextCursor returns older events only)', async () => {
    const events: MinimalEvent[] = Array.from({ length: 5 }, (_, i) =>
      timelineMutationEvent(
        'UpdateDashboard',
        `dash-${i}`,
        'alice',
        'dashboard',
        'update',
        `2024-06-0${i + 1}T12:00:00.000Z`
      )
    );
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    // First page: 2 newest
    const page1 = await activityService.getTimelinePage({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.items[0]?.timestamp).toBe('2024-06-05T12:00:00.000Z');
    expect(page1.items[1]?.timestamp).toBe('2024-06-04T12:00:00.000Z');
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBe('2024-06-04T12:00:00.000Z');

    // Second page: strictly older than cursor
    const page2 = await activityService.getTimelinePage({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0]?.timestamp).toBe('2024-06-03T12:00:00.000Z');
    expect(page2.items[1]?.timestamp).toBe('2024-06-02T12:00:00.000Z');

    // Third page: one remaining
    const page3 = await activityService.getTimelinePage({ limit: 2, cursor: page2.nextCursor! });
    expect(page3.items).toHaveLength(1);
    expect(page3.hasMore).toBe(false);
    expect(page3.nextCursor).toBeNull();
  });
});

describe('ActivityService.getTimelinePage — filters', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ activityService, mockCacheService } = makeTimelineServiceAndMocks());
  });

  it('filters by resourceTypes', async () => {
    const events: MinimalEvent[] = [
      timelineMutationEvent(
        'CreateDashboard',
        'dash-1',
        'alice',
        'dashboard',
        'create',
        '2024-06-01T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'CreateAnalysis',
        'anal-1',
        'bob',
        'analysis',
        'create',
        '2024-06-02T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'UpdateAccountSettings',
        '',
        'carol',
        'other',
        'update',
        '2024-06-03T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({
      limit: 10,
      resourceTypes: ['dashboard', 'analysis'],
    });
    expect(page.items).toHaveLength(2);
    expect(
      page.items.every((e) => e.resourceType === 'dashboard' || e.resourceType === 'analysis')
    ).toBe(true);
  });

  it('filters by action', async () => {
    const events: MinimalEvent[] = [
      timelineMutationEvent(
        'CreateDashboard',
        'dash-1',
        'alice',
        'dashboard',
        'create',
        '2024-06-01T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'UpdateDashboard',
        'dash-2',
        'bob',
        'dashboard',
        'update',
        '2024-06-02T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'DeleteDashboard',
        'dash-3',
        'carol',
        'dashboard',
        'delete',
        '2024-06-03T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({ limit: 10, actions: ['delete'] });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.eventName).toBe('DeleteDashboard');
  });

  it('filters by user (case-insensitive)', async () => {
    const events: MinimalEvent[] = [
      timelineMutationEvent(
        'CreateDashboard',
        'dash-1',
        'Alice',
        'dashboard',
        'create',
        '2024-06-01T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'UpdateDashboard',
        'dash-2',
        'bob',
        'dashboard',
        'update',
        '2024-06-02T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({ limit: 10, users: ['alice'] });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.user).toBe('Alice');
  });
});

describe('ActivityService.getTimelinePage — pinning and hydration', () => {
  let activityService: ActivityService;
  let mockCacheService: Mocked<CacheService>;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ activityService, mockCacheService } = makeTimelineServiceAndMocks());
  });

  it('pre-filters per-asset for the /timeline/{assetType}/{assetId} route', async () => {
    const events: MinimalEvent[] = [
      timelineMutationEvent(
        'UpdateDashboard',
        'dash-1',
        'alice',
        'dashboard',
        'update',
        '2024-06-01T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'UpdateDashboard',
        'dash-2',
        'bob',
        'dashboard',
        'update',
        '2024-06-02T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'UpdateAnalysis',
        'anal-1',
        'carol',
        'analysis',
        'update',
        '2024-06-03T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({
      limit: 10,
      assetType: 'dashboard',
      assetId: 'dash-1',
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.assetId).toBe('dash-1');
  });

  it('leaves assetName undefined when catalog does not know the asset', async () => {
    const events: MinimalEvent[] = [
      timelineMutationEvent(
        'CreateDashboard',
        'unknown-id',
        'alice',
        'dashboard',
        'create',
        '2024-06-01T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({ limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.assetId).toBe('unknown-id');
    expect(page.items[0]?.assetName).toBeUndefined();
  });

  it('tags catalog-asset events with resourceType + assetType for navigation', async () => {
    const events: MinimalEvent[] = [
      timelineMutationEvent(
        'CreateDashboard',
        'dash-1',
        'alice',
        'dashboard',
        'create',
        '2024-06-01T12:00:00.000Z'
      ),
      timelineMutationEvent(
        'UpdateAccountSettings',
        '',
        'bob',
        'other',
        'update',
        '2024-06-02T12:00:00.000Z'
      ),
    ];
    mockCacheService.getActivityCache.mockResolvedValue(createMockCache(events));

    const page = await activityService.getTimelinePage({ limit: 10 });
    const catalogItem = page.items.find((e) => e.eventName === 'CreateDashboard');
    const otherItem = page.items.find((e) => e.eventName === 'UpdateAccountSettings');
    expect(catalogItem?.resourceType).toBe('dashboard');
    expect(catalogItem?.assetType).toBe('dashboard');
    expect(otherItem?.resourceType).toBe('other');
    expect(otherItem?.assetType).toBeUndefined();
  });
});
