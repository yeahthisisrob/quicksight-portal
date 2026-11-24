/**
 * Where the metadata sync keeps what it knows, in the portal's bucket: one
 * record per table (the kept text, each place's baseline, a short history)
 * and the report of the last preview and the last run. The records are the
 * source of truth for the text; this store is their only writer.
 */
import { metadataBucketName } from '../../../shared/config/metadataBucket';
import { STATUS_CODES } from '../../../shared/constants/httpStatusCodes';
import { S3Service } from '../../../shared/services/aws/S3Service';
import type { SyncMode, SyncReport, TableRecord } from '../types';

const PREFIX = 'metadata-sync';

const tableRecordKey = (database: string, table: string): string =>
  `${PREFIX}/tables/${encodeURIComponent(database)}/${encodeURIComponent(table)}.json`;
const reportKey = (mode: SyncMode): string => `${PREFIX}/reports/latest-${mode}.json`;

const isMissing = (error: any): boolean =>
  error?.name === 'NoSuchKey' ||
  error?.name === 'NotFound' ||
  error?.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND;

/** The reads and writes a pass needs, so a test can stand in for the bucket. */
export interface SyncRecords {
  getRecord(database: string, table: string): Promise<TableRecord | null>;
  putRecord(record: TableRecord): Promise<void>;
}

export class MetadataSyncStore implements SyncRecords {
  private readonly s3: S3Service;
  private readonly bucket: string;

  public constructor(accountId = process.env.AWS_ACCOUNT_ID || '', s3?: S3Service) {
    this.s3 = s3 ?? new S3Service(accountId);
    this.bucket = metadataBucketName(accountId);
  }

  public getRecord(database: string, table: string): Promise<TableRecord | null> {
    return this.read<TableRecord>(tableRecordKey(database, table));
  }

  public async putRecord(record: TableRecord): Promise<void> {
    await this.s3.putObject(this.bucket, tableRecordKey(record.database, record.table), record);
  }

  public getReport(mode: SyncMode): Promise<SyncReport | null> {
    return this.read<SyncReport>(reportKey(mode));
  }

  public async putReport(report: SyncReport): Promise<void> {
    await this.s3.putObject(this.bucket, reportKey(report.mode), report);
  }

  private async read<T>(key: string): Promise<T | null> {
    try {
      return await this.s3.getObject<T>(this.bucket, key);
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw error;
    }
  }
}
