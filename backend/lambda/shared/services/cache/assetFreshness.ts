/**
 * Keep the cache current after the portal itself writes to QuickSight, so a
 * dashboard or analysis it just created shows up without an export:
 *
 * 1. at once, a skeleton entry (name, ARN, active) goes into the cache, so
 *    lists, search and the assistant can find it;
 * 2. then an `asset-refresh` job exports just those assets (definition,
 *    permissions, tags, lineage) and upserts their full entries, and the
 *    folders they were put in.
 *
 * Neither may fail the write it follows.
 */
import type { AssetType } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { JobFactory } from '../jobs/JobFactory';
import { cacheService } from './CacheService';

export interface WrittenAssetRef {
  assetType: AssetType;
  assetId: string;
  name?: string;
  arn?: string;
}

export async function keepCacheFresh(
  assets: WrittenAssetRef[],
  context: { accountId?: string; userId?: string } = {}
): Promise<void> {
  if (assets.length === 0) {
    return;
  }
  const now = new Date();
  for (const asset of assets.filter((a) => a.name)) {
    try {
      await cacheService.updateAsset(asset.assetType, asset.assetId, {
        assetName: asset.name,
        ...(asset.arn ? { arn: asset.arn } : {}),
        status: 'active',
        lastUpdatedTime: now,
      } as never);
    } catch (error) {
      logger.warn('Cache: the written asset could not be recorded at once', { ...asset, error });
    }
  }
  const accountId = context.accountId ?? process.env.AWS_ACCOUNT_ID ?? '';
  try {
    await JobFactory.getInstance().createJob({
      jobType: 'asset-refresh',
      accountId,
      bucketName: process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`,
      userId: context.userId ?? 'system',
      assets: assets.map(({ assetType, assetId }) => ({ assetType, assetId })),
    });
  } catch (error) {
    logger.warn('Cache: the refresh of written assets could not be queued', { assets, error });
  }
}
