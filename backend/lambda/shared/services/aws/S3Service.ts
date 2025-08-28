import pLimit from 'p-limit';

import { S3Adapter } from '../../../adapters/aws/S3Adapter';
import { createS3Client } from '../../config/awsClients';
import { EXPORT_CONFIG } from '../../config/exportConfig';
import { S3_LIMITS, STATUS_CODES } from '../../constants';
import { type OperationTracker } from '../../models/operations.model';
import { withRetry } from '../../utils/awsRetry';
import { logger } from '../../utils/logger';

/**
 * S3 operation metadata for tracking and logging
 */
interface S3Operation {
  operation: string;
  bucket?: string;
  key?: string;
}

/**
 * S3 service that provides business logic for S3 operations
 * Handles data transformation, operation tracking, retry logic, and error handling
 */
export class S3Service {
  private readonly operationTracker?: OperationTracker;
  private readonly s3Adapter: S3Adapter;

  constructor(awsAccountId: string, operationTracker?: OperationTracker) {
    const client = createS3Client();
    this.s3Adapter = new S3Adapter(client, awsAccountId);
    this.operationTracker = operationTracker;
  }

  public async batchGetObjects(
    bucket: string,
    keys: string[]
  ): Promise<
    Array<{
      key: string;
      data?: any;
      error?: Error;
    }>
  > {
    const limit = pLimit(EXPORT_CONFIG.s3Operations.maxConcurrentBulkOps);

    const results = await Promise.allSettled(
      keys.map((key) => limit(() => this.getObject(bucket, key)))
    );

    return results.map((result, index) => {
      const key = keys[index];
      if (!key) {
        throw new Error(`Key at index ${index} is undefined`);
      }
      if (result.status === 'fulfilled') {
        return { key, data: result.value };
      } else {
        return { key, error: result.reason };
      }
    });
  }

  public async batchPutObjects(
    bucket: string,
    objects: Array<{ key: string; body: any; contentType?: string }>
  ): Promise<
    Array<{
      key: string;
      success: boolean;
      error?: Error;
    }>
  > {
    const limit = pLimit(EXPORT_CONFIG.s3Operations.maxConcurrentBulkOps);

    const results = await Promise.allSettled(
      objects.map((obj) => limit(() => this.putObject(bucket, obj.key, obj.body, obj.contentType)))
    );

    return results.map((result, index) => {
      const obj = objects[index];
      const key = obj?.key || '';
      if (result.status === 'fulfilled') {
        return { key, success: true };
      } else {
        return { key, success: false, error: result.reason };
      }
    });
  }

  // =============================================================================
  // CORE S3 OPERATIONS
  // =============================================================================

  public async deleteObject(bucket: string, key: string): Promise<void> {
    await this.executeWithTracking(
      async () => await this.s3Adapter.deleteObject(bucket, key),
      { operation: 'DeleteObject', bucket, key },
      'delete'
    );
  }

  /**
   * Ensure bucket exists, create if it doesn't
   */
  public async ensureBucketExists(bucket: string): Promise<void> {
    try {
      // Check if bucket exists
      await this.executeWithTracking(
        async () => {
          await this.s3Adapter.headBucket(bucket);
        },
        { operation: 'HeadBucket', bucket },
        'head'
      );
      return; // Explicitly return here
    } catch (error: any) {
      if (error.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND || error.name === 'NotFound') {
        // Bucket doesn't exist, create it
        logger.info(`Creating bucket ${bucket}`);
        try {
          await this.executeWithTracking(
            async () => {
              await this.s3Adapter.createBucket(bucket, process.env.AWS_REGION);
            },
            { operation: 'CreateBucket', bucket },
            'put'
          );

          // Enable versioning
          await this.executeWithTracking(
            async () => {
              await this.s3Adapter.putBucketVersioning(bucket, {
                Status: 'Enabled',
              });
            },
            { operation: 'PutBucketVersioning', bucket },
            'put'
          );

          logger.info(`Successfully created bucket ${bucket}`);
        } catch (createError: any) {
          // If bucket already exists (race condition), that's fine
          if (
            createError.name !== 'BucketAlreadyExists' &&
            createError.name !== 'BucketAlreadyOwnedByYou'
          ) {
            throw createError;
          }
          logger.info(`Bucket ${bucket} was created by another process`);
        }
      } else {
        // Some other error occurred
        throw error;
      }
    }
  }

  public async getObject<T = any>(bucket: string, key: string): Promise<T> {
    return await this.executeWithTracking(
      async () => {
        const response = await this.s3Adapter.getObject(bucket, key);

        if (!(response as any)?.Body) {
          throw new Error(`Object body is empty for ${key}`);
        }

        // Convert stream to string
        const chunks: Uint8Array[] = [];
        const reader = (response as any).Body.transformToWebStream().getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          chunks.push(value);
        }

        const bodyString = Buffer.concat(chunks).toString('utf-8');
        return JSON.parse(bodyString) as T;
      },
      { operation: 'GetObject', bucket, key },
      'get'
    );
  }

  /**
   * Get object size without downloading the content
   */
  public async getObjectSize(bucket: string, key: string): Promise<number> {
    const metadata = await this.headObject(bucket, key);
    return metadata.contentLength || 0;
  }

  /**
   * Get current operation statistics
   */
  public getOperationStats(): Record<string, number> {
    return this.operationTracker?.getOperationStats() || {};
  }

  /**
   * Generate a pre-signed URL for object access
   */
  public async getPresignedUrl(
    _bucket: string,
    _key: string,
    _expiresIn: number = 3600
  ): Promise<string> {
    // Note: This would require the @aws-sdk/s3-request-presigner package
    // For now, return a placeholder
    return await Promise.reject(new Error('Pre-signed URL generation not implemented yet'));
  }

  // =============================================================================
  // BATCH OPERATIONS
  // =============================================================================

  public async headObject(
    bucket: string,
    key: string
  ): Promise<{
    lastModified?: Date;
    contentLength?: number;
    contentType?: string;
    etag?: string;
  }> {
    return await this.executeWithTracking(
      async () => {
        const response = await this.s3Adapter.headObject(bucket, key);

        return {
          lastModified: (response as any)?.LastModified,
          contentLength: (response as any)?.ContentLength,
          contentType: (response as any)?.ContentType,
          etag: (response as any)?.ETag,
        };
      },
      { operation: 'HeadObject', bucket, key },
      'head'
    );
  }

  /**
   * Check if object was modified after a given date
   */
  public async isObjectModifiedAfter(bucket: string, key: string, date: Date): Promise<boolean> {
    try {
      const metadata = await this.headObject(bucket, key);
      return metadata.lastModified ? metadata.lastModified > date : false;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND) {
        return true; // Object doesn't exist, so consider it as "modified"
      }
      throw error;
    }
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  public async listObjects(
    bucket: string,
    prefix?: string,
    maxKeys?: number
  ): Promise<
    Array<{
      key: string;
      lastModified: Date;
      size: number;
    }>
  > {
    return await this.executeWithTracking(
      async () => {
        const allObjects: Array<{ key: string; lastModified: Date; size: number }> = [];
        let continuationToken: string | undefined;
        let totalFetched = 0;
        const requestMaxKeys =
          maxKeys && maxKeys < S3_LIMITS.MAX_KEYS_PER_REQUEST
            ? maxKeys
            : S3_LIMITS.MAX_KEYS_PER_REQUEST;

        do {
          const response = await this.s3Adapter.listObjects(
            bucket,
            prefix,
            requestMaxKeys,
            continuationToken
          );

          const objects = ((response as any)?.Contents || [])
            .filter((obj: any) => obj.Key && obj.LastModified)
            .map((obj: any) => ({
              key: obj.Key,
              lastModified: obj.LastModified,
              size: obj.Size || 0,
            }));

          allObjects.push(...objects);
          totalFetched += objects.length;

          // Check if we've reached the desired maxKeys
          if (maxKeys && totalFetched >= maxKeys) {
            return allObjects.slice(0, maxKeys);
          }

          continuationToken = (response as any)?.NextContinuationToken;
        } while (continuationToken);

        return allObjects;
      },
      { operation: 'ListObjectsV2', bucket, key: prefix },
      'list'
    );
  }

  public async objectExists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.headObject(bucket, key);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === STATUS_CODES.NOT_FOUND) {
        return false;
      }
      throw error;
    }
  }

  public async putObject(
    bucket: string,
    key: string,
    body: any,
    contentType = 'application/json'
  ): Promise<void> {
    await this.executeWithTracking(
      async () =>
        await this.s3Adapter.putObject(
          bucket,
          key,
          typeof body === 'string' ? body : JSON.stringify(body, null, 2),
          contentType
        ),
      { operation: 'PutObject', bucket, key },
      'put'
    );
  }

  /**
   * Reset operation statistics
   */
  public resetOperationStats(): void {
    this.operationTracker?.resetOperationStats();
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Execute an operation with retry logic, error handling, and operation tracking
   */
  private async executeWithTracking<T>(
    operation: () => Promise<T>,
    metadata: S3Operation,
    category: string
  ): Promise<T> {
    // Track operation using the operation tracker
    if (this.operationTracker) {
      await this.operationTracker.trackOperation(`s3.${category}`);
    }

    const startTime = Date.now();

    try {
      const result = await withRetry(operation, `${metadata.operation}(${metadata.key || 'N/A'})`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Don't log NoSuchKey errors for GetObject operations as they're expected
      const shouldLogError = !(
        metadata.operation === 'GetObject' &&
        error instanceof Error &&
        (error.name === 'NoSuchKey' || error.message.includes('does not exist'))
      );

      if (shouldLogError) {
        logger.error(`S3 API: ${metadata.operation} failed`, {
          bucket: metadata.bucket,
          key: metadata.key,
          duration: `${duration}ms`,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }
}
