/**
 * What an entry learns from the others once they are all built: a folder's
 * full path from its parents' names, and the names behind the dataset and
 * data source ids an asset's lineage lists (so they are searchable). Pure,
 * and the same for a full rebuild and for one type: the caller passes the
 * entries to change and every entry to look names up in.
 */
import type { CatalogEntry } from '../../models/asset.model';

const idOfArn = (arn: string): string | undefined => arn.split('/').pop() || undefined;

/** Each folder's full path (`/Parent/Child`) and parent id, from the folders it sits in. */
export function resolveFolderPaths(folders: CatalogEntry[], allFolders: CatalogEntry[]): void {
  const byId = new Map(allFolders.map((f) => [f.assetId, f]));
  for (const f of folders) byId.set(f.assetId, f);
  for (const folder of folders) {
    const parents: string[] = Array.isArray(folder.metadata?.folderPath)
      ? folder.metadata.folderPath
      : [];
    const names = parents
      .map(idOfArn)
      .filter((id): id is string => Boolean(id))
      .map((id) => byId.get(id)?.assetName ?? id);
    folder.metadata.fullPath = `/${[...names, folder.assetName].join('/')}`;
    const parentArn = parents.at(-1);
    if (parentArn) folder.metadata.parentId = idOfArn(parentArn);
  }
}

/**
 * Names for the ids in each entry's lineage: datasets for dashboards,
 * analyses and composite datasets, data sources for datasets. An id with no
 * entry keeps the id as its name.
 */
export function resolveLineageNames(
  entries: CatalogEntry[],
  datasets: CatalogEntry[],
  datasources: CatalogEntry[]
): void {
  const datasetNames = new Map(datasets.map((d) => [d.assetId, d.assetName]));
  const datasourceNames = new Map(datasources.map((d) => [d.assetId, d.assetName]));
  const named = (ids: string[], names: Map<string, string>) =>
    ids.map((id) => ({ id, name: names.get(id) || id }));
  for (const entry of entries) {
    const lineage = entry.metadata?.lineageData;
    if (!lineage) continue;
    if (lineage.datasetIds?.length) lineage.datasets = named(lineage.datasetIds, datasetNames);
    if (entry.assetType === 'dataset' && lineage.datasourceIds?.length) {
      lineage.datasources = named(lineage.datasourceIds, datasourceNames);
    }
  }
}
