/**
 * Every dashboard and analysis reading a dataset, repaired in place after
 * the dataset changed under them: a column renamed or gone, a parameter
 * no longer declared, an error QuickSight itself reports. Each reader is
 * read live, its repair plan drawn, and the plan's proposed fixes applied
 * as one update, so what took a model eleven calls is one deterministic
 * pass. A reader whose plan still needs a choice (a column with no clear
 * match) is left as it is and named, never guessed.
 */
import type { AuthContext } from '../../../shared/auth';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { ClientFactory } from '../../../shared/services/aws/ClientFactory';
import type { QuickSightService } from '../../../shared/services/aws/QuickSightService';
import type { LineageService } from '../../../shared/services/lineage/LineageService';
import { logger } from '../../../shared/utils/logger';
import { type DatasetReader, datasetReaders, type UnreadableReader } from '../lib/datasetReaders';
import type { RepairPlan } from '../lib/repairPlan';
import type { RebindService } from './RebindService';

type ReaderRef = Pick<DatasetReader, 'assetType' | 'assetId' | 'name'>;

interface ReaderRepairPlan extends ReaderRef {
  plan: RepairPlan;
}

export interface DatasetReadersRepairPreview {
  dataSetId: string;
  name: string;
  /** Every live reader with its repair plan; a clean one has no issues. */
  readers: ReaderRepairPlan[];
  /** Readers the lineage names that could not be read. */
  unreadable: UnreadableReader[];
  /** Readers with at least one fix to apply. */
  toRepair: number;
}

interface ReaderRepairResult extends ReaderRef {
  /** `repaired`: fixes applied; `clean`: nothing to fix; `needsChoice`: a fix needs a person; `failed`: the write was refused. */
  outcome: 'repaired' | 'clean' | 'needsChoice' | 'failed';
  changes?: number;
  error?: string;
}

export interface DatasetReadersRepairResult extends DatasetReadersRepairPreview {
  results: ReaderRepairResult[];
}

export class DatasetReadersRepairService {
  private readonly quickSight: QuickSightService;

  public constructor(
    accountId: string,
    private readonly rebind: Pick<RebindService, 'describeDatasets' | 'repairPlan' | 'apply'>,
    private readonly lineage?: LineageService
  ) {
    this.quickSight = ClientFactory.getQuickSightService(accountId);
  }

  public async preview(dataSetId: string): Promise<DatasetReadersRepairPreview> {
    const described = await this.quickSight.describeDataset(dataSetId).catch(() => undefined);
    if (!described) {
      throw new ValidationError(`Dataset ${dataSetId} could not be read from QuickSight`);
    }
    const { readers, unreadable } = await datasetReaders(dataSetId, this.rebind, this.lineage);
    const plans = await Promise.all(
      readers.map(
        async (reader): Promise<ReaderRepairPlan> => ({
          assetType: reader.assetType,
          assetId: reader.assetId,
          name: reader.name,
          plan: await this.rebind.repairPlan(reader.assetType, reader.assetId),
        })
      )
    );
    return {
      dataSetId,
      name: String(described.Name ?? dataSetId),
      readers: plans,
      unreadable,
      toRepair: plans.filter((p) => hasFixes(p.plan)).length,
    };
  }

  public async repair(dataSetId: string, auth?: AuthContext): Promise<DatasetReadersRepairResult> {
    const preview = await this.preview(dataSetId);
    const results: ReaderRepairResult[] = [];
    for (const reader of preview.readers) {
      const ref = { assetType: reader.assetType, assetId: reader.assetId, name: reader.name };
      if (reader.plan.issues.length === 0) {
        results.push({ ...ref, outcome: 'clean' });
        continue;
      }
      if (!hasFixes(reader.plan)) {
        results.push({ ...ref, outcome: 'needsChoice' });
        continue;
      }
      try {
        const applied = await this.rebind.apply(
          reader.assetType,
          reader.assetId,
          {
            mode: 'update',
            rebinds: reader.plan.proposed.rebinds,
            repairs: reader.plan.proposed.repairs,
          },
          auth
        );
        results.push({ ...ref, outcome: 'repaired', changes: applied.changes.length });
      } catch (error: any) {
        logger.warn('A reader could not be repaired', { dataSetId, reader: ref, error });
        results.push({ ...ref, outcome: 'failed', error: error?.message ?? 'unknown error' });
      }
    }
    logger.info('Repaired the readers of a dataset', {
      dataSetId,
      repaired: results.filter((r) => r.outcome === 'repaired').length,
      failed: results.filter((r) => r.outcome === 'failed').length,
      needsChoice: results.filter((r) => r.outcome === 'needsChoice').length,
    });
    return { ...preview, results };
  }
}

/** A plan with something to apply and nothing left to a person's choice. */
function hasFixes(plan: RepairPlan): boolean {
  return plan.summary.fixable > 0 && plan.summary.needsChoice === 0;
}
