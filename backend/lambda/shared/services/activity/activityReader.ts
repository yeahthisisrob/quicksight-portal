/**
 * Reading activity (views, viewers, last seen) without depending on the
 * activity slice: the slice's ActivityService is registered here by each
 * Lambda's composition root, and a slice that shows activity (asset lists,
 * insights) reads through this. Unregistered (a unit test), it reads as
 * nothing recorded.
 */
import type { AssetType } from '../../types/assetTypes';

type Viewed = Extract<AssetType, 'dashboard' | 'analysis'>;

interface AssetActivitySummary {
  totalViews?: number;
  uniqueViewers?: number;
  lastViewed?: string | null;
  viewsLast30Days?: number;
  activities?: Array<{ timestamp?: string; eventName?: string }>;
}

interface DatasetActivityCounts {
  totalViews: number;
  uniqueViewers: number;
  lastViewed: string | null;
  lastRefreshTime: string | null;
  lastRefreshStatus: string | null;
}

interface UserActivityCounts {
  totalActivities: number;
  lastActive: string;
  dashboardCount: number;
  analysisCount: number;
}

export interface ActivityReader {
  getAssetActivity(assetType: Viewed, assetId: string): Promise<AssetActivitySummary | null>;
  getAssetActivityCounts(
    assetType: Viewed,
    assetIds: string[]
  ): Promise<Map<string, { totalViews: number; uniqueViewers: number; lastViewed: string }>>;
  getDatasetActivityCounts(
    dependentsByDataset: Map<string, { dashboardIds: string[]; analysisIds: string[] }>
  ): Promise<Map<string, DatasetActivityCounts>>;
  getUserActivityCounts(userNames: string[]): Promise<Map<string, UserActivityCounts>>;
}

const NOTHING_RECORDED: ActivityReader = {
  getAssetActivity: async () => null,
  getAssetActivityCounts: async () => new Map(),
  getDatasetActivityCounts: async () => new Map(),
  getUserActivityCounts: async () => new Map(),
};

let make: (() => ActivityReader) | null = null;
let made: ActivityReader | null = null;

/** A root registers how to make the reader; it is made on first use. */
export function registerActivityReader(factory: () => ActivityReader): void {
  make = factory;
  made = null;
}

export function activityReader(): ActivityReader {
  if (!made) made = make ? make() : null;
  return made ?? NOTHING_RECORDED;
}
