/**
 * MetadataSyncProcessor - runs one metadata sync job: a preview or a run
 * over every table in the SMUS snapshot, narrated into the job log, with
 * the report written for the Operations page.
 */
import { DataZoneAdapter, type ProjectAsset } from '../../../adapters/aws/DataZoneAdapter';
import { GlueAdapter } from '../../../adapters/aws/GlueAdapter';
import { getMetadataSyncConfig } from '../../../shared/config/metadataSyncConfig';
import { getSmusConfig } from '../../../shared/config/smusConfig';
import { CacheService } from '../../../shared/services/cache/CacheService';
import type { JobStateService } from '../../../shared/services/jobs/JobStateService';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { SmusService } from '../../../shared/services/smus/SmusService';
import { errorMessage } from '../../../shared/utils/errorMessage';
import { logger } from '../../../shared/utils/logger';
import { MetadataSyncService } from '../services/MetadataSyncService';
import { MetadataSyncStore } from '../services/MetadataSyncStore';
import type { SyncMode, SyncReport } from '../types';

const PROGRESS = { started: 5, read: 10, done: 100 } as const;
/** Progress is written every this many tables, not after each. */
const PROGRESS_EVERY = 10;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A report in one line, for the job and the log. */
function reportSummary(report: SyncReport): string {
  const t = report.totals;
  const wrote = report.mode === 'preview' ? 'to write' : 'written';
  const parts = [
    plural(t.tables, 'table'),
    `${plural(t.adoptions, 'edit')} adopted`,
    `${plural(t.writes, 'field')} ${wrote}`,
  ];
  if (t.conflicts > 0) parts.push(plural(t.conflicts, 'conflict'));
  if (t.failed > 0) parts.push(`${t.failed} failed`);
  return parts.join(', ');
}

export class MetadataSyncProcessor {
  public constructor(
    private readonly jobStateService: JobStateService,
    private readonly jobId: string
  ) {}

  public async run(mode: SyncMode, startedBy?: string): Promise<void> {
    // The worker has no request to warm the settings for.
    await settingsStore.load(true);
    const config = getMetadataSyncConfig();
    if (!config.enabled) {
      throw new Error(
        config.turnedOn
          ? 'Metadata sync needs SMUS configured: set the domain id in Settings first'
          : 'Metadata sync is turned off in Settings'
      );
    }
    const smus = getSmusConfig();
    const snapshot = await new SmusService(CacheService.getInstance(), smus).getSnapshot();
    if (!snapshot) {
      throw new Error('No SMUS snapshot yet: run the SMUS export first');
    }

    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'processing',
      message: mode === 'preview' ? 'Finding the tables to preview' : 'Finding the tables to sync',
      progress: PROGRESS.started,
    });

    const dataZone = new DataZoneAdapter(smus.region);
    // The published listings the export read, then every asset of the projects picked.
    const assets: ProjectAsset[] = snapshot.listings.flatMap((listing) =>
      listing.table ? [{ assetId: listing.assetId, name: listing.name, table: listing.table }] : []
    );
    const problems: string[] = [];
    for (const projectId of config.projectIds) {
      const name = snapshot.projects.find((p) => p.id === projectId)?.name ?? projectId;
      try {
        const owned = await dataZone.listProjectAssets(smus.domainId, projectId);
        assets.push(...owned);
        await this.jobStateService.logInfo(
          this.jobId,
          `Project ${name}: ${owned.length} table assets`
        );
      } catch (error) {
        const reason = `The assets of project ${name} could not be listed: ${errorMessage(error)}`;
        problems.push(reason);
        await this.jobStateService.logWarn(this.jobId, reason);
      }
    }

    const store = new MetadataSyncStore();
    const service = new MetadataSyncService(
      new GlueAdapter(smus.region),
      dataZone,
      store,
      smus.domainId
    );
    const report = await service.run({
      mode,
      assets,
      snapshotAt: snapshot.exportedAt,
      problems,
      jobId: this.jobId,
      startedBy,
      progress: async (done, total) => {
        if (done % PROGRESS_EVERY !== 0 && done !== total) return;
        await this.jobStateService.updateJobStatus(this.jobId, {
          message: `Read ${done} of ${total} tables`,
          progress:
            PROGRESS.read + Math.round(((PROGRESS.done - PROGRESS.read - 1) * done) / total),
        });
      },
    });
    await store.putReport(report);

    for (const table of report.tables) {
      const name = `${table.database}.${table.table}`;
      for (const side of table.sides.filter((s) => s.outcome === 'failed')) {
        await this.jobStateService.logWarn(this.jobId, `${name}: ${side.label} failed`, {
          side: side.kind,
          error: side.error,
        });
      }
      if (table.conflicts.length > 0) {
        await this.jobStateService.logWarn(this.jobId, `${name}: conflict, nothing written`, {
          fields: table.conflicts.map((c) => `${c.key} ${c.field}`),
        });
      }
    }

    const summary = reportSummary(report);
    logger.info('Metadata sync finished', { jobId: this.jobId, mode, summary });
    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: `${mode === 'preview' ? 'Preview' : 'Synced'}: ${summary}`,
      progress: PROGRESS.done,
    });
  }
}
