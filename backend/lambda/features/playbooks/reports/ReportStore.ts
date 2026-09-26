/**
 * Saved reports, kept beyond the jobs' retention: the full report and a
 * summary beside it, so the list reads small files.
 */
import { S3Service } from '../../../shared/services/aws/S3Service';
import type { PlaybookReport, PlaybookReportSummary } from './report';
import { summarize } from './report';

const PREFIX = 'playbooks/reports/';
const SUMMARY_PREFIX = 'playbooks/report-summaries/';

export class ReportStore {
  private readonly s3: S3Service;
  private readonly bucket: string;

  public constructor(accountId = process.env.AWS_ACCOUNT_ID || '') {
    this.s3 = new S3Service(accountId);
    this.bucket = process.env.BUCKET_NAME || `quicksight-metadata-bucket-${accountId}`;
  }

  public async save(report: PlaybookReport, savedBy: string): Promise<PlaybookReportSummary> {
    const saved = { ...report, savedAt: new Date().toISOString(), savedBy };
    await this.s3.putObject(this.bucket, `${PREFIX}${report.jobId}.json`, saved);
    const summary = summarize(saved);
    await this.s3.putObject(this.bucket, `${SUMMARY_PREFIX}${report.jobId}.json`, summary);
    return summary;
  }

  public async get(jobId: string): Promise<PlaybookReport | null> {
    const key = `${PREFIX}${jobId}.json`;
    if (!(await this.s3.objectExists(this.bucket, key))) return null;
    return await this.s3.getObject<PlaybookReport>(this.bucket, key);
  }

  /** Newest first. */
  public async list(): Promise<PlaybookReportSummary[]> {
    const objects = await this.s3.listObjects(this.bucket, SUMMARY_PREFIX);
    const summaries = await Promise.all(
      objects.map((o) => this.s3.getObject<PlaybookReportSummary>(this.bucket, o.key))
    );
    return summaries.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
  }

  public async delete(jobId: string): Promise<void> {
    await this.s3.deleteObject(this.bucket, `${PREFIX}${jobId}.json`);
    await this.s3.deleteObject(this.bucket, `${SUMMARY_PREFIX}${jobId}.json`);
  }
}
