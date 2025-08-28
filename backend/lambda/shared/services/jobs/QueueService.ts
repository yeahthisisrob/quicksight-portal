/**
 * QueueService - Shared service for queue operations
 * VSA Pattern - Shared Service Layer
 */
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import { getOptimizedAwsConfig } from '../../config/httpConfig';
import { logger } from '../../utils/logger';

export interface QueueMessage {
  jobId: string;
  jobType: 'export' | 'deploy' | string;
  accountId: string;
  bucketName: string;
  userId?: string;
  initialMessage?: string; // Initial status message for the job
  [key: string]: any; // Allow additional properties for different job types
}

/**
 * Shared service for managing SQS queue operations
 */
export class QueueService {
  private static instance: QueueService;
  /**
   * Get singleton instance
   */
  public static getInstance(): QueueService {
    if (!QueueService.instance) {
      QueueService.instance = new QueueService();
    }
    return QueueService.instance;
  }
  private readonly queueUrl: string;

  private readonly sqsClient: SQSClient;

  private constructor() {
    this.sqsClient = new SQSClient({
      ...getOptimizedAwsConfig(),
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 3000, // 3 second connection timeout for SQS
        socketTimeout: 5000, // 5 second socket timeout for SQS
      }),
    });
    this.queueUrl = process.env.EXPORT_QUEUE_URL || ''; // Will be renamed to WORKER_QUEUE_URL
  }

  /**
   * Get the configured queue URL
   */
  public getQueueUrl(): string {
    return this.queueUrl;
  }

  /**
   * Check if running in local/SAM mode
   */
  public isLocalMode(): boolean {
    return process.env.AWS_SAM_LOCAL === 'true' || process.env.IS_LOCAL === 'true';
  }

  /**
   * Send a job message to the queue
   */
  public async sendMessage(message: QueueMessage): Promise<string | undefined> {
    if (!this.queueUrl) {
      throw new Error('Queue URL not configured');
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(message),
        MessageAttributes: {
          jobId: {
            DataType: 'String',
            StringValue: message.jobId,
          },
          jobType: {
            DataType: 'String',
            StringValue: message.jobType,
          },
          ...(message.userId && {
            userId: {
              DataType: 'String',
              StringValue: message.userId,
            },
          }),
        },
      });

      const response = await this.sqsClient.send(command);

      logger.info('Job queued', {
        jobId: message.jobId,
        jobType: message.jobType,
        messageId: response.MessageId,
      });

      return response.MessageId;
    } catch (error) {
      logger.error('Failed to queue job', {
        jobId: message.jobId,
        jobType: message.jobType,
        error,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const queueService = QueueService.getInstance();
