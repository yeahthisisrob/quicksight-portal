import { AssetService } from './AssetService';
import { logger } from '../../../shared/utils/logger';

/**
 * Precompute and persist the user/group list snapshots after a cache rebuild.
 *
 * Runs in the worker Lambda at the end of export and activity-refresh jobs.
 * The snapshots land in S3 (`cache/derived/...`), where the API Lambda's
 * CollectionListSnapshotCache adopts them on the next request instead of
 * paying the enrichment cost. The version keys are ETag-derived, so a
 * post-rebuild call naturally recomputes — no force flag needed.
 *
 * Never throws: snapshot warming is an optimization and must not fail jobs.
 */
export async function warmCollectionSnapshots(): Promise<void> {
  try {
    const accountId = process.env.AWS_ACCOUNT_ID || '';
    const assetService = new AssetService(accountId);
    await assetService.warmCollectionSnapshots();
    logger.info('Warmed collection list snapshots');
  } catch (error) {
    logger.error('Failed to warm collection snapshots (non-fatal)', { error });
  }
}
