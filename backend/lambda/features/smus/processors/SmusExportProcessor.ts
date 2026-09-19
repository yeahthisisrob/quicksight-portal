/**
 * SmusExportProcessor - runs one SMUS export job: sweep the domain through
 * SmusExportService, narrate progress into the job log, and mark the job.
 */
import { DataZoneAdapter } from '../../../adapters/aws/DataZoneAdapter';
import { StsAdapter } from '../../../adapters/aws/StsAdapter';
import { getSmusConfig } from '../../../shared/config/smusConfig';
import { CacheService } from '../../../shared/services/cache/CacheService';
import type { JobStateService } from '../../../shared/services/jobs/JobStateService';
import { settingsStore } from '../../../shared/services/settings/SettingsStore';
import { SmusExportService } from '../../../shared/services/smus/SmusExportService';
import { SmusService } from '../../../shared/services/smus/SmusService';
import { logger } from '../../../shared/utils/logger';

const PROGRESS = { started: 5, swept: 60, written: 100 } as const;

export class SmusExportProcessor {
  public constructor(
    private readonly jobStateService: JobStateService,
    private readonly jobId: string
  ) {}

  public async run(): Promise<void> {
    // The worker has no request to warm the store for; read settings now so
    // a domain chosen in the UI is the one that gets swept.
    await settingsStore.load(true);
    const config = getSmusConfig();
    if (!config.enabled) {
      throw new Error('SMUS is not configured: set the domain id in Settings first');
    }

    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'processing',
      message: `Sweeping SMUS domain ${config.domainId} (${config.region})`,
      progress: PROGRESS.started,
    });

    const exporter = new SmusExportService(
      CacheService.getInstance(),
      new DataZoneAdapter(config.region),
      new StsAdapter(config.region),
      config
    );
    let step = 0;
    const snapshot = await exporter.run(this.jobId, async (message, details) => {
      step += 1;
      await this.jobStateService.logInfo(this.jobId, message, details);
      await this.jobStateService.updateJobStatus(this.jobId, {
        message,
        progress: step === 1 ? PROGRESS.started : PROGRESS.swept,
      });
    });
    SmusService.invalidateLinkMap();

    const d = snapshot.diagnostics;
    const problems = [d.listProjectsError, d.listingsError].filter(Boolean);
    const summary = `${snapshot.projects.length} projects, ${snapshot.listings.length} listings, ${d.publishers} publishers`;
    if (problems.length > 0) {
      await this.jobStateService.logWarn(
        this.jobId,
        'The sweep hit errors; the snapshot is partial',
        {
          errors: problems,
        }
      );
    }
    logger.info('SMUS export finished', { jobId: this.jobId, summary });
    await this.jobStateService.updateJobStatus(this.jobId, {
      status: 'completed',
      endTime: new Date().toISOString(),
      message: problems.length > 0 ? `Exported with errors: ${summary}` : `Exported ${summary}`,
      progress: PROGRESS.written,
    });
  }
}
