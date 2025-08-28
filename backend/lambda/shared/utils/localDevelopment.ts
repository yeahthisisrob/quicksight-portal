/**
 * Local development utilities for testing with SAM Local
 * This module provides clean separation between production and local dev code
 */

import { logger } from './logger';

export interface LocalJobExecutionConfig {
  jobId: string;
  jobType: string;
  message: any;
}

/**
 * Creates a mock SQS event for local testing
 * This replicates how SQS would structure the event for our worker
 */
export function createMockSQSEvent(config: LocalJobExecutionConfig): any {
  return {
    Records: [
      {
        messageId: `mock-${config.jobId}`,
        receiptHandle: 'mock-receipt-handle',
        body: JSON.stringify(config.message),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: Date.now().toString(),
          SenderId: 'local-development',
          ApproximateFirstReceiveTimestamp: Date.now().toString(),
        },
        messageAttributes: {},
        md5OfBody: 'mock-md5-hash',
        eventSource: 'aws:sqs',
        eventSourceARN: 'arn:aws:sqs:us-east-1:000000000000:local-dev-queue',
        awsRegion: process.env.AWS_REGION || 'us-east-1',
      },
    ],
  };
}

/**
 * Executes a job locally using the worker handler
 * This is only used during local development with SAM Local
 */
export async function executeJobLocally(config: LocalJobExecutionConfig): Promise<void> {
  logger.info('Local job execution started', {
    jobId: config.jobId,
    jobType: config.jobType,
  });

  try {
    // Import worker handler
    const { handler: workerHandler } = await import('../../worker');

    // Create mock SQS event
    const mockEvent = createMockSQSEvent(config);

    // Execute the worker handler
    await workerHandler(mockEvent, {} as any);

    logger.info('Local job execution completed successfully', {
      jobId: config.jobId,
      jobType: config.jobType,
    });
  } catch (error) {
    logger.error('Local job execution failed', {
      jobId: config.jobId,
      jobType: config.jobType,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Don't re-throw in local development - let the job state handle it
    // This prevents SAM Local from retrying and creating duplicate jobs
  }
}

/**
 * Determines if we're running in local development mode
 */
export function isLocalDevelopment(): boolean {
  return (
    process.env.AWS_SAM_LOCAL === 'true' ||
    process.env.IS_LOCAL === 'true' ||
    (process.env.NODE_ENV === 'development' && process.env.DIRECT_WORKER_EXECUTION === 'true')
  );
}

/**
 * Fire-and-forget execution for local development
 * This prevents blocking the API response while still executing the job
 */
export function executeJobLocallyAsync(config: LocalJobExecutionConfig): void {
  // Use setTimeout(0) to push execution to the next event loop cycle
  // This ensures the Lambda execution context can complete before the worker starts
  global.setTimeout(() => {
    executeJobLocally(config).catch((error) => {
      logger.error('Async local job execution failed', {
        jobId: config.jobId,
        jobType: config.jobType,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }, 0);
}
