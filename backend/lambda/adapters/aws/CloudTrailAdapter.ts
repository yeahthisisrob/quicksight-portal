import {
  type CloudTrailClient,
  type LookupEventsCommandInput,
  type Event as CloudTrailEvent,
  LookupEventsCommand,
} from '@aws-sdk/client-cloudtrail';
import { subDays } from 'date-fns';

import { withRetry } from '../../shared/utils/awsRetry';
import { QUICKSIGHT_USER_ACTIVITY_EVENTS } from '../../shared/utils/constants';
import { logger } from '../../shared/utils/logger';
import { cloudTrailRateLimiter } from '../../shared/utils/rateLimiter';

/**
 * CloudTrail adapter constants
 */
const CLOUDTRAIL_CONSTANTS = {
  // AWS CloudTrail limits
  MAX_DAYS_LOOKBACK: 90,
  MAX_RESULTS_PER_REQUEST: 50,
  MAX_EVENTS_PER_TYPE: 1000,
  MAX_PAGES_PER_QUERY: 10,
  PAGE_MULTIPLIER: 10,
  MAX_ACTIVITIES_PER_USER: 100,

  // Event sources and names
  QUICKSIGHT_EVENT_SOURCE: 'quicksight.amazonaws.com',
  DEFAULT_REGION: 'us-east-1',

  // CloudTrail attribute keys
  EVENT_NAME_ATTRIBUTE: 'EventName',
  EVENT_SOURCE_ATTRIBUTE: 'EventSource',
  RESOURCE_NAME_ATTRIBUTE: 'ResourceName',

  // Regex patterns
  RESOURCE_ARN_PATTERN: '/(dashboard|analysis|dataset)/([^/]+)$',
  USER_ARN_PATTERN: 'user/[^/]+/(.+)$',
} as const;

/**
 * QuickSight event names to track for user activity
 */
const QUICKSIGHT_EVENT_NAMES = [
  'GetDashboard',
  'DescribeDashboard',
  'ListDashboards',
  'GetAnalysis',
  'DescribeAnalysis',
  'ListAnalyses',
  'DescribeDataSet',
  'ListDataSets',
  'CreateDashboard',
  'UpdateDashboard',
  'DeleteDashboard',
  'CreateAnalysis',
  'UpdateAnalysis',
  'DeleteAnalysis',
  'CreateDataSet',
  'UpdateDataSet',
  'DeleteDataSet',
] as const;

/**
 * View event names for tracking dashboard/analysis views
 */
const VIEW_EVENT_NAMES = {
  GET_ANALYSIS: 'GetAnalysis',
  GET_DASHBOARD: 'GetDashboard',
  GET_DASHBOARD_EMBED_URL: 'GetDashboardEmbedUrl',
} as const;

interface UserActivity {
  userArn: string;
  userName: string;
  lastActivityTime?: Date;
  activityCount: number;
  activities: {
    eventName: string;
    eventTime: Date;
    resourceName?: string;
  }[];
}

/**
 * CloudTrail adapter for interfacing with AWS CloudTrail API
 * Handles CloudTrail event retrieval for user activity, view statistics, etc.
 */
export class CloudTrailAdapter {
  private readonly client: CloudTrailClient;
  private readonly region: string;

  constructor(client: CloudTrailClient, region: string = CLOUDTRAIL_CONSTANTS.DEFAULT_REGION) {
    this.client = client;
    this.region = region;
  }

  /**
   * Get analysis view events from CloudTrail
   * Used by ViewsService for analysis view statistics
   */
  public async getAnalysisViewEvents(
    analysisId: string,
    startTime: Date,
    endTime: Date
  ): Promise<CloudTrailEvent[]> {
    const events: CloudTrailEvent[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const params: LookupEventsCommandInput = {
          StartTime: startTime,
          EndTime: endTime,
          LookupAttributes: [
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_SOURCE_ATTRIBUTE,
              AttributeValue: CLOUDTRAIL_CONSTANTS.QUICKSIGHT_EVENT_SOURCE,
            },
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.RESOURCE_NAME_ATTRIBUTE,
              AttributeValue: `arn:aws:quicksight:${this.region}:*:analysis/${analysisId}`,
            },
          ],
          NextToken: nextToken,
          MaxResults: CLOUDTRAIL_CONSTANTS.MAX_RESULTS_PER_REQUEST,
        };

        // Rate limit CloudTrail API calls
        await cloudTrailRateLimiter.waitForToken();

        const response = await withRetry(
          () => this.client.send(new LookupEventsCommand(params)),
          'CloudTrail.LookupEvents'
        );

        if (response.Events) {
          events.push(
            ...response.Events.filter(
              (e: CloudTrailEvent) => e.EventName === VIEW_EVENT_NAMES.GET_ANALYSIS
            )
          );
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      logger.error(`Error fetching analysis view events for ${analysisId}:`, error);
      throw error;
    }

    return events;
  }

  /**
   * Get analysis view events for multiple analyses
   */
  public async getAnalysisViewEventsBatch(
    analysisIds: string[],
    days: number = 90
  ): Promise<CloudTrailEvent[]> {
    const events: CloudTrailEvent[] = [];
    const endTime = new Date();
    const startTime = subDays(endTime, days);

    try {
      let nextToken: string | undefined;
      let pageCount = 0;
      const MAX_PAGES = CLOUDTRAIL_CONSTANTS.MAX_PAGES_PER_QUERY;

      do {
        const params: LookupEventsCommandInput = {
          StartTime: startTime,
          EndTime: endTime,
          LookupAttributes: [
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_NAME_ATTRIBUTE,
              AttributeValue: VIEW_EVENT_NAMES.GET_ANALYSIS,
            },
          ],
          NextToken: nextToken,
          MaxResults: CLOUDTRAIL_CONSTANTS.MAX_RESULTS_PER_REQUEST,
        };

        // Rate limit CloudTrail API calls
        await cloudTrailRateLimiter.waitForToken();

        const response = await withRetry(
          () => this.client.send(new LookupEventsCommand(params)),
          'CloudTrail.LookupEvents'
        );

        if (response.Events) {
          // Filter events for our analyses
          const relevantEvents = response.Events.filter((event: CloudTrailEvent) => {
            try {
              if (!event.CloudTrailEvent) {
                return false;
              }
              const eventData = JSON.parse(event.CloudTrailEvent);
              const analysisId =
                eventData.requestParameters?.analysisId || eventData.requestParameters?.AnalysisId;
              return analysisId && analysisIds.includes(analysisId);
            } catch {
              return false;
            }
          });
          events.push(...relevantEvents);
        }

        nextToken = response.NextToken;
        pageCount++;
      } while (nextToken && pageCount < MAX_PAGES);
    } catch (error) {
      logger.error('Error fetching analysis view events batch:', error);
      throw error;
    }

    return events;
  }

  /**
   * Get dashboard view events from CloudTrail
   * Used by ViewsService for dashboard view statistics
   */
  public async getDashboardViewEvents(
    dashboardId: string,
    startTime: Date,
    endTime: Date
  ): Promise<CloudTrailEvent[]> {
    const events: CloudTrailEvent[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const params: LookupEventsCommandInput = {
          StartTime: startTime,
          EndTime: endTime,
          LookupAttributes: [
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_SOURCE_ATTRIBUTE,
              AttributeValue: CLOUDTRAIL_CONSTANTS.QUICKSIGHT_EVENT_SOURCE,
            },
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.RESOURCE_NAME_ATTRIBUTE,
              AttributeValue: `arn:aws:quicksight:${this.region}:*:dashboard/${dashboardId}`,
            },
          ],
          NextToken: nextToken,
          MaxResults: CLOUDTRAIL_CONSTANTS.MAX_RESULTS_PER_REQUEST,
        };

        // Rate limit CloudTrail API calls
        await cloudTrailRateLimiter.waitForToken();

        const response = await withRetry(
          () => this.client.send(new LookupEventsCommand(params)),
          'CloudTrail.LookupEvents'
        );

        if (response.Events) {
          events.push(
            ...response.Events.filter(
              (e: CloudTrailEvent) =>
                e.EventName === VIEW_EVENT_NAMES.GET_DASHBOARD ||
                e.EventName === VIEW_EVENT_NAMES.GET_DASHBOARD_EMBED_URL
            )
          );
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      logger.error(`Error fetching dashboard view events for ${dashboardId}:`, error);
      throw error;
    }

    return events;
  }

  /**
   * Get dashboard view events for multiple dashboards
   * More efficient than calling getDashboardViewEvents multiple times
   */
  public async getDashboardViewEventsBatch(
    dashboardIds: string[],
    days: number = 90
  ): Promise<CloudTrailEvent[]> {
    const events: CloudTrailEvent[] = [];
    const endTime = new Date();
    const startTime = subDays(endTime, days);

    try {
      let nextToken: string | undefined;
      let pageCount = 0;
      const MAX_PAGES = CLOUDTRAIL_CONSTANTS.MAX_PAGES_PER_QUERY; // Limit to prevent excessive API calls

      do {
        const params: LookupEventsCommandInput = {
          StartTime: startTime,
          EndTime: endTime,
          LookupAttributes: [
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_NAME_ATTRIBUTE,
              AttributeValue: VIEW_EVENT_NAMES.GET_DASHBOARD,
            },
          ],
          NextToken: nextToken,
          MaxResults: CLOUDTRAIL_CONSTANTS.MAX_RESULTS_PER_REQUEST,
        };

        // Rate limit CloudTrail API calls
        await cloudTrailRateLimiter.waitForToken();

        const response = await withRetry(
          () => this.client.send(new LookupEventsCommand(params)),
          'CloudTrail.LookupEvents'
        );

        if (response.Events) {
          // Filter events for our dashboards
          const relevantEvents = response.Events.filter((event: CloudTrailEvent) => {
            try {
              if (!event.CloudTrailEvent) {
                return false;
              }
              const eventData = JSON.parse(event.CloudTrailEvent);
              const dashboardId =
                eventData.requestParameters?.dashboardId ||
                eventData.requestParameters?.DashboardId;
              return dashboardId && dashboardIds.includes(dashboardId);
            } catch {
              return false;
            }
          });
          events.push(...relevantEvents);
        }

        nextToken = response.NextToken;
        pageCount++;
      } while (nextToken && pageCount < MAX_PAGES);
    } catch (error) {
      logger.error('Error fetching dashboard view events batch:', error);
      throw error;
    }

    return events;
  }

  /**
   * Get events by specific event name
   * @param eventName The CloudTrail event name to search for
   * @param startTime Start of the time range
   * @param endTime End of the time range
   * @returns Array of CloudTrail events
   */
  public async getEventsByName(
    eventName: string,
    startTime: Date,
    endTime: Date
  ): Promise<CloudTrailEvent[]> {
    const events: CloudTrailEvent[] = [];

    try {
      let nextToken: string | undefined;
      let pageCount = 0;
      const maxPages =
        CLOUDTRAIL_CONSTANTS.MAX_PAGES_PER_QUERY * CLOUDTRAIL_CONSTANTS.PAGE_MULTIPLIER; // CloudTrail allows up to 50 results per page, no documented max pages

      do {
        const params: LookupEventsCommandInput = {
          StartTime: startTime,
          EndTime: endTime,
          LookupAttributes: [
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_NAME_ATTRIBUTE,
              AttributeValue: eventName,
            },
            {
              AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_SOURCE_ATTRIBUTE,
              AttributeValue: CLOUDTRAIL_CONSTANTS.QUICKSIGHT_EVENT_SOURCE,
            },
          ],
          NextToken: nextToken,
          MaxResults: CLOUDTRAIL_CONSTANTS.MAX_RESULTS_PER_REQUEST,
        };

        // Rate limit CloudTrail API calls
        await cloudTrailRateLimiter.waitForToken();

        const response = await withRetry(
          () => this.client.send(new LookupEventsCommand(params)),
          'CloudTrail.LookupEvents'
        );

        if (response.Events) {
          events.push(...response.Events);
        }

        nextToken = response.NextToken;
        pageCount++;
      } while (nextToken && pageCount < maxPages);

      logger.info(`Found total of ${events.length} ${eventName} events across ${pageCount} pages`);
    } catch (error) {
      logger.error(`Error fetching ${eventName} events:`, error);
      throw error;
    }

    return events;
  }

  /**
   * Get user activity from CloudTrail logs
   * @param days Number of days to look back (max 90)
   * @param eventNames Optional list of event names to filter
   */
  public async getUserActivity(
    days: number = 90,
    eventNames?: string[]
  ): Promise<Map<string, UserActivity>> {
    const { startTime, endTime } = this.buildTimeRange(days);
    const userActivityMap = new Map<string, UserActivity>();
    const targetEventNames = eventNames || [...QUICKSIGHT_USER_ACTIVITY_EVENTS];

    try {
      for (const eventName of targetEventNames) {
        await this.fetchEventsForEventName(eventName, startTime, endTime, userActivityMap);
      }

      logger.info(`Completed CloudTrail lookup: found ${userActivityMap.size} users with activity`);
    } catch (error) {
      logger.error('Error fetching CloudTrail events:', error);
      throw error;
    }

    return userActivityMap;
  }

  /**
   * Get all QuickSight user activity events
   */
  public async getUserActivityEvents(startTime: Date, endTime: Date): Promise<CloudTrailEvent[]> {
    const events: CloudTrailEvent[] = [];

    try {
      let nextToken: string | undefined;
      let pageCount = 0;

      for (const eventName of QUICKSIGHT_EVENT_NAMES) {
        nextToken = undefined;
        pageCount = 0;

        do {
          const params: LookupEventsCommandInput = {
            StartTime: startTime,
            EndTime: endTime,
            LookupAttributes: [
              {
                AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_NAME_ATTRIBUTE,
                AttributeValue: eventName,
              },
            ],
            NextToken: nextToken,
            MaxResults: CLOUDTRAIL_CONSTANTS.MAX_RESULTS_PER_REQUEST,
          };

          // Rate limit CloudTrail API calls
          await cloudTrailRateLimiter.waitForToken();

          const response = await withRetry(
            () => this.client.send(new LookupEventsCommand(params)),
            'CloudTrail.LookupEvents'
          );

          if (response.Events) {
            events.push(...response.Events);
          }

          nextToken = response.NextToken;
          pageCount++;
        } while (nextToken && pageCount < CLOUDTRAIL_CONSTANTS.MAX_PAGES_PER_QUERY / 2); // Limit pages per event type
      }
    } catch (error) {
      logger.error('Error fetching user activity events:', error);
      throw error;
    }

    return events;
  }

  /**
   * Build time range for CloudTrail queries
   */
  private buildTimeRange(days: number): { startTime: Date; endTime: Date } {
    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - Math.min(days, CLOUDTRAIL_CONSTANTS.MAX_DAYS_LOOKBACK));
    return { startTime, endTime };
  }

  /**
   * Create a new user activity entry
   */
  private createUserActivityEntry(userName: string, userArn: string): UserActivity {
    return {
      userArn,
      userName,
      activityCount: 0,
      activities: [],
    };
  }

  /**
   * Extract resource name from CloudTrail event
   */
  private extractResourceName(event: CloudTrailEvent): string | undefined {
    try {
      // Look for resource in Resources array
      if (event.Resources && event.Resources.length > 0) {
        const resource = event.Resources[0];
        if (resource && resource.ResourceName) {
          // Extract dashboard/analysis ID from ARN
          const match = resource.ResourceName.match(
            new RegExp(CLOUDTRAIL_CONSTANTS.RESOURCE_ARN_PATTERN)
          );
          if (match?.[2]) {
            return match[2];
          }
          return resource.ResourceName;
        }
      }

      // Try to parse from CloudTrailEvent string
      if (event.CloudTrailEvent) {
        const eventData = JSON.parse(event.CloudTrailEvent);
        if (eventData.resources && eventData.resources.length > 0) {
          return eventData.resources[0].resourceName;
        }
      }
    } catch (error) {
      logger.debug('Error extracting resource name from event:', error);
    }

    return undefined;
  }

  /**
   * Extract user ARN from CloudTrail event
   */
  private extractUserArn(event: CloudTrailEvent): string | undefined {
    try {
      if (event.CloudTrailEvent) {
        const eventData = JSON.parse(event.CloudTrailEvent);
        const userIdentity = eventData.userIdentity;

        if (!userIdentity) {
          return undefined;
        }

        return userIdentity.arn || userIdentity.principalId || undefined;
      }
    } catch (error) {
      logger.debug('Error extracting user ARN from event:', error);
    }

    return undefined;
  }

  /**
   * Extract user name from CloudTrail event
   * For QuickSight users, we need to match the full QuickSight user name format
   */
  private extractUserName(event: CloudTrailEvent): string | undefined {
    try {
      if (event.CloudTrailEvent) {
        const eventData = JSON.parse(event.CloudTrailEvent);
        const userIdentity = eventData.userIdentity;

        if (!userIdentity) {
          return undefined;
        }

        // For assumed roles (like SSO), construct the QuickSight user name
        if (
          userIdentity.type === 'AssumedRole' &&
          userIdentity.sessionContext?.sessionIssuer?.userName
        ) {
          // Extract the session name from principalId (format: "principalId:sessionName")
          const parts = userIdentity.principalId?.split(':');
          const sessionName = parts?.[1];
          if (sessionName) {
            // Construct QuickSight user name format: "RoleName/SessionName"
            return `${userIdentity.sessionContext.sessionIssuer.userName}/${sessionName}`;
          }
        }

        // For direct QuickSight users
        if (userIdentity.userName) {
          return userIdentity.userName;
        }

        // Extract from ARN if available
        if (userIdentity.arn) {
          // Check if it's a QuickSight user ARN
          if (userIdentity.arn.includes(':user/')) {
            const match = userIdentity.arn.match(new RegExp(CLOUDTRAIL_CONSTANTS.USER_ARN_PATTERN));
            if (match?.[1]) {
              return match[1];
            }
          }
          // Otherwise use the last part
          const arnParts = userIdentity.arn.split('/');
          return arnParts[arnParts.length - 1] || undefined;
        }

        return userIdentity.principalId || undefined;
      }
    } catch (error) {
      logger.debug('Error extracting user name from event:', error);
    }

    return undefined;
  }

  /**
   * Fetch events for a specific event name with pagination
   */
  private async fetchEventsForEventName(
    eventName: string,
    startTime: Date,
    endTime: Date,
    userActivityMap: Map<string, UserActivity>
  ): Promise<void> {
    let nextToken: string | undefined;
    let eventCount = 0;

    do {
      const params: LookupEventsCommandInput = {
        StartTime: startTime,
        EndTime: endTime,
        LookupAttributes: [
          {
            AttributeKey: CLOUDTRAIL_CONSTANTS.EVENT_NAME_ATTRIBUTE,
            AttributeValue: eventName,
          },
        ],
        NextToken: nextToken,
        MaxResults: CLOUDTRAIL_CONSTANTS.MAX_RESULTS_PER_REQUEST,
      };

      await cloudTrailRateLimiter.waitForToken();

      const response = await withRetry(
        () => this.client.send(new LookupEventsCommand(params)),
        'CloudTrail.LookupEvents'
      );

      if (response.Events) {
        for (const event of response.Events) {
          this.processEventForUserActivity(event, userActivityMap);
        }
        eventCount += response.Events.length;
      }

      nextToken = response.NextToken;

      if (eventCount > CLOUDTRAIL_CONSTANTS.MAX_EVENTS_PER_TYPE) {
        logger.warn(`Stopping ${eventName} query after ${eventCount} events to prevent throttling`);
        break;
      }
    } while (nextToken);
  }

  /**
   * Process a single CloudTrail event for user activity tracking
   */
  private processEventForUserActivity(
    event: CloudTrailEvent,
    userActivityMap: Map<string, UserActivity>
  ): void {
    // Only process QuickSight events
    if (event.EventSource !== CLOUDTRAIL_CONSTANTS.QUICKSIGHT_EVENT_SOURCE) {
      return;
    }

    const userName = this.extractUserName(event);
    const userArn = this.extractUserArn(event) || userName;

    if (!userName) {
      return;
    }

    // Get or create user activity entry
    let userActivity = userActivityMap.get(userName);
    if (!userActivity) {
      userActivity = this.createUserActivityEntry(userName, userArn || userName);
      userActivityMap.set(userName, userActivity);
    }

    // Update activity data
    userActivity.activityCount++;

    // Update last activity time
    if (
      !userActivity.lastActivityTime ||
      (event.EventTime && event.EventTime > userActivity.lastActivityTime)
    ) {
      userActivity.lastActivityTime = event.EventTime;
    }

    // Add activity details (limit to prevent memory issues)
    if (userActivity.activities.length < CLOUDTRAIL_CONSTANTS.MAX_ACTIVITIES_PER_USER) {
      userActivity.activities.push({
        eventName: event.EventName || 'Unknown',
        eventTime: event.EventTime || new Date(),
        resourceName: this.extractResourceName(event),
      });
    }
  }
}
