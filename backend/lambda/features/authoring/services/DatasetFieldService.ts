/**
 * A dataset's calculated fields: read them, with who downstream reads each
 * one, and apply the copy and retire edits (../lib/datasetFields) live.
 *
 * Like every other edit to a dataset, it is describe -> patch -> resend the
 * whole specification, against live QuickSight. Retire is the one edit that
 * can break something outside the dataset, so before it writes it reads
 * every dashboard and analysis the lineage says uses the dataset, live, and
 * refuses while any of them still reads the old name (or cannot be read).
 */
import { ValidationError } from '../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import { describeDataSetForEdit, resendDataSet } from '../../../shared/services/aws/datasetUpdate';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import { keepCatalogFresh } from '../../../shared/services/catalog/assetFreshness';
import { LineageService } from '../../../shared/services/lineage/LineageService';
import { ASSET_TYPES } from '../../../shared/types/assetTypes';
import { logger } from '../../../shared/utils/logger';
import {
  copyCalculatedField,
  type DatasetCalculatedField,
  type DatasetShape,
  datasetCalculatedFields,
  datasetShape,
  retireCalculatedField,
} from '../lib/datasetFields';
import type { AuthorableAssetType } from '../types';
import type { RebindService } from './RebindService';

export type DatasetFieldOp =
  | { op: 'copyCalculatedField'; name: string; to: string }
  | { op: 'retireCalculatedField'; name: string; replacedBy: string };

interface FieldReader {
  assetType: AuthorableAssetType;
  assetId: string;
  name: string;
  /** The identifier the asset reads the dataset through. */
  identifier: string;
}

/** The latest SPICE refresh: a new column has data only once one has completed after it was added. */
type LatestRefresh = 'running' | 'completed' | 'failed' | 'none';

interface DatasetFields {
  dataSetId: string;
  name: string;
  shape: DatasetShape;
  importMode: string;
  /** SPICE only. */
  latestRefresh?: LatestRefresh;
  fields: Array<DatasetCalculatedField & { readers?: FieldReader[] }>;
  /** Readers that could not be read live, so their use is unknown. */
  unreadable?: Array<{ assetType: AuthorableAssetType; assetId: string; name: string }>;
}

const READ_CONCURRENCY = 5;

export class DatasetFieldService {
  private readonly quickSightService: QuickSightService;

  public constructor(
    accountId: string,
    private readonly rebind: RebindService,
    private readonly lineage = new LineageService()
  ) {
    this.quickSightService = ClientFactory.getQuickSightService(accountId);
  }

  public async fields(
    dataSetId: string,
    options: { readers?: boolean } = {}
  ): Promise<DatasetFields> {
    const described = await this.describe(dataSetId);
    const fields = datasetCalculatedFields(described);
    const importMode = String(described.ImportMode);
    const base = {
      dataSetId,
      name: String(described.Name ?? dataSetId),
      shape: datasetShape(described),
      importMode,
      ...(importMode === 'SPICE' ? { latestRefresh: await this.latestRefresh(dataSetId) } : {}),
    };
    if (!options.readers) return { ...base, fields };
    const { readers, unreadable } = await this.readers(dataSetId);
    return {
      ...base,
      fields: fields.map((field) => ({
        ...field,
        readers: readers.filter((r) => r.columns.includes(field.name)).map((r) => r.reader),
      })),
      ...(unreadable.length ? { unreadable } : {}),
    };
  }

  /** Apply the ops in order; with dryRun, check them all and write nothing. */
  public async apply(
    dataSetId: string,
    ops: DatasetFieldOp[],
    options: { dryRun?: boolean } = {}
  ): Promise<{ dataSetId: string; changes: string[]; written: boolean }> {
    const described = await this.describe(dataSetId);
    const patched = structuredClone(described);
    const changes: string[] = [];
    const retiring = ops.filter((o) => o.op === 'retireCalculatedField').map((o) => o.name);
    if (retiring.length > 0) await this.refuseWhileRead(dataSetId, retiring);
    ops.forEach((op, i) => {
      const at = `ops[${i}] ${op.op}`;
      changes.push(
        op.op === 'copyCalculatedField'
          ? copyCalculatedField(patched, op, at)
          : retireCalculatedField(patched, op, at)
      );
    });
    if (options.dryRun || ops.length === 0) return { dataSetId, changes, written: false };

    logger.info('Updating dataset calculated fields', { dataSetId, ops: ops.length });
    await resendDataSet(this.quickSightService, dataSetId, patched);
    await keepCatalogFresh([
      { assetType: ASSET_TYPES.dataset, assetId: dataSetId, name: String(described.Name ?? '') },
    ]);
    return { dataSetId, changes, written: true };
  }

  private async refuseWhileRead(dataSetId: string, names: string[]): Promise<void> {
    const { readers, unreadable } = await this.readers(dataSetId);
    const still = names.flatMap((name) =>
      readers
        .filter((r) => r.columns.includes(name))
        .map((r) => `${name} is read by ${r.reader.assetType} ${r.reader.name}`)
    );
    if (still.length > 0) {
      throw new ValidationError(`Still read downstream: ${still.join('; ')}`);
    }
    if (unreadable.length > 0) {
      throw new ValidationError(
        `Could not check ${unreadable.map((u) => `${u.assetType} ${u.name}`).join(', ')}, so nothing is removed`
      );
    }
  }

  /** Every live dashboard and analysis on the dataset, with the columns each reads from it. */
  private async readers(dataSetId: string) {
    const lineage = (await this.lineage.getLineageMapForAssets('dataset', [dataSetId])).get(
      `dataset:${dataSetId}`
    );
    const dependents = (lineage?.relationships ?? []).filter(
      (rel) =>
        rel.relationshipType === 'used_by' &&
        !rel.targetIsArchived &&
        (rel.targetAssetType === 'dashboard' || rel.targetAssetType === 'analysis')
    );
    const readers: Array<{ reader: FieldReader; columns: string[] }> = [];
    const unreadable: NonNullable<DatasetFields['unreadable']> = [];
    for (let i = 0; i < dependents.length; i += READ_CONCURRENCY) {
      await Promise.all(
        dependents.slice(i, i + READ_CONCURRENCY).map(async (rel) => {
          const assetType = rel.targetAssetType as AuthorableAssetType;
          try {
            const { datasets, name } = await this.rebind.describeDatasets(
              assetType,
              rel.targetAssetId
            );
            for (const d of datasets.filter((ds) => ds.dataSetId === dataSetId)) {
              readers.push({
                reader: { assetType, assetId: rel.targetAssetId, name, identifier: d.identifier },
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

  private async latestRefresh(dataSetId: string): Promise<LatestRefresh> {
    const { ingestions } = (await this.quickSightService.listIngestions(dataSetId)) as {
      ingestions: Array<{ IngestionStatus?: string; CreatedTime?: string | Date }>;
    };
    const latest = [...ingestions].sort(
      (a, b) => new Date(b.CreatedTime ?? 0).getTime() - new Date(a.CreatedTime ?? 0).getTime()
    )[0];
    switch (latest?.IngestionStatus) {
      case undefined:
        return 'none';
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
      case 'CANCELLED':
        return 'failed';
      default:
        return 'running';
    }
  }

  private describe(dataSetId: string): Promise<Record<string, any>> {
    return describeDataSetForEdit(this.quickSightService, dataSetId);
  }
}
