/** What the export cache knows, the cheap way a playbook finds its scope. */
import type { CacheEntry } from '../../../shared/models/asset.model';
import { cacheService } from '../../../shared/services/cache/CacheService';
import { AssetStatusFilter } from '../../../shared/types/assetFilterTypes';
import type { AssetType } from '../../../shared/types/assetTypes';

export async function liveEntries(assetType: AssetType): Promise<CacheEntry[]> {
  return await cacheService.getCacheEntries({ assetType, statusFilter: AssetStatusFilter.ACTIVE });
}

export function idFromArn(arn: string | undefined): string | undefined {
  return arn?.split('/').pop() || undefined;
}

/** Every data source id a dataset reads, from its cached lineage. */
export function datasourceIdsOf(dataset: CacheEntry): string[] {
  const lineage = dataset.metadata?.lineageData;
  const ids = [
    ...(lineage?.datasourceIds ?? []),
    ...(lineage?.datasourceArns ?? []).map(idFromArn),
    ...(dataset.metadata?.datasourceArns ?? []).map(idFromArn),
  ];
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}
