/** What a playbook reads off a catalog entry, the cheap way it finds its scope. */
import type { CatalogEntry } from '../../../shared/models/asset.model';

export function idFromArn(arn: string | undefined): string | undefined {
  return arn?.split('/').pop() || undefined;
}

/** Every data source id a dataset reads, from its cached lineage. */
export function datasourceIdsOf(dataset: CatalogEntry): string[] {
  const lineage = dataset.metadata?.lineageData;
  const ids = [
    ...(lineage?.datasourceIds ?? []),
    ...(lineage?.datasourceArns ?? []).map(idFromArn),
    ...(dataset.metadata?.datasourceArns ?? []).map(idFromArn),
  ];
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}
