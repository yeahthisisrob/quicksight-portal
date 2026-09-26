/**
 * One row per thing a job works through: an asset a playbook checks or
 * changes, with what was found, what was done and why it failed. Rows live
 * in the job's own partition (pk = jobId, sk = ITEM#<key>), so they are
 * written one at a time as work finishes (no 400KB job item to outgrow),
 * read back in order, and deleted with the job.
 *
 * Keys sort by stage first, so a job that must finish one kind of change
 * before the next (analyses before the datasets they read) reads its rows
 * back in the order it has to do them.
 */
import { JOB_CONFIG } from '../../constants';
import type { AssetType } from '../../types/assetTypes';
import { DynamoDBService } from '../aws/DynamoDBService';
import { JOB_TTL_GRACE_DAYS, jobsTableName } from './jobsTable';

export type JobItemStatus = 'pending' | 'planned' | 'done' | 'failed' | 'skipped' | 'review';
/** What a check found: something to change, something a person must decide, or nothing to do. */
export type JobItemVerdict = 'change' | 'review' | 'skip';

export interface JobItem {
  key: string;
  stage: number;
  assetType: AssetType;
  assetId: string;
  name: string;
  status: JobItemStatus;
  verdict?: JobItemVerdict;
  /** One line: what it found or did. */
  summary?: string;
  /** Each change, in words. */
  changes?: string[];
  warnings?: string[];
  error?: string;
  attempts?: number;
  updatedAt: string;
  /** The playbook's own plan for this item, handed back to it when it applies. */
  plan?: unknown;
}

export type JobItemCounts = Record<JobItemStatus, number> & {
  total: number;
  /** What the checks found, whatever became of it since. */
  verdicts: Record<JobItemVerdict, number>;
};

const ITEM_SK_PREFIX = 'ITEM#';
const STAGE_PAD = 3;
const MS_PER_SECOND = 1000;
const SECONDS_PER_DAY = 86_400;
const DEFAULT_PAGE = 100;

export function jobItemKey(stage: number, assetType: string, assetId: string): string {
  return `${String(stage).padStart(STAGE_PAD, '0')}#${assetType}#${assetId}`;
}

export function countItems(items: Array<Pick<JobItem, 'status' | 'verdict'>>): JobItemCounts {
  const counts: JobItemCounts = {
    total: items.length,
    pending: 0,
    planned: 0,
    done: 0,
    failed: 0,
    skipped: 0,
    review: 0,
    verdicts: { change: 0, review: 0, skip: 0 },
  };
  for (const item of items) {
    counts[item.status]++;
    if (item.verdict) counts.verdicts[item.verdict]++;
  }
  return counts;
}

export class JobItemStore {
  private readonly dynamo: DynamoDBService;
  private readonly tableName: string;

  public constructor(dynamo: DynamoDBService = new DynamoDBService()) {
    this.dynamo = dynamo;
    this.tableName = jobsTableName();
  }

  public async putAll(jobId: string, items: JobItem[]): Promise<void> {
    if (items.length === 0) return;
    await this.dynamo.ensureJobsTableExists(this.tableName);
    await this.dynamo.batchPut(
      this.tableName,
      items.map((item) => this.toRow(jobId, item))
    );
  }

  public async put(jobId: string, item: JobItem): Promise<void> {
    await this.dynamo.putItem(this.tableName, this.toRow(jobId, item));
  }

  /** Every row, in key order (stage, then type, then id). */
  public async all(jobId: string): Promise<JobItem[]> {
    await this.dynamo.ensureJobsTableExists(this.tableName);
    const rows = await this.dynamo.queryPartition<Record<string, any>>(
      this.tableName,
      'pk',
      jobId,
      { sortKeyBeginsWith: { name: 'sk', prefix: ITEM_SK_PREFIX } }
    );
    return rows.map((row) => this.fromRow(row));
  }

  /**
   * A page of rows after `cursor`, optionally only those with this status.
   * Filtering happens after the read: a job's rows are few enough (thousands)
   * that one consistent query is cheaper than an index.
   */
  public async page(
    jobId: string,
    options: { status?: JobItemStatus; verdict?: JobItemVerdict; cursor?: string; limit?: number }
  ): Promise<{ items: JobItem[]; counts: JobItemCounts; cursor?: string }> {
    const rows = await this.all(jobId);
    const matching = rows.filter(
      (row) =>
        (!options.status || row.status === options.status) &&
        (!options.verdict || row.verdict === options.verdict)
    );
    const start = options.cursor ? matching.findIndex((row) => row.key > options.cursor!) : 0;
    const from = start < 0 ? matching.length : start;
    const limit = options.limit ?? DEFAULT_PAGE;
    const items = matching.slice(from, from + limit);
    const last = items.at(-1);
    return {
      items,
      counts: countItems(rows),
      ...(last && from + limit < matching.length ? { cursor: last.key } : {}),
    };
  }

  private toRow(jobId: string, item: JobItem): Record<string, any> {
    return {
      ...JSON.parse(JSON.stringify(item)),
      pk: jobId,
      sk: `${ITEM_SK_PREFIX}${item.key}`,
      expiresAt:
        Math.ceil(Date.now() / MS_PER_SECOND) +
        (JOB_CONFIG.DEFAULT_RETENTION_DAYS + JOB_TTL_GRACE_DAYS) * SECONDS_PER_DAY,
    };
  }

  private fromRow(row: Record<string, any>): JobItem {
    const { pk: _pk, sk: _sk, expiresAt: _e, ...item } = row;
    return item as JobItem;
  }
}
