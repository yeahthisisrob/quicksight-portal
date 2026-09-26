/**
 * InsightsService - how an asset is used and how healthy it is, so Author
 * can rank what to start from and flag what not to clone.
 *
 * Views come from the portal's own activity data (CloudTrail, already
 * collected for the activity pages). Health comes from the metrics
 * QuickSight publishes to CloudWatch for dashboards: view load time and,
 * per visual, load time and load errors. Metrics are optional - an
 * account without them simply gets no health section.
 */

import type { CloudWatchAdapter } from '../../../adapters/aws/CloudWatchAdapter';
import { logger } from '../../../shared/utils/logger';
import type { buildOutline } from '../lib/definitionOutline';
import type { AuthorableAssetType } from '../types';

interface AssetInsights {
  assetType: AuthorableAssetType;
  assetId: string;
  views: { total: number; last30d: number; uniqueViewers: number; lastViewedAt?: string };
  health?: {
    windowDays: number;
    viewLoads: number;
    viewLoadTimeP90Ms?: number;
    visuals: Array<{ sheetId: string; visualId: string; loadTimeP90Ms?: number; errors?: number }>;
  };
}

/** The slice of ActivityService this needs. */
interface ActivityReader {
  getAssetActivity(
    assetType: 'dashboard' | 'analysis',
    assetId: string
  ): Promise<{
    totalViews?: number;
    uniqueViewers?: number;
    lastViewed?: string | null;
    viewsLast30Days?: number;
    activities?: Array<{ timestamp?: string; eventName?: string }>;
  } | null>;
}

interface DefinitionReader {
  loadDefinitionOutline(
    assetType: AuthorableAssetType,
    assetId: string
  ): Promise<ReturnType<typeof buildOutline>>;
}

const WINDOW_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export class InsightsService {
  public constructor(
    private readonly activity: ActivityReader,
    private readonly definitions: DefinitionReader,
    private readonly cloudWatch: CloudWatchAdapter | null
  ) {}

  public async get(assetType: AuthorableAssetType, assetId: string): Promise<AssetInsights> {
    const [activity, health] = await Promise.all([
      this.activity.getAssetActivity(assetType, assetId).catch((error) => {
        logger.warn('Activity unavailable for insights', { assetType, assetId, error });
        return null;
      }),
      assetType === 'dashboard' ? this.health(assetId) : Promise.resolve(undefined),
    ]);

    const since = Date.now() - WINDOW_DAYS * MS_PER_DAY;
    const last30d =
      activity?.viewsLast30Days ??
      (activity?.activities ?? []).filter(
        (a) => a.timestamp && new Date(a.timestamp).getTime() >= since
      ).length;

    return {
      assetType,
      assetId,
      views: {
        total: activity?.totalViews ?? 0,
        last30d,
        uniqueViewers: activity?.uniqueViewers ?? 0,
        lastViewedAt: activity?.lastViewed ?? undefined,
      },
      ...(health ? { health } : {}),
    };
  }

  private async health(dashboardId: string): Promise<AssetInsights['health'] | undefined> {
    if (!this.cloudWatch) {
      return undefined;
    }
    try {
      const outline = await this.definitions.loadDefinitionOutline('dashboard', dashboardId);
      const visuals = outline.flatMap((sheet) =>
        sheet.elements
          .filter((e) => e.kind === 'visual')
          .map((e) => ({ sheetId: sheet.sheetId, visualId: e.elementId }))
      );
      const result = await this.cloudWatch.getDashboardHealth(dashboardId, visuals, WINDOW_DAYS);
      // Only report visuals that have any data; an all-undefined list is noise.
      const reported = result.visuals.filter(
        (v) => v.loadTimeP90Ms !== undefined || (v.errors ?? 0) > 0
      );
      if (result.viewLoads === 0 && reported.length === 0) {
        return undefined;
      }
      return { ...result, visuals: reported };
    } catch (error) {
      logger.warn('CloudWatch health unavailable', { dashboardId, error });
      return undefined;
    }
  }
}
