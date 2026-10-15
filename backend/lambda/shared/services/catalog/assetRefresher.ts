/**
 * Re-export named assets from QuickSight, now. The export slice does the
 * work; each Lambda's composition root registers it here once, so a slice
 * that must see what QuickSight has before it acts (a delete archives the
 * current record) can ask without importing the export slice.
 */
import type { AssetType } from '../../types/assetTypes';
import type { VersionProvenance } from '../history/AssetHistory';

export interface RefreshAssetRef {
  assetType: AssetType;
  assetId: string;
  /** Who wrote it and what changed, for the version the refresh keeps. */
  provenance?: VersionProvenance;
}

export type RefreshAssets = (
  assets: RefreshAssetRef[]
) => Promise<{ refreshed: string[]; missing: string[]; failed: string[] }>;

let registered: RefreshAssets | null = null;

export function registerAssetRefresher(refresh: RefreshAssets): void {
  registered = refresh;
}

/** The registered refresher; undefined where no composition root set one (tests). */
export function assetRefresher(): RefreshAssets | undefined {
  return registered ?? undefined;
}
