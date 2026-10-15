/**
 * What activity reads give back when nothing is recorded: zeros and no date,
 * never "not found". The list already counts such people and assets at zero;
 * the dialog that opens on them says "never" instead of failing.
 */
import type { AssetType } from '../../../shared/types/assetTypes';
import type { AssetActivityData, UserActivityData } from '../types';

export function emptyUserActivity(userName: string): UserActivityData {
  return {
    userName,
    lastActive: null,
    totalActivities: 0,
    activitiesByDate: {},
    dashboards: [],
    analyses: [],
  };
}

export function emptyAssetActivity(
  assetType: Extract<AssetType, 'dashboard' | 'analysis'>,
  assetId: string,
  assetName: string | undefined
): AssetActivityData {
  return {
    assetId,
    assetName,
    assetType,
    totalViews: 0,
    uniqueViewers: 0,
    lastViewed: null,
    viewsByDate: {},
    viewers: [],
  };
}
