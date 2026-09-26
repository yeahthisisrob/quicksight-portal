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
 *
 * Inside `batchFreshness`, step 2 waits: the refs are gathered and one
 * refresh is queued for all of them when the batch ends, so a playbook that
 * writes three hundred datasets queues one job, not three hundred.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import { AssetStatus } from '../../models/asset.model';
import type { AssetType } from '../../types/assetTypes';
import { logger } from '../../utils/logger';
import { JobFactory } from '../jobs/JobFactory';
import { cacheService } from './CacheService';

interface WrittenAssetRef {
  assetType: AssetType;
  assetId: string;
  name?: string;
  arn?: string;
}

/** Assets per refresh job. */
const REFRESH_CHUNK = 50;

const batches = new AsyncLocalStorage<Map<string, WrittenAssetRef>>();

/**
 * Run `work`, holding back the refresh every write inside it asks for; then
 * queue one refresh for all of them (also when `work` throws: what was
 * written was written).
 */
export async function batchFreshness<T>(
  work: () => Promise<T>,
  context: { accountId?: string; userId?: string } = {}
): Promise<T> {
  const gathered = new Map<string, WrittenAssetRef>();
  try {
    return await batches.run(gathered, work);
  } finally {
    await queueRefresh([...gathered.values()], context);
  }
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
        status: AssetStatus.ACTIVE,
        lastUpdatedTime: now,
      } as never);
    } catch (error) {
      logger.warn('Cache: the written asset could not be recorded at once', { ...asset, error });
    }
  }
  const batch = batches.getStore();
  if (batch) {
    for (const asset of assets) {
      batch.set(`${asset.assetType}/${asset.assetId}`, asset);
    }
    return;
  }
  await queueRefresh(assets, context);
}

async function queueRefresh(
  assets: WrittenAssetRef[],
  context: { accountId?: string; userId?: string }
): Promise<void> {
  if (assets.length === 0) {
    return;
  }
  const accountId = context.accountId ?? process.env.AWS_ACCOUNT_ID ?? '';
  // A refresh job re-exports serially; a few hundred at once would outlast a
  // Lambda. Chunks keep each job well inside it and failing alone.
  for (let i = 0; i < assets.length; i += REFRESH_CHUNK) {
    const chunk = assets.slice(i, i + REFRESH_CHUNK);
    try {
      await JobFactory.getInstance().createJob({
        jobType: 'asset-refresh',
        accountId,
        bucketName: process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`,
        userId: context.userId ?? 'system',
        assets: chunk.map(({ assetType, assetId }) => ({ assetType, assetId })),
      });
    } catch (error) {
      logger.warn('Cache: the refresh of written assets could not be queued', {
        assets: chunk,
        error,
      });
    }
  }
}
