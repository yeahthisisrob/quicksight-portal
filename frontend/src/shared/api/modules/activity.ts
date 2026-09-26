import type { components, paths } from '@shared/generated/types';

import { client, unwrap } from '../typed';

type Schemas = components['schemas'];
type ActivityData = Schemas['ActivityData'];
type UserActivity = Schemas['UserActivity'];
export type DatasetActivityData = Schemas['DatasetActivityData'];
type UserInactiveAnalysis = Schemas['UserInactiveAnalysis'];
type UserUnusedDataset = Schemas['UserUnusedDataset'];
export type TimelineEvent = Schemas['TimelineEvent'];
export type TimelinePage = Schemas['TimelinePage'];
export type AssetHealth = Schemas['AssetHealth'];
type AssetHealthBatch = Schemas['AssetHealthBatch'];

type ActivityRefreshRequest =
  paths['/api/activity/refresh']['post']['requestBody']['content']['application/json'];
type TimelineAssetType =
  paths['/api/activity/timeline/{assetType}/{assetId}']['get']['parameters']['path']['assetType'];

/** Query params for the activity timeline endpoints. */
export interface TimelineQueryParams {
  cursor?: string;
  limit?: number;
  resourceTypes?: string[];
  users?: string[];
  eventNames?: string[];
  excludeEventNames?: string[];
  actions?: string[];
  /** Where changes came from: portal-ui, portal-api, portal, console, automation, unknown. */
  origins?: string[];
  startDate?: string;
  endDate?: string;
}

/** The backend reads arrays as comma-separated values; empty ones are left off the wire. */
const csv = (values?: string[]) => (values?.length ? values.join(',') : undefined);

function timelineQuery(params: TimelineQueryParams) {
  return {
    cursor: params.cursor,
    limit: params.limit,
    users: csv(params.users),
    eventNames: csv(params.eventNames),
    excludeEventNames: csv(params.excludeEventNames),
    actions: csv(params.actions),
    origins: csv(params.origins),
    startDate: params.startDate,
    endDate: params.endDate,
  };
}

export type RecipientsData = NonNullable<
  paths['/api/activity/recipients']['post']['responses']['200']['content']['application/json']['data']
>;

export const activityApi = {
  /**
   * QuickSight CloudWatch health for a page of dashboards or datasets:
   * one batched read, cached server-side for a few minutes.
   */
  async getAssetHealth(
    assetType: 'dashboard' | 'dataset',
    ids: string[]
  ): Promise<AssetHealthBatch> {
    return unwrap(
      await client.GET('/api/activity/health', {
        params: { query: { assetType, ids: ids.join(',') } },
      }),
      'Failed to read health'
    );
  },

  /** Queues an activity refresh as a job (or returns the one already running). */
  async refreshActivity(params: ActivityRefreshRequest) {
    return unwrap(
      await client.POST('/api/activity/refresh', { body: params }),
      'Failed to start activity refresh job'
    );
  },

  async getActivityData(
    assetType: 'dashboard' | 'analysis' | 'user',
    assetId: string
  ): Promise<ActivityData | UserActivity> {
    const data = unwrap(
      await client.GET('/api/activity/{assetType}/{assetId}', {
        params: { path: { assetType, assetId } },
      }),
      'Failed to fetch activity data'
    );
    // Only the dataset path answers with DatasetActivityData.
    return data as ActivityData | UserActivity;
  },

  /**
   * Get activity for a dataset: refresh (ingestion) history plus aggregated
   * view/update activity of the dashboards and analyses that use it.
   */
  async getDatasetActivity(datasetId: string): Promise<DatasetActivityData> {
    const data = unwrap(
      await client.GET('/api/activity/{assetType}/{assetId}', {
        params: { path: { assetType: 'dataset', assetId: datasetId } },
      }),
      'Failed to fetch dataset activity'
    );
    return data as DatasetActivityData;
  },

  /** Resolve asset permissions to recipient emails for mailto composition. */
  async resolveRecipients(
    assetType: 'dashboard' | 'analysis',
    assetId: string
  ): Promise<RecipientsData> {
    return unwrap(
      await client.POST('/api/activity/recipients', { body: { assetType, assetId } }),
      'Failed to resolve recipients'
    );
  },

  async getUserInactiveAnalyses(userName: string): Promise<UserInactiveAnalysis[]> {
    return unwrap(
      await client.POST('/api/activity/user-inactive-analyses', { body: { userName } }),
      'Failed to fetch user inactive analyses'
    ).analyses;
  },

  async getUserUnusedDatasets(userName: string): Promise<UserUnusedDataset[]> {
    return unwrap(
      await client.POST('/api/activity/user-unused-datasets', { body: { userName } }),
      'Failed to fetch user unused datasets'
    ).datasets;
  },

  /**
   * Get a page of activity timeline events (global feed of QuickSight mutations).
   * Cursor-based pagination: pass the `nextCursor` from the previous response.
   */
  async getTimeline(params: TimelineQueryParams = {}): Promise<TimelinePage> {
    return unwrap(
      await client.GET('/api/activity/timeline', {
        params: {
          query: { ...timelineQuery(params), resourceTypes: csv(params.resourceTypes) },
        },
      }),
      'Failed to fetch activity timeline'
    );
  },

  /**
   * Get a page of activity timeline events pre-filtered to one catalog asset.
   * Used by the per-asset drill-down from the asset table's actions menu.
   */
  async getAssetTimeline(
    assetType: TimelineAssetType,
    assetId: string,
    params: TimelineQueryParams = {}
  ): Promise<TimelinePage> {
    return unwrap(
      await client.GET('/api/activity/timeline/{assetType}/{assetId}', {
        params: { path: { assetType, assetId }, query: timelineQuery(params) },
      }),
      'Failed to fetch asset activity timeline'
    );
  },
};
