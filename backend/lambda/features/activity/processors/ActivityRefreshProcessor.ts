/**
 * ActivityRefreshProcessor - Processes activity refresh jobs in background
 * Handles CloudTrail fetching and activity cache updates without timeouts
 */

import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';

import { CloudTrailAdapter } from '../../../adapters/aws/CloudTrailAdapter';
import { PAGINATION } from '../../../shared/constants';
import { CacheService } from '../../../shared/services/cache/CacheService';
import { type JobStateService } from '../../../shared/services/jobs/JobStateService';
import { logger } from '../../../shared/utils/logger';
import { GroupService } from '../../organization/services/GroupService';
import { ActivityService } from '../services/ActivityService';
import { type ActivityRefreshRequest } from '../types';

export interface ActivityRefreshOptions {
  assetTypes: ('dashboard' | 'analysis' | 'user' | 'all')[];
  days?: number;
}

export class ActivityRefreshProcessor {
  private readonly activityService: ActivityService;
  private jobId: string = '';
  private jobStateService: JobStateService | null = null;

  constructor(region: string = 'us-east-1') {
    const cacheService = CacheService.getInstance();
    const cloudTrailClient = new CloudTrailClient({ region });
    const cloudTrailAdapter = new CloudTrailAdapter(cloudTrailClient, region);
    const groupService = new GroupService();

    this.activityService = new ActivityService(cacheService, cloudTrailAdapter, groupService);
  }

  /**
   * Process the activity refresh job
   */
  public async processActivityRefresh(options: ActivityRefreshOptions): Promise<void> {
    const startTime = Date.now();

    try {
      await this.updateJobProgress('Starting activity refresh', 0);

      logger.info('Processing activity refresh job', {
        jobId: this.jobId,
        assetTypes: options.assetTypes,
        days: options.days,
      });

      // Convert options to ActivityRefreshRequest format
      const request: ActivityRefreshRequest = {
        assetTypes: options.assetTypes,
        days: options.days,
      };

      // Track progress
      const PROGRESS_FETCH_START = 10;
      await this.updateJobProgress('Fetching CloudTrail events', PROGRESS_FETCH_START);

      // Process the refresh (this method handles all the heavy lifting)
      const result = await this.activityService.refreshActivity(request);

      if (!result.success) {
        throw new Error(result.message || 'Activity refresh failed');
      }

      // Log completion
      const duration = Date.now() - startTime;
      logger.info('Activity refresh completed', {
        jobId: this.jobId,
        duration,
        refreshed: result.refreshed,
      });

      await this.updateJobProgress(
        `Activity refresh completed. ${result.message}`,
        PAGINATION.MAX_PAGE_SIZE,
        {
          refreshed: result.refreshed,
          duration,
        }
      );
    } catch (error) {
      logger.error('Activity refresh failed', {
        jobId: this.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.updateJobProgress(
        `Activity refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        -1
      );

      throw error;
    }
  }

  /**
   * Set the job state service for progress tracking
   */
  public setJobStateService(jobStateService: JobStateService, jobId: string): void {
    this.jobStateService = jobStateService;
    this.jobId = jobId;
  }

  /**
   * Update job progress
   */
  private async updateJobProgress(message: string, progress: number, stats?: any): Promise<void> {
    if (!this.jobStateService) {
      return;
    }

    try {
      if (progress === -1) {
        // Mark as failed
        await this.jobStateService.updateJobStatus(this.jobId, {
          status: 'failed',
          message,
          endTime: new Date().toISOString(),
        });
      } else if (progress === PAGINATION.MAX_PAGE_SIZE) {
        // Mark as completed
        await this.jobStateService.updateJobStatus(this.jobId, {
          status: 'completed',
          progress,
          message,
          endTime: new Date().toISOString(),
          stats,
        });
      } else {
        // Update progress
        await this.jobStateService.updateJobStatus(this.jobId, {
          progress,
          message,
        });
      }

      // Log progress
      await this.jobStateService.logInfo(this.jobId, message, { progress });
    } catch (error) {
      logger.warn('Failed to update job progress', {
        jobId: this.jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
