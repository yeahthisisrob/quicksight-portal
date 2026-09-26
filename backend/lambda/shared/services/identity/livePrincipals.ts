/**
 * Permissions kept in an archive can name users and groups deleted since,
 * and QuickSight refuses a whole create over one principal it does not know.
 */
import { AssetStatusFilter } from '../../types/assetFilterTypes';
import { logger } from '../../utils/logger';
import { cacheService } from '../cache/CacheService';

const PRINCIPAL_KIND = /:(user|group)\//;

/**
 * An archived audience, less the users and groups deleted since: QuickSight
 * refuses a whole create over one principal it does not know. Anything that
 * is not a user or group ARN (a namespace, an account) is kept as it is.
 * When the user and group caches cannot be read, nothing is dropped.
 */
export async function keepLivePrincipals(
  permissions: any[]
): Promise<{ permissions: any[]; dropped: string[]; warnings: string[] }> {
  if (permissions.length === 0) {
    return { permissions, dropped: [], warnings: [] };
  }
  let known: Set<string>;
  try {
    const [users, groups] = await Promise.all(
      (['user', 'group'] as const).map((assetType) =>
        cacheService.getCacheEntries({ assetType, statusFilter: AssetStatusFilter.ACTIVE })
      )
    );
    known = new Set([...(users ?? []), ...(groups ?? [])].map((e: any) => String(e.arn ?? '')));
  } catch (error) {
    logger.warn('Principal check skipped: users and groups could not be read', { error });
    return { permissions, dropped: [], warnings: [] };
  }
  const kept: any[] = [];
  const dropped: string[] = [];
  for (const permission of permissions) {
    const principal = String(permission?.Principal ?? '');
    if (PRINCIPAL_KIND.test(principal) && !known.has(principal)) {
      dropped.push(principal);
    } else {
      kept.push(permission);
    }
  }
  const warnings =
    dropped.length > 0
      ? [
          `${dropped.length} of its former users or groups no longer exist and were left out: ${dropped
            .map((arn) => arn.split('/').pop())
            .join(', ')}.`,
        ]
      : [];
  return { permissions: kept, dropped, warnings };
}
