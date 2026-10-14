/**
 * Every live dashboard and analysis on a dataset, read live: which dataset
 * declaration (identifier) binds it and the columns it reads. The lineage
 * says who reads it; the definition says how. Renaming a field and
 * migrating a dataset both need the same answer.
 */
import { LineageService } from '../../../shared/services/lineage/LineageService';
import { logger } from '../../../shared/utils/logger';
import type { RebindService } from '../services/RebindService';
import type { AuthorableAssetType } from '../types';

export interface DatasetReader {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  /** The dataset declaration in the reader's definition that binds this dataset. */
  identifier: string;
  /** The dataset's columns the reader uses. */
  columns: string[];
}

export interface UnreadableReader {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
}

const READ_CONCURRENCY = 5;

export async function datasetReaders(
  dataSetId: string,
  rebind: Pick<RebindService, 'describeDatasets'>,
  lineage: Pick<LineageService, 'getLineageMapForAssets'> = new LineageService()
): Promise<{ readers: DatasetReader[]; unreadable: UnreadableReader[] }> {
  const map = await lineage.getLineageMapForAssets('dataset', [dataSetId]);
  const dependents = (map.get(`dataset:${dataSetId}`)?.relationships ?? []).filter(
    (rel) =>
      rel.relationshipType === 'used_by' &&
      !rel.targetIsArchived &&
      (rel.targetAssetType === 'dashboard' || rel.targetAssetType === 'analysis')
  );
  const readers: DatasetReader[] = [];
  const unreadable: UnreadableReader[] = [];
  for (let i = 0; i < dependents.length; i += READ_CONCURRENCY) {
    await Promise.all(
      dependents.slice(i, i + READ_CONCURRENCY).map(async (rel) => {
        const assetType = rel.targetAssetType as AuthorableAssetType;
        try {
          const { datasets, name } = await rebind.describeDatasets(assetType, rel.targetAssetId);
          for (const d of datasets.filter((ds) => ds.dataSetId === dataSetId)) {
            readers.push({
              assetType,
              assetId: rel.targetAssetId,
              name,
              identifier: d.identifier,
              columns: d.columns.map((c) => c.name),
            });
          }
        } catch (error) {
          logger.warn('Could not read a dataset reader', { dataSetId, rel, error });
          unreadable.push({ assetType, assetId: rel.targetAssetId, name: rel.targetAssetName });
        }
      })
    );
  }
  return { readers, unreadable };
}
